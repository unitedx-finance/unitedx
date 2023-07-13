const { ethers } = require("hardhat");
module.exports = async function({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const comp = await ethers.getContract("Comp");
  const comptroller = await ethers.getContract("Unitroller");
  // 3 years
  const lockTime = 3 * 365 * 24 * 60 * 60;

  await deploy("CompLock", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [comp.address, comptroller.address, lockTime],
  });
};

module.exports.tags = ["CompLock"];
