// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { TRWA } from "../contracts/TRWA.sol";

interface Vm {
    function envAddress(string calldata name) external view returns (address value);
    function envString(string calldata name) external view returns (string memory value);
    function envUint(string calldata name) external view returns (uint256 value);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Run with MONAD_RPC_URL supplied to Forge's --rpc-url argument.
contract DeployTRWA {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    error ChainIdMismatch(uint256 expected, uint256 connected);
    error MissingRpcUrl();

    event TRWADeployed(address indexed contractAddress);

    function run() external returns (TRWA token) {
        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address treasury = vm.envAddress("TRWA_TREASURY_ADDRESS");
        uint256 expectedChainId = vm.envUint("MONAD_CHAIN_ID");
        string memory rpcUrl = vm.envString("MONAD_RPC_URL");

        if (bytes(rpcUrl).length == 0) revert MissingRpcUrl();

        if (block.chainid != expectedChainId) {
            revert ChainIdMismatch(expectedChainId, block.chainid);
        }

        vm.startBroadcast(privateKey);
        token = new TRWA(treasury);
        vm.stopBroadcast();

        emit TRWADeployed(address(token));
    }
}
