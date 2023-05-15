module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const timeLock = await ethers.getContract("Timelock");
  const utdx = await ethers.getContract("Utdx");

  await deploy("contracts/Governance/GovernorAlpha.sol:GovernorAlpha", {
    from: deployer,
    args: [timeLock.address, utdx.address, deployer],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["GovernorAlpha"];
module.exports.dependencies = ["Utdx", "Timelock"];
