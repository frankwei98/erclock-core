import { expect } from "chai";
import { ethers } from "hardhat";
import type { Signer, Contract } from "ethers";

describe("ContentKey", function () {
  let accounts: Signer[];
  let contentKey: Contract;

  beforeEach(async function () {
    accounts = await ethers.getSigners();

    const ContentKey = await ethers.getContractFactory("ContentKey");
    const ck = await ContentKey.deploy();

    contentKey = await ck.deployed();
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
    expect(balance.toString()).to.eq("1");
  });

  it("should disabled transfer", async function () {
    // Do something with the accounts
    const keyData = {
      expireAt: Math.floor(Date.now() / 1000),
      transferable: false,
      contentHash: "foobar",
    };
    const addr = await accounts[0].getAddress();
    const addr1 = await accounts[1].getAddress();
    const tx = await contentKey.mint(addr, keyData);
    const tokenId = await tx.wait();
    const balance = await contentKey.transferFrom(addr, addr1, tokenId);
    expect(balance.toString()).to.eq("1");
  });
});
