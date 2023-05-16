module.exports = async function({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("Comp", {
    from: deployer,
    args: [deployer],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["Comp"];
