// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.10;

import "./PriceOracle.sol";
import "./A3WrapperInterface.sol";

/**
 * @title UnitedX Price Oracle Aggregator Contract
 * @author 0xphen
 */
contract OracleAggregatorV1 is PriceOracle {
    struct SourceData {
        address source;
        bytes data;
        uint baseUnit;
    }

    /**
    * @notice Administrator for this contract
    */
    address public admin;

    /**
    * @notice Pending administrator for this contract
    */
    address public pendingAdmin;

    mapping(address => SourceData) public aggregators;

    /**
    * @notice Emitted when new source is added
    */
    event NewAggregator(address indexed cToken, address indexed source, bytes indexed data, uint baseUnit);

    /**
    * @notice Emitted when pendingAdmin is changed
    */
    event NewPendingAdmin(address oldPendingAdmin, address newPendingAdmin);

    /**
    * @notice Emitted when pendingAdmin is accepted, which means admin is updated
    */
    event NewAdmin(address oldAdmin, address newAdmin);

    constructor(A3WrapperInterface _oracle) {
        // accept the ToS in the A3 oracle wrapper before we can read ADA price
        _oracle.acceptTermsOfService();
        admin = msg.sender;
    }


/**
 * @notice Add new sources for markets
 * @param _ctokenAddresses The list of addresses of the cToken markets to be added
 * @param _sources The list of sources to read price data from for cTokens `_ctokenAddresses`
 * @param _datas The list of encoded function signatures corresponding to functions in `_sources`
 * @param _datas The list of base units (amount of the smallest denomination of that asset per whole) for underlying tokens
 */
    function setAggregators(
        CToken[] calldata _ctokenAddresses,
        address[] memory _sources,
        bytes[] calldata _datas,
        uint[] memory _baseUnits
    ) external {
        require(msg.sender == admin, "Unauthorized caller");
        require(
            _ctokenAddresses.length == _sources.length 
            && _ctokenAddresses.length == _datas.length 
            && _ctokenAddresses.length == _baseUnits.length,
            "mismatched data"
        );

        for (uint256 i = 0; i < _sources.length;) {
            require(_sources[i] != address(0), "invalid source");

            aggregators[address(_ctokenAddresses[i])] = SourceData({
                source: _sources[i],
                data: _datas[i],
                baseUnit: _baseUnits[i]
            });

            emit NewAggregator(address(_ctokenAddresses[i]), _sources[i], _datas[i], _baseUnits[i]);

             unchecked {
               i++;
            }
        }
    }

    /**
     * @dev A  price oracle contract must implement the `getUnderlyingPrice` function. Used
     *      to get the underlying price of an asset
     * @param cToken The cToken to get the underlying price of
     */    
    function getUnderlyingPrice(CToken cToken) external view override returns (uint) {
        SourceData memory sourceData = aggregators[address(cToken)];
        require(sourceData.source != address(0), "Invalid source");

        uint price = _getUnderlyingPrice(sourceData.source, sourceData.data);
        require(price > 0, "Invalid price");

        // Comptroller needs prices in the format: ${raw price} * 1e36 / baseUnit
        // The baseUnit of an asset is the amount of the smallest denomination of that asset per whole.
        // For example, the baseUnit of MADA is 1e18.
        // Since we assume the prices from Oracles have 18 decimals, we must scale them by 1e(36 - 18)/baseUnit
        return (price * 1e18) / sourceData.baseUnit;
    }

       /**
      * @notice Begins transfer of admin rights. The newPendingAdmin must call `_acceptAdmin` to finalize the transfer.
      * @dev Admin function to begin change of admin. The newPendingAdmin must call `_acceptAdmin` to finalize the transfer.
      * @param newPendingAdmin New pending admin.
      */
    function setPendingAdmin(address newPendingAdmin) public {
        // Check caller = admin
       require(msg.sender == admin, "Unauthorized caller");

        // Save current value, if any, for inclusion in log
        address oldPendingAdmin = pendingAdmin;

        // Store pendingAdmin with value newPendingAdmin
        pendingAdmin = newPendingAdmin;

        // Emit NewPendingAdmin(oldPendingAdmin, newPendingAdmin)
        emit NewPendingAdmin(oldPendingAdmin, newPendingAdmin);
    }

      /**
      * @notice Accepts transfer of admin rights. msg.sender must be pendingAdmin
      * @dev Admin function for pending admin to accept role and update admin
      */
    function acceptAdmin() public {
        // Check caller is pendingAdmin and pendingAdmin ≠ address(0)
        require(msg.sender == pendingAdmin, "Unauthorized caller");

        // Save current values for inclusion in log
        address oldAdmin = admin;
        address oldPendingAdmin = pendingAdmin;

        // Store admin with value pendingAdmin
        admin = pendingAdmin;

        // Clear the pending value
        pendingAdmin = address(0);

        emit NewAdmin(oldAdmin, admin);
        emit NewPendingAdmin(oldPendingAdmin, pendingAdmin);
    }

    /**
     * @notice Internal function to get the underlying price of an asset
     * @param _source The address to read the price data
     * @param _data The encoded function signature in `_source` - price is read 
     *              via this function
     */  
    function _getUnderlyingPrice(
        address _source,
        bytes memory _data
    ) internal view returns (uint256) {
        (bool success, bytes memory returndata) = _source.staticcall(_data);
        require(success, "falied to read price");

        return abi.decode(returndata, (uint256));
    }
}
