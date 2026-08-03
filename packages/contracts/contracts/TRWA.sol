// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Tokenized Real-World Asset
/// @notice A fixed-supply demo token. Application-level compliance is enforced outside this contract.
contract TRWA is ERC20 {
    uint256 public constant FIXED_SUPPLY = 1_000_000 ether;

    error ZeroTreasury();

    constructor(address treasury) ERC20("Tokenized Real-World Asset", "TRWA") {
        if (treasury == address(0)) revert ZeroTreasury();
        _mint(treasury, FIXED_SUPPLY);
    }
}
