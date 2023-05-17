// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.10;

interface A3WrapperInterface {
    function readData() external view returns (uint256);

    function acceptTermsOfService() external;
}