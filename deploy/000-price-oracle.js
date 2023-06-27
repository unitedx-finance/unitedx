const A3O_WRAPPER = new Map();
A3O_WRAPPER.set("2001", "0x49484Ae8646C12A8A68DfE2c978E9d4Fa5b01D16");
A3O_WRAPPER.set("200101", "0x2a16a70E71D2C6f07F02b221B441a2e35E3d0848");

module.exports = async function({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = await getChainId();

  await deploy("SimplePriceOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    contract: "SimplePriceOracle",
    // gasLimit: 7000000,
    // gasPrice: 120000000000,
  });

  await deploy("OracleAggregatorV1", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    contract: "OracleAggregatorV1",
    args: [A3O_WRAPPER.get(chainId)],
    // gasLimit: 5000000,
    // gasPrice: 90000000000,
  });
};

module.exports.tags = ["PriceOracle"];

module.exports.skip = async () => {
  const chainId = await getChainId();
  if (!A3O_WRAPPER.has(chainId)) {
    console.log(`A3O_WRAPPER address missing for network ${chainId}`);
    return true;
  }
};
