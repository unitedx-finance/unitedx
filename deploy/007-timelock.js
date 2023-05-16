const { deployments, ethers } = require("hardhat");

module.exports = async function({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  const contract = await ethers.getContractFactory("Timelock");
  const bytecode = contract.bytecode;

  await deploy("Timelock", {
    from: deployer,
    args: [deployer, 864000],
    log: true,
    deterministicDeployment: false,
    gasLimit: 5000000,
    gasPrice: 60000000000,
  });
};

module.exports.tags = ["Timelock"];
