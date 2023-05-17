const USDC = new Map();
USDC.set("2001", "");
USDC.set("200101", "0x8c214Fa17D0167675C238F4d4142C4eEeC04f54f");

const USDC_PRICE_FEED = new Map();
USDC_PRICE_FEED.set("2001", "0xa24de01df22b63d23Ebc1882a5E3d4ec0d907bFB");
USDC_PRICE_FEED.set("200101", "0xF096872672F44d6EBA71458D74fe67F9a77a23B9");

module.exports = async function({ getChainId, getNamedAccounts, deployments }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();

  const Comptroller = await ethers.getContract("Comptroller");
  const unitroller = await ethers.getContract("Unitroller");
  const comptroller = Comptroller.attach(unitroller.address);

  const interestRateModel = await ethers.getContract("StableJumpRateModel");
  const xUsdcDelegate = await ethers.getContract("CErc20Delegate");

  const deployment = await deploy("XUsdcDelegator", {
    from: deployer,
    args: [
      USDC.get(chainId),
      comptroller.address,
      interestRateModel.address,
      ethers.utils.parseUnits("1", 18),
      "UnitedX USD coin",
      "xUSDC",
      8,
      deployer,
      xUsdcDelegate.address,
      "0x"
    ],
    log: true,
    deterministicDeployment: false,
    contract: "CErc20Delegator"
  });
  await deployment.receipt;

  const xUsdcDelegator = await ethers.getContract("XUsdcDelegator");
  console.log("Supporting xUSDC market...");
  await comptroller._supportMarket(xUsdcDelegator.address, {
    gasLimit: 2000000
  });

  const priceOracle = await ethers.getContract("SimplePriceOracle");
  console.log("Setting price feed source for xUSDC ");
  await priceOracle.setUnderlyingPrice(
    xUsdcDelegator.address,
    ethers.utils.parseUnits("0.99", 18)
  );

  const collateralFactor = "0.80";
  console.log("Setting collateral factor ", collateralFactor);
  await comptroller._setCollateralFactor(
    xUsdcDelegator.address,
    ethers.utils.parseEther(collateralFactor)
  );

  const reserveFactor = "0.15";
  console.log("Setting reserve factor ", reserveFactor);
  await xUsdcDelegator._setReserveFactor(
    ethers.utils.parseEther(reserveFactor)
  );
};

module.exports.tags = ["xUSDC"];
module.exports.dependencies = [
  "Comptroller",
  "JumpRateModel",
  "PriceOracle",
  "CErc20Delegate"
];

module.exports.skip = async () => {
  const chainId = await getChainId();
  if (!USDC.has(chainId)) {
    console.log("USDC address missing");
    return true;
  }
};
