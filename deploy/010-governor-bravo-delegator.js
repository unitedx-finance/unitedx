module.exports = async function ({ getNamedAccounts, deployments }) { 
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const timeLock = await ethers.getContract("Timelock");
  const utdx = await ethers.getContract("Utdx");
  const delegate = await ethers.getContract("GovernorBravoDelegate");

  await deploy("GovernorBravoDelegator", {
    from: deployer,
    args: [
      timeLock.address,
      utdx.address,
      deployer,
      delegate.address,
      120,
      60,
      ethers.utils.parseEther("50000"),
    ],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["GovernorBravoDelegator"];
module.exports.dependencies = ["GovernorBravoDelegate", "Utdx", "Timelock"];
