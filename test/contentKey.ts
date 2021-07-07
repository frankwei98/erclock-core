import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import type { Signer, Contract } from "ethers";
import type { ContentKey } from "../typechain/ContentKey";
chai.use(solidity);

describe("ContentKey", function () {
  let accounts: Signer[];
  let contentKey: ContentKey;

  beforeEach(async function () {
    accounts = await ethers.getSigners();

    const ContentKey = await ethers.getContractFactory("ContentKey");
    const ck = await ContentKey.deploy();

    contentKey = (await ck.deployed()) as ContentKey;
  });

  it("should mint", async function () {
    // Do something with the accounts
    const keyData = {
      expireAt: Math.floor(Date.now() / 1000),
      transferable: true,
      contentHash: "foobar",
    };
    const addr = await accounts[0].getAddress();
    const tx = await contentKey.mint(addr, keyData);
    await tx.wait();
    const balance = await contentKey.balanceOf(addr);
    chai.expect(balance.toString()).to.eq("1");
  });

  it("should fail the mint if acting as non-minter", async function () {
    // Do something with the accounts
    const keyData = {
      expireAt: Math.floor(Date.now() / 1000),
      transferable: true,
      contentHash: "foobar",
    };
    const addr = await accounts[0].getAddress();
    await chai.expect(contentKey.connect(accounts[1]).mint(addr, keyData)).to
      .reverted;
  });

  it("should transfer when enabled", async function () {
    // Do something with the accounts
    const keyData = {
      expireAt: Math.floor(Date.now() / 1000),
      transferable: true,
      contentHash: "foobar",
    };
    const addr = await accounts[0].getAddress();
    const addr1 = await accounts[1].getAddress();
    await contentKey.mint(addr, keyData);

    await chai.expect(contentKey.transferFrom(addr, addr1, "0")).to.not
      .reverted;
  });

  it("should revert when disabled transfer", async function () {
    // Do something with the accounts
    const keyData = {
      expireAt: Math.floor(Date.now() / 1000),
      transferable: false,
      contentHash: "foobar",
    };
    const addr = await accounts[0].getAddress();
    const addr1 = await accounts[1].getAddress();
    await contentKey.mint(addr, keyData);

    await chai.expect(contentKey.transferFrom(addr, addr1, "0")).to.reverted;
  });
});
