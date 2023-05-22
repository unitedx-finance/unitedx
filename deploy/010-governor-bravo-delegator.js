module.exports = async function({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const timeLock = await ethers.getContract("Timelock");
  const comp = await ethers.getContract("Comp");
  const delegate = await ethers.getContract("GovernorBravoDelegate");

  await deploy("GovernorBravoDelegator", {
    from: deployer,
    args: [
      timeLock.address,
      comp.address,
      deployer,
      delegate.address,
      600,
      20,
      ethers.utils.parseEther("50000"),
    ],
    log: true,
    deterministicDeployment: false,
    gasLimit: 5000000,
    gasPrice: 60000000000,
  });
};

module.exports.tags = ["GovernorBravoDelegator"];
module.exports.dependencies = ["GovernorBravoDelegate", "Comp", "Timelock"];
