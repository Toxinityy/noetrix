// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionGate} from "../src/SubscriptionGate.sol";

/// @notice Standalone deploy of the upgraded SubscriptionGate (paid `subscribe` rail).
///         Does NOT redeploy the rest of the system; existing addresses are untouched. Feed reads
///         stay open (requiresSubscription defaults false), so no CompositeFeed re-wire is needed.
contract DeploySubscriptionGate is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        SubscriptionGate gate = new SubscriptionGate(deployer);
        vm.stopBroadcast();

        console2.log("SubscriptionGate:", address(gate));
        console2.log("owner:", deployer);
        console2.log("proPrice (wei):", gate.proPrice());
        console2.log("protocolPrice (wei):", gate.protocolPrice());
    }
}
