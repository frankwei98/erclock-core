import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { Signer, Contract, utils, providers } from "ethers";
import type { ContentKey } from "../typechain/ContentKey";
import type { LocksmithShop } from "../typechain/LocksmithShop";
import type { MintableERC20 } from "../typechain/MintableERC20";
import { recoverTypedSignature } from "eth-sig-util";
import { BigNumber } from "ethers";
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";
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
    const contentHash = "QmNzSrLQW52TwnGqe2MaADT14UFJ5Mz4eHHveNceHq9KcY";
    const msg = {
      contentHash,
      token: AskData.token,
      amount: AskData.amount,
      period: AskData.period,
      deadline,
    };
    const type = {
      NewLockRequest: [
        { name: "contentHash", type: "string" },
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
    expect(isSigValid).to.be.true;
  });

  it("should failed to new a lock with outdated approval", async function () {
    const chainId = await locksmithMaster.getChainId();
    // which is 3600 sec before
    const deadline = Math.floor(Date.now() / 1000) - 3600;
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
    const contentHash = "QmNzSrLQW52TwnGqe2MaADT14UFJ5Mz4eHHveNceHq9KcY";
    const msg = {
      contentHash,
      token: AskData.token,
      amount: AskData.amount,
      period: AskData.period,
      deadline,
    };
    const type = {
      NewLockRequest: [
        { name: "contentHash", type: "string" },
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
    await expect(locksmithShop.verifyNewLockRequest(
      contentHash,
      AskData,
      {
        r,
        s,
        v,
        deadline,
      }
    )).to.be.revertedWith('Locksmith::verifyNewLockRequest: sig deadline expired');
  });

  it("should able to set ask", async function () {
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
    const contentHash = "QmNzSrLQW52TwnGqe2MaADT14UFJ5Mz4eHHveNceHq9KcY";
    const msg = {
      contentHash,
      token: AskData.token,
      amount: AskData.amount,
      period: AskData.period,
      deadline,
    };
    const type = {
      NewLockRequest: [
        { name: "contentHash", type: "string" },
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
    // new the lock
    await expect(locksmithShop.newLock(
      contentHash,
      AskData,
      {
        r,
        s,
        v,
        deadline,
      }
    )).to.be.not.reverted;
    // and set ask of the lock again
    const newAskAmount = 19198100000
    await expect(
      locksmithShop.connect(accounts[1]).setAsk(contentHash, { ...AskData, amount: newAskAmount })
    ).to.be.not.reverted;
    expect((await locksmithShop.asks(contentHash)).amount).to.be.eq(newAskAmount)
  });
  it("should revert set ask if operated as others", async function () {
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
    const contentHash = "QmNzSrLQW52TwnGqe2MaADT14UFJ5Mz4eHHveNceHq9KcY";
    const msg = {
      contentHash,
      token: AskData.token,
      amount: AskData.amount,
      period: AskData.period,
      deadline,
    };
    const type = {
      NewLockRequest: [
        { name: "contentHash", type: "string" },
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
    // new the lock
    await expect(locksmithShop.newLock(
      contentHash,
      AskData,
      {
        r,
        s,
        v,
        deadline,
      }
    )).to.be.not.reverted;
    // and set ask of the lock again
    const newAskAmount = 19198100000
    await expect(locksmithShop.setAsk(contentHash, { ...AskData, amount: newAskAmount })).to.be.revertedWith('SET_ASK::EITHER OWNER OR EMPTY');
  });

  // simpling minting key(should be owner's right only)
  it("should good to mint new key for owner's request", async function () {});
  it("should fail to mint if acting as other", async function () {});

  // buy related
  it("Pay to buy -> Mint ContentKey -> Pay the Owner workflow", async function () {});
  it("should fail to buy if token are not enough", async function () {});

  // EIP712 Premit related
});
