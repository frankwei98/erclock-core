import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { Signer, Contract, utils, providers } from "ethers";
import type { ContentKey } from "../typechain/ContentKey";
import type { LocksmithShop } from "../typechain/LocksmithShop";
import type { MintableERC20 } from "../typechain/MintableERC20";
import { BigNumber } from "ethers";
import { BigNumberish } from "ethers";
chai.use(solidity);

async function getNewLockRequestSignature(locksmithMaster: Signer, verifyingContract: string, contentHash: string, AskData: {
  owner: string;
  token: string;
  amount: BigNumberish,
  period: number,
  isTransferAllowed: boolean,
}) {
  const chainId = await locksmithMaster.getChainId();
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const domain = {
      name: "LocksmithShop",
      version: "1",
      chainId: chainId,
      verifyingContract,
    };
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
    const signature = await (locksmithMaster as providers.JsonRpcSigner)._signTypedData(domain, type, msg);
    const { r, s, v } = utils.splitSignature(signature);
    return { r,s,v, deadline }
}

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

    await contentKey.switchFactory(locksmithShop.address);
  });

  it("should `locksmithMaster` is in `isLocksmith`", async function () {
    chai.expect(
      await locksmithShop.isLocksmith(await locksmithMaster.getAddress())
    ).to.be.true;
  });

  it("should good to new a lock with locksmith's approval", async function () {
    const AskData = {
      owner: await accounts[1].getAddress(),
      token: testPaymentToken.address,
      amount: BigNumber.from("114514191981000000").toString(),
      period: 3600 * 24 * 180,
      isTransferAllowed: true,
    };
    const contentHash = "QmNzSrLQW52TwnGqe2MaADT14UFJ5Mz4eHHveNceHq9KcY";
    
    const { r, s, v, deadline } = await getNewLockRequestSignature(locksmithMaster, locksmithShop.address, contentHash, AskData);
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
    const AskData = {
      owner: await accounts[1].getAddress(),
      token: testPaymentToken.address,
      amount: BigNumber.from("114514191981000000").toString(),
      period: 3600 * 24 * 180,
      isTransferAllowed: true,
    };
    
    const contentHash = "QmNzSrLQW52TwnGqe2MaADT14UFJ5Mz4eHHveNceHq9KcY";
    
    const { r, s, v, deadline } = await getNewLockRequestSignature(locksmithMaster, locksmithShop.address, contentHash, AskData);
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
    const AskData = {
      owner: await accounts[1].getAddress(),
      token: testPaymentToken.address,
      amount: BigNumber.from("114514191981000000").toString(),
      period: 3600 * 24 * 180,
      isTransferAllowed: true,
    };
    const contentHash = "QmNzSrLQW52TwnGqe2MaADT14UFJ5Mz4eHHveNceHq9KcY";
    
    const { r, s, v, deadline } = await getNewLockRequestSignature(locksmithMaster, locksmithShop.address, contentHash, AskData);
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
  it("should good to mint new key for owner's request", async function () {
    const ownerWallet = accounts[1];
    const AskData = {
      owner: await ownerWallet.getAddress(),
      token: testPaymentToken.address,
      amount: BigNumber.from("114514191981000000").toString(),
      period: 3600 * 24 * 180,
      isTransferAllowed: true,
    };
    const contentHash = "foooooobarrrrrrr";
    
    const { r, s, v, deadline } = await getNewLockRequestSignature(locksmithMaster, locksmithShop.address, contentHash, AskData);
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
    
    await expect(locksmithShop.connect(ownerWallet).mintKey(await accounts[8].getAddress(),contentHash)).to.be.not.reverted;
  });


  it("should fail to mint if acting as other", async function () {
    const ownerWallet = accounts[1];
    const AskData = {
      owner: await ownerWallet.getAddress(),
      token: testPaymentToken.address,
      amount: BigNumber.from("114514191981000000").toString(),
      period: 3600 * 24 * 180,
      isTransferAllowed: true,
    };
    const contentHash = "foooooobarrrrrrr";
    
    const { r, s, v, deadline } = await getNewLockRequestSignature(locksmithMaster, locksmithShop.address, contentHash, AskData);
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

    await expect(locksmithShop.mintKey(await accounts[8].getAddress(),contentHash,)).to.be.reverted;
  });

  // buy related
  it("Pay to buy -> Mint ContentKey -> Pay the Owner workflow", async function () {
    const ownerWallet = accounts[1];
    const buyer = accounts[3];

    const amount = BigNumber.from("114514191981000000")

    const AskData = {
      owner: await ownerWallet.getAddress(),
      token: testPaymentToken.address,
      amount: amount.toString(),
      period: 3600 * 24 * 180,
      isTransferAllowed: true,
    };
    const contentHash = "foooooobarrrrrrr";
    
    const { r, s, v, deadline } = await getNewLockRequestSignature(locksmithMaster, locksmithShop.address, contentHash, AskData);
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

    await testPaymentToken.mint(await buyer.getAddress(), amount);
    await testPaymentToken.connect(buyer).approve(locksmithShop.address, amount);


    await expect(locksmithShop.connect(buyer).buyKey(
      contentHash,
    )).to.be.not.reverted;

    expect(await testPaymentToken.balanceOf(await ownerWallet.getAddress())).to.be.gt(0)
    expect(await testPaymentToken.balanceOf(await locksmithShop.feeTo())).to.be.gt(0)
    expect(await testPaymentToken.balanceOf(await buyer.getAddress())).to.be.eq(0)
  });
  it("should fail to buy if token are not enough", async function () {
    const ownerWallet = accounts[1];
    const buyer = accounts[3];

    const amount = BigNumber.from("114514191981000000")

    const AskData = {
      owner: await ownerWallet.getAddress(),
      token: testPaymentToken.address,
      amount: amount.toString(),
      period: 3600 * 24 * 180,
      isTransferAllowed: true,
    };
    const contentHash = "foooooobarrrrrrr";
    
    const { r, s, v, deadline } = await getNewLockRequestSignature(locksmithMaster, locksmithShop.address, contentHash, AskData);
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

    await expect(locksmithShop.connect(buyer).buyKey(
      contentHash,
    )).to.be.revertedWith('ERC20: transfer amount exceeds balance');
  });
});
