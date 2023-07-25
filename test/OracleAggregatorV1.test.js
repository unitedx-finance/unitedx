const { ethers } = require("hardhat");
const { expect } = require("chai");
const OracleValueInverterABI = require("./abi/OracleValueInverter.json");

const A3O_WRAPPER = "0xDf60876c566201086846A1ff19d8853F95178c2F";
const XUSDC = "0x20824b2A5064802ee5E2F8AcF9947c4A3F2B60F1";
const USDC = "0x8c214Fa17D0167675C238F4d4142C4eEeC04f54f";
const XMADA = "0x173410946E08b68E638b43A715A0bE342babDd0f";
const USDCDecimals = 6;
const MADADecimals = 18;

const USDC_PRICE = ethers.utils.parseUnits("1", 18);

describe("OracleAggregatorV1", function() {
  let admin, random;
  let oracleAggregatorV1, simpleOracle, a3oWrapper, xMADA, xUSDC;

  const readDataCallData = () => {
    const ABI = ["function readData()"];
    let iface = new ethers.utils.Interface(ABI);
    return iface.encodeFunctionData("readData", []);
  };

  const assetPricesCallData = (asset) => {
    const ABI = ["function assetPrices(address asset)"];
    let iface = new ethers.utils.Interface(ABI);
    return iface.encodeFunctionData("assetPrices", [asset]);
  };

  beforeEach(async () => {
    [admin, random] = await ethers.getSigners();

    const OracleAggregatorV1 = await ethers.getContractFactory(
      "OracleAggregatorV1"
    );

    a3oWrapper = await ethers.getContractAt(
      OracleValueInverterABI,
      A3O_WRAPPER
    );
    await a3oWrapper.acceptTermsOfService();

    const SimpleOracle = await ethers.getContractFactory("SimplePriceOracle");

    const CErc20Delegate = await ethers.getContractFactory("CErc20Delegate");
    xUSDC = await CErc20Delegate.attach(XUSDC);

    const XMada = await ethers.getContractFactory("CEther");
    xMADA = await XMada.attach(XMADA);

    // Deploying OracleAggregatorV1 and SimplePriceOracle contractS
    oracleAggregatorV1 = await OracleAggregatorV1.deploy(A3O_WRAPPER);
    await oracleAggregatorV1.deployed();

    simpleOracle = await SimpleOracle.deploy();
    await simpleOracle.deployed();

    await simpleOracle.setUnderlyingPrice(xUSDC.address, USDC_PRICE);

    expect(Number(await simpleOracle.assetPrices(USDC))).to.equal(
      Number(USDC_PRICE)
    );
  });

  const setAggregators = async (signer) => {
    await oracleAggregatorV1
      .connect(signer || admin)
      .setAggregators(
        [xUSDC.address, xMADA.address],
        [simpleOracle.address, a3oWrapper.address],
        [assetPricesCallData(USDC), readDataCallData()],
        [
          ethers.utils.parseUnits("1", USDCDecimals),
          ethers.utils.parseUnits("1", MADADecimals),
        ]
      );
  };

  it("Admin can set sources", async () => {
    await setAggregators();

    expect(
      (await oracleAggregatorV1.aggregators(xUSDC.address)).source
    ).to.equal(simpleOracle.address);

    expect((await oracleAggregatorV1.aggregators(xUSDC.address)).data).to.equal(
      assetPricesCallData(USDC)
    );

    expect(
      (await oracleAggregatorV1.aggregators(xMADA.address)).source
    ).to.equal(a3oWrapper.address);

    expect((await oracleAggregatorV1.aggregators(xMADA.address)).data).to.equal(
      readDataCallData()
    );
  });

  it("Non-admin cannot set aggregators", async () => {
    await expect(setAggregators(random)).to.be.revertedWith(
      "Unauthorized caller"
    );
  });

  it("Can read underlying prices", async () => {
    await setAggregators();

    expect(await oracleAggregatorV1.getUnderlyingPrice(xUSDC.address)).to.equal(
      USDC_PRICE.mul(ethers.utils.parseUnits("1", 18 - USDCDecimals))
    );

    expect(await oracleAggregatorV1.getUnderlyingPrice(xMADA.address)).to.equal(
      (await a3oWrapper.readData()).mul(
        ethers.utils.parseUnits("1", 18 - MADADecimals)
      )
    );
  });

  it("Admin can set pending admin, and pending admin can accept admin", async () => {
    expect(await oracleAggregatorV1.admin()).to.equal(admin.address);
    expect(await oracleAggregatorV1.pendingAdmin()).to.equal(
      "0x0000000000000000000000000000000000000000"
    );

    await oracleAggregatorV1.setPendingAdmin(random.address);
    expect(await oracleAggregatorV1.pendingAdmin()).to.equal(random.address);
    expect(await oracleAggregatorV1.admin()).to.equal(admin.address);

    await oracleAggregatorV1.connect(random).acceptAdmin();
    expect(await oracleAggregatorV1.pendingAdmin()).to.equal(
      "0x0000000000000000000000000000000000000000"
    );
    expect(await oracleAggregatorV1.admin()).to.equal(random.address);
  });

  it("Only PendingAdmin can accept admin", async () => {
    await oracleAggregatorV1.setPendingAdmin(random.address);
    await expect(
      oracleAggregatorV1.connect(admin).acceptAdmin()
    ).to.be.revertedWith("Unauthorized caller");
  });
});
