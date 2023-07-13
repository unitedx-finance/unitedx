// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.10;

import "./EIP20Interface.sol";

/**
 * @title CompLock Contract
 * @notice Transfers a token to a different address after certain time has passed.
 * @author 0xMiniPanda
 */
contract CompLock {
  /// @notice Reference to token to transfer (immutable)
  EIP20Interface public token;

  /// @notice Target to receive transferred tokens (immutable)
  address public target;

  /// @notice Timestamp after which the transfer can be initiated
  uint public lockTime;

  /**
    * @notice Constructs a CompLock
    * @param token_ The token to drip
    * @param target_ The recipient of dripped tokens
    * @param lockTime_ Lock time in seconds, will be added to current block timestamp
    */
  constructor(EIP20Interface token_, address target_, uint lockTime_) {
    token = token_;
    target = target_;
    lockTime = block.timestamp + lockTime_;
  }

  /**
    * @notice Drips the maximum amount of tokens to match the drip rate since inception
    * @dev Note: this will only drip up to the amount of tokens available.
    * @return The amount of tokens transferred in this call
    */
  function transfer() public returns (uint) {
    // First, read storage into memory
    EIP20Interface token_ = token;
    uint reservoirBalance_ = token_.balanceOf(address(this));
    address target_ = target;
    
    require(block.timestamp >= lockTime, "unlock time not reached yet");

    // Transfer the tokens
    token_.transfer(target_, reservoirBalance_);
    return reservoirBalance_;
  }
}