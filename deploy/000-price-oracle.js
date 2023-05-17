const A3O_WRAPPER = new Map();
A3O_WRAPPER.set("2001", "");
A3O_WRAPPER.set("200101", "0xDf60876c566201086846A1ff19d8853F95178c2F");

module.exports = async function({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("SimplePriceOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    contract: "SimplePriceOracle",
  });

  const chainId = await getChainId();

  await deploy("OracleAggregatorV1", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    contract: "OracleAggregatorV1",
    args: [A3O_WRAPPER.get(chainId)],
  });
};

module.exports.tags = ["PriceOracle"];

module.exports.skip = async () => {
  const chainId = await getChainId();
  if (!A3O_WRAPPER.has(chainId)) {
    console.log("AGGREGATOR_ORACLES address missing: ", chainId);
    return true;
  }
};
