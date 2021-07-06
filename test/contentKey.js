const { expect } = require("chai");

describe("ContentKey", function () {
  let accounts
  let contentKey

  beforeEach(async function () {
    accounts = await ethers.getSigners();

    const ContentKey = await ethers.getContractFactory(
      "ContentKey",
    );
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
    const tx = await contentKey.mint(accounts[0].address, keyData);
    await tx.wait();
    expect((await contentKey.balanceOf(accounts[0].address)).toNumber()).to.greaterThan(0);
  });
});
