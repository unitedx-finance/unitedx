module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  await deploy("Comptroller", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    autoMine: true,
  });
};

module.exports.tags = ["OnlyComptroller"];
