import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { Signer, utils, providers } from "ethers";
import type { ContentKey } from "../typechain/ContentKey";
chai.use(solidity);

describe("ContentKey", function () {
  let accounts: Signer[];
  let minter: Signer;
  let contentKey: ContentKey;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    minter = accounts[0];
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
    const addr = await minter.getAddress();
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
    const addr = await minter.getAddress();
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
    const addr = await minter.getAddress();
    const addr1 = await accounts[1].getAddress();
    await contentKey.mint(addr, keyData);

    await chai.expect(contentKey.transferFrom(addr, addr1, "0")).to.not
      .reverted;
  });

  it("should revert when the token was disabled for transfer", async function () {
    // Do something with the accounts
    const keyData = {
      expireAt: Math.floor(Date.now() / 1000),
      transferable: false,
      contentHash: "foobar",
    };
    const addr = await minter.getAddress();
    const addr1 = await accounts[1].getAddress();
    await contentKey.mint(addr, keyData);

    await chai.expect(contentKey.transferFrom(addr, addr1, "0")).to.reverted;
  });

  it("should `listKeys()` working", async function () {
    const keyData = {
      expireAt: Math.floor(Date.now() / 1000),
      transferable: false,
      contentHash: "foobar",
    };
    const addr = await minter.getAddress();
    await contentKey.mint(addr, keyData);
    const { tokenIds, data } = await contentKey.listKeys(addr);
    chai.expect(tokenIds[0].toNumber()).to.eq(0);
    chai.expect(data[0].contentHash).to.eq(keyData.contentHash);
    chai.expect(data[0].transferable).to.eq(keyData.transferable);
  });

  it("should `contentToTokenIds()` working", async function () {
    // Do something with the accounts
    const keyData = {
      expireAt: Math.floor(Date.now() / 1000),
      transferable: false,
      contentHash: "foobar",
    };
    // everyone get a Key
    accounts.forEach(async (acc) => {
      await contentKey.mint(await acc.getAddress(), keyData);
    });
    const tokenIds = await contentKey.contentToTokenIds(keyData.contentHash);
    // the matched tokenIds length should eq accounts.length
    chai.expect(tokenIds.length).to.be.eq(accounts.length);
  });

  // EIP712 Premit related
  it("should good to transfer with Permit", async function () {
    const chainId = await minter.getChainId();
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const keyData = {
      expireAt: Math.floor(Date.now() / 1000) + 3600 * 24 * 180,
      transferable: true,
      contentHash: "foobar",
    };
    const tokenOwner = await accounts[1].getAddress();
    await contentKey.mint(tokenOwner, keyData);
    const spender = await accounts[2].getAddress();
    const nonce = await contentKey.permitNonces(spender, 0);
    const msg = {
      spender,
      tokenId: 0,
      nonce: nonce.toNumber(),
      deadline: deadline,
    };

    const signature = await (accounts[1] as providers.JsonRpcSigner)._signTypedData(
      {
        name: "ContentKey",
        version: "1",
        chainId: chainId,
        verifyingContract: contentKey.address,
      },
      {
        Permit: [
          { name: "spender", type: "address" },
          {
            name: "tokenId",
            type: "uint256",
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      msg
    );

    chai.expect(signature).to.be.not.null;
    const { r, s, v } = utils.splitSignature(signature);

    await chai.expect(
      contentKey.permit(spender, msg.tokenId, {
        r,
        s,
        v,
        deadline,
      })
    ).to.be.not.reverted;
  });
});
