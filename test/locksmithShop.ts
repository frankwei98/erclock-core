import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { Signer, Contract, utils, providers } from "ethers";
import type { ContentKey } from "../typechain/ContentKey";
import type { LocksmithShop } from "../typechain/LocksmithShop";
import type { MintableERC20 } from "../typechain/MintableERC20";
import { recoverTypedSignature } from "eth-sig-util";
import { BigNumber } from "ethers";
chai.use(solidity);

describe("LocksmithShop", function () {
  let accounts: Signer[];
  let locksmithMaster: Signer;
  let contentKey: ContentKey;
  let locksmithShop: LocksmithShop;

  let testPaymentToken: MintableERC20;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    locksmithMaster = accounts[0];
    const ContentKey = await ethers.getContractFactory("ContentKey");
    const LocksmithShop = await ethers.getContractFactory("LocksmithShop");
    const TestPaymentToken = await ethers.getContractFactory("MintableERC20");
    const ck = await ContentKey.deploy();
    contentKey = (await ck.deployed()) as ContentKey;
    const shop = await LocksmithShop.deploy(
      contentKey.address,
      await locksmithMaster.getAddress()
    );
    const token = await TestPaymentToken.deploy("Test Payment Token", "TPT");
  
    locksmithShop = (await shop.deployed()) as LocksmithShop;
    testPaymentToken = (await token.deployed()) as MintableERC20;
  });

  it("should `locksmithMaster` is in `isLocksmith`", async function () {
    chai.expect(
      await locksmithShop.isLocksmith(await locksmithMaster.getAddress())
    ).to.be.true;
  });

  it("should good to new a lock with locksmith's approval", async function () {
    const chainId = await locksmithMaster.getChainId();
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const AskData = {
      owner: await accounts[1].getAddress(),
      token: testPaymentToken.address,
      amount: BigNumber.from("114514191981000000").toString(),
      period: 3600 * 24 * 180,
      isTransferAllowed: true,
    };
    const domain = {
      name: "LocksmithShop",
      version: "1",
      chainId: chainId,
      verifyingContract: locksmithShop.address,
    };
    const contentHash = "";
    const msg = {
      token: AskData.token,
      amount: AskData.amount,
      period: AskData.period,
      deadline,
    };
    const type = {
      NewLockRequest: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "period", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    const signature = await (
      locksmithMaster as providers.JsonRpcSigner
    )._signTypedData(domain, type, msg);
    expect(signature).to.be.not.null;
    const { r, s, v } = utils.splitSignature(signature);
    const isSigValid = await locksmithShop.verifyNewLockRequest(
      contentHash,
      AskData,
      {
        r,
        s,
        v,
        deadline,
      }
    );
    const local_recover = recoverTypedSignature({
      sig: signature,
      data: {
        domain,
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
          ...type,
        },
        primaryType: "NewLockRequest",
        message: msg,
      },
    });
    const whoSignNewLockRequest = await locksmithShop.whoSignNewLockRequest(
      contentHash,
      AskData,
      {
        r,
        s,
        v,
        deadline,
      }
    );
    console.info("whoSignNewLockRequest", whoSignNewLockRequest);
    console.info("signer wallet: ", await locksmithMaster.getAddress());
    console.info("local_recover", local_recover);
    expect(isSigValid).to.be.be.true;
  });
  it("should failed to new a lock with outdated approval", async function () {});

  it("should able to set ask", async function () {});
  it("should fail to set ask if operated as others", async function () {});

  // simpling minting key(should be owner's right only)
  it("should good to mint new key for owner's request", async function () {});
  it("should fail to mint if acting as other", async function () {});

  // buy related
  it("Pay to buy -> Mint ContentKey -> Pay the Owner workflow", async function () {});
  it("should fail to buy if token are not enough", async function () {});

  // EIP712 Premit related
});
