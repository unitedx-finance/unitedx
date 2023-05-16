module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("StableJumpRateModel", {
    from: deployer,
    args: [0, "50000000000000000", "1090000000000000000", "800000000000000000"],
    log: true,
    deterministicDeployment: false,
    contract: "JumpRateModel",
  });

  await deploy("NativeJumpRateModel", {
    contract: "JumpRateModel",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [0, "40000000000000000", "1080000000000000000", "700000000000000000"],
  });
};

module.exports.tags = ["JumpRateModel"];
