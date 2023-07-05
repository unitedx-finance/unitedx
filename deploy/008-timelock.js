const { deployments, ethers } = require("hardhat");

module.exports = async function({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const contract = await ethers.getContractFactory("Timelock");
  const bytecode = contract.bytecode;

  await deploy("Timelock", {
    from: deployer,
    args: [deployer, 120],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["Timelock"];
