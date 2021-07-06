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
    expect((await contentKey.balanceOf(addr)).toNumber()).to.greaterThan(0);
  });
});
