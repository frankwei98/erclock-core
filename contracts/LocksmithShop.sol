//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IUnlock} from "./IUnlock.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {ContentKey} from "./Key.sol";

interface ILocksmithShop {
    function setAsk(string memory _hash, IUnlock.Ask memory _newAsk) external;

    function buyKey(string memory _hash) external;

    function setNewLockSmith(address newLocksmith) external;

    /**
     * EIP-712 Related Functions
     */
    function getChainId() external view returns (uint256 currentChainId);

    function verifyNewLockRequest(
        IUnlock.KeyData memory keyData,
        IUnlock.EIP712Signature memory sig
    ) external view returns (bool isSigValid);

    function newLock(
        IUnlock.Ask memory _newAsk,
        IUnlock.KeyData memory keyData,
        IUnlock.EIP712Signature memory sig
    ) external;
}

contract LocksmithShop is ILocksmithShop {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    mapping(string => IUnlock.Ask) public asks;
    mapping(string => IUnlock.KeyData) public keyDatas;

    // For EIP-712
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public constant VERIFY_TYPEHASH =
        keccak256(
            "NewKeyRequest(string contentHash,bool transferable,uint256 expireAt,uint256 deadline)"
        );

    // Locksmith is a EOA in our backend
    // provide a offline signature for setting A New Lock(Content)
    mapping(address => bool) public isLocksmith;

    ContentKey public key;

    address public feeTo;

    constructor(address keyAddress, address _feeTo) {
        uint256 _chainId = getChainId();
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyNewLockRequestingContract)"
                ),
                keccak256(bytes("TokenLock")),
                keccak256(bytes("1")),
                _chainId,
                address(this)
            )
        );
        key = ContentKey(keyAddress);
        feeTo = _feeTo;
        isLocksmith[msg.sender] = true;
        isLocksmith[_feeTo] = true;
    }

    modifier isAskExist(string memory _hash) {
        require(asks[_hash].token != address(0), "No Valid Ask was found");
        _;
    }

    modifier isGoodToSetAsk(string memory _hash) {
        IUnlock.Ask memory ask = asks[_hash];
        require(
            ask.owner == address(0) || ask.owner == msg.sender,
            "SET_ASK::EITHER OWNER OR EMPTY"
        );
        _;
    }

    function setAsk(string memory _hash, IUnlock.Ask memory _newAsk)
        public
        override
        isGoodToSetAsk(_hash)
    {
        asks[_hash] = _newAsk;
    }

    function buyKey(string memory _hash) public override isAskExist(_hash) {
        IUnlock.Ask memory ask = asks[_hash];
        // get the money
        IERC20(ask.token).safeTransferFrom(
            msg.sender,
            address(this),
            ask.amount
        );

        // mint the new key
        _mint(msg.sender, _hash);

        uint256 fee = ask.amount.mul(5).div(1000);
        uint256 authorCut = ask.amount.sub(fee);

        // sent the money
        IERC20(ask.token).safeTransfer(feeTo, fee);
        IERC20(ask.token).safeTransfer(ask.owner, authorCut);
    }

    modifier mustBeLockSmith() {
        require(isLocksmith[msg.sender], "Must be a Locksmith to do.");
        _;
    }

    function setNewLockSmith(address newLocksmith)
        public
        override
        mustBeLockSmith
    {
        isLocksmith[newLocksmith] = true;
    }

    /**
     * EIP-712 Related Functions
     */

    function getChainId()
        public
        view
        override
        returns (uint256 currentChainId)
    {
        assembly {
            currentChainId := chainid()
        }
    }

    /**
     * Verify is the `sig` a valid signature that was Signed by the owner of `tokenId`
     */
    function verifyNewLockRequest(
        IUnlock.KeyData memory keyData,
        IUnlock.EIP712Signature memory sig
    ) public view override returns (bool isSigValid) {
        require(
            sig.deadline == 0 || sig.deadline >= block.timestamp,
            "Locksmith::verifyNewLockRequest: sig deadline expired"
        );
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        VERIFY_TYPEHASH,
                        keyData.contentHash,
                        keyData.transferable,
                        keyData.expireAt,
                        sig.deadline
                    )
                )
            )
        );
        address recoveredSigner = ecrecover(digest, sig.v, sig.r, sig.s);
        isSigValid = isLocksmith[recoveredSigner];
    }

    function newLock(
        IUnlock.Ask memory _newAsk,
        IUnlock.KeyData memory keyData,
        IUnlock.EIP712Signature memory sig
    ) public override isGoodToSetAsk(keyData.contentHash) {
        require(
            verifyNewLockRequest(keyData, sig),
            "Locksmith::BAD_SIG: Please contact dev team"
        );
        asks[keyData.contentHash] = _newAsk;
        keyDatas[keyData.contentHash] = keyData;
    }

    function mintKey(address to, string memory _hash) public {
        IUnlock.Ask memory ask = asks[_hash];
        require(
            ask.owner == msg.sender,
            "Must be the owner to mintKey for free"
        );
        _mint(to, _hash);
    }

    function _mint(address to, string memory _hash)
        internal
        returns (uint256 tokenId)
    {
        IUnlock.KeyData memory keyData = keyDatas[_hash];
        return key.mint(to, keyData);
    }
}
