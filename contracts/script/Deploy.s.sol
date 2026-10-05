// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BlueMango.sol";

/// @notice Deploy BlueMango. Set USDG_TOKEN env to the USDG address.
///         Usage: USDG_TOKEN=0x... forge script script/Deploy.s.sol --rpc-url <rpc> --broadcast
contract DeployBlueMango is Script {
    function run() external returns (BlueMango) {
        address usdg = vm.envAddress("USDG_TOKEN");
        vm.startBroadcast();
        BlueMango bm = new BlueMango(usdg);
        vm.stopBroadcast();
        console.log("BlueMango deployed at:", address(bm));
        console.log("USDG:", usdg);
        return bm;
    }
}
