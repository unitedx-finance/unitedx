module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("Timelock", {
    from: deployer,
    args: [deployer, 100],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["Timelock"];
