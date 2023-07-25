const { ethers } = require("hardhat");
const { expect } = require("chai");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");

const LOCK_TIME = 3 * 365 * 24 * 60 * 60;

describe("CompLock", function() {
  ethers.utils.Logger.setLogLevel("error");

  async function deployFixture(args) {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const UTDX = await ethers.getContractFactory("Comp");
    const utdx = await UTDX.deploy(owner.address);
    await utdx.deployed();

    const CompLock = await ethers.getContractFactory("CompLock");
    const compLock = await CompLock.deploy(
      utdx.address,
      addr1.address,
      LOCK_TIME
    );
    await compLock.deployed();

    return {
      utdx,
      compLock,
      owner,
      addr1,
      addr2,
    };
  }

  it("Transfer cannot be initiated before timeLock time has passed", async () => {
    const { compLock } = await loadFixture(deployFixture);

    await expect(compLock.transfer()).to.be.revertedWith(
      "unlock time not reached yet"
    );

    await time.increase(LOCK_TIME - 3);
    await expect(compLock.transfer()).to.be.revertedWith(
      "unlock time not reached yet"
    );
  });

  it("Transfer can be initiated after timeLock time has passed", async () => {
    const { compLock, utdx, addr1 } = await loadFixture(deployFixture);

    const lockBalance = await utdx.balanceOf(compLock.address);
    await time.increase(LOCK_TIME);

    await compLock.transfer();
    expect(await utdx.balanceOf(addr1.address)).to.equal(lockBalance);
    expect(await utdx.balanceOf(compLock.address)).to.equal(
      ethers.constants.Zero
    );
  });
});
