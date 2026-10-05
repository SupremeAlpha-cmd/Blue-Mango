// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MockUSDG.sol";
import "../src/BlueMango.sol";

/// @notice Testnet deploy: mock USDG + BlueMango.
///         Usage: forge script script/DeployTestnet.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com --broadcast
contract DeployBlueMangoTestnet is Script {
    function run() external returns (MockUSDG usdg, BlueMango bm) {
        vm.startBroadcast();
        usdg = new MockUSDG();
        bm = new BlueMango(address(usdg));
        // Seed the deployer with test USDG for end-to-end trials.
        usdg.mint(msg.sender, 1_000_000 ether);
        vm.stopBroadcast();
        console.log("MockUSDG deployed at:", address(usdg));
        console.log("BlueMango deployed at:", address(bm));
    }
}
