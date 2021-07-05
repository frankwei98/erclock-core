//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {IUnlock} from "./IUnlock.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract ContentKey is ERC721Enumerable, ReentrancyGuard {
    using Counters for Counters.Counter;
    using SafeMath for uint256;
    mapping(uint256 => IUnlock.KeyData) public keyDatas;
    address public factory;
    Counters.Counter private _tokenIdTracker;

    // EIP-712 Related
    bytes32 public DOMAIN_SEPARATOR;

    //keccak256("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)");
    bytes32 public constant PERMIT_TYPEHASH =
        0x49ecf333e5b8c95c40fdafc95c1ad136e8914a8fb55e9dc8bb01eaa83a2df9ad;
    bytes32 public constant VERIFY_TYPEHASH =
        keccak256("VerifyKeyHolder(uint256 tokenId,uint256 timestamp)");
    mapping(address => mapping(uint256 => uint256)) public permitNonces;

    struct EIP712Signature {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    constructor() ERC721("Content Key", "CKEY") {
        factory = msg.sender;
        uint256 _chainId = getChainId();
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("TokenLock")),
                keccak256(bytes("1")),
                _chainId,
                address(this)
            )
        );
    }

    function getChainId() public view returns (uint256 currentChainId) {
        assembly {
            currentChainId := chainid()
        }
    }

    modifier factoryOnly() {
        require(factory == msg.sender, "Factory only");
        _;
    }

    /**
     * @notice Require that the token has not been burned and has been minted
     */
    modifier onlyExistingToken(uint256 tokenId) {
        require(_exists(tokenId), "Media: nonexistent token");
        _;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override {
        require(
            from == address(0) || // mint
                to == address(0) || // or burn
                keyDatas[tokenId].transferable, // or token is transferable
            "The Creator disabled transfer for this key."
        );
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function mint(address to, IUnlock.KeyData memory keyData)
        public
        factoryOnly
    {
        _mint(to, keyData);
    }

    function _mint(address to, IUnlock.KeyData memory data)
        internal
        returns (uint256 tokenId)
    {
        tokenId = _tokenIdTracker.current();
        _safeMint(to, tokenId);
        keyDatas[tokenId] = data;
        _tokenIdTracker.increment();
    }

    /**
     * @notice See IMedia
     * @dev This method is loosely based on the permit for ERC-20 tokens in  EIP-2612, but modified
     * for ERC-721.
     */
    function permit(
        address spender,
        uint256 tokenId,
        EIP712Signature memory sig
    ) public nonReentrant onlyExistingToken(tokenId) {
        require(
            sig.deadline == 0 || sig.deadline >= block.timestamp,
            "Media: Permit expired"
        );
        require(spender != address(0), "Media: spender cannot be 0x0");

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        PERMIT_TYPEHASH,
                        spender,
                        tokenId,
                        permitNonces[ownerOf(tokenId)][tokenId]++,
                        sig.deadline
                    )
                )
            )
        );

        address recoveredAddress = ecrecover(digest, sig.v, sig.r, sig.s);

        require(
            recoveredAddress != address(0) &&
                ownerOf(tokenId) == recoveredAddress,
            "Media: Signature invalid"
        );

        _approve(spender, tokenId);
    }

    /**
     * Verify is the `sig` a valid signature that was Signed by the owner of `tokenId`
     */
    function verifyKeyHolder(
        uint256 tokenId,
        IUnlock.EIP712Signature memory sig
    ) public view returns (bool isSigValid) {
        // now < deadline < (now + 1 days)
        uint256 _now = block.timestamp;
        uint256 oneDaysLater = _now + 1 days;
        require(
            _now < sig.deadline && sig.deadline < oneDaysLater,
            "Key::verifyKeyHolder: sig expired"
        );
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(VERIFY_TYPEHASH, tokenId, sig.deadline))
            )
        );
        address recoveredSigner = ecrecover(digest, sig.v, sig.r, sig.s);
        isSigValid = ownerOf(tokenId) == recoveredSigner;
    }
}
