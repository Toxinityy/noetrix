// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RiskManager} from "../src/examples/RiskManager.sol";
import {ICompositeFeed} from "../src/interfaces/ICompositeFeed.sol";

/// @notice Standalone RiskManager redeploy against the EXISTING CompositeFeed (feed untouched).
///         Re-registers the two RWA assets with the same params as Deploy.s.sol.
///         Env: PRIVATE_KEY (deployer), COMPOSITE_FEED (existing feed address).
contract RedeployRiskManager is Script {
    bytes32 constant METH_APR_24H = keccak256("METH_APR_24H");
    bytes32 constant USDY_APY_24H = keccak256("USDY_APY_24H");
    uint256 constant ASSET_MAX_CAP = 1_000_000_000 * 1e8; // $1B, 8-dec

    function run() external {
        address feed = vm.envAddress("COMPOSITE_FEED");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        RiskManager rm = new RiskManager(ICompositeFeed(feed), deployer);
        rm.registerAsset(METH_APR_24H, 8_000, ASSET_MAX_CAP); // 80% baseCf
        rm.registerAsset(USDY_APY_24H, 9_000, ASSET_MAX_CAP); // 90% baseCf (stablecoin)
        vm.stopBroadcast();

        console2.log("RiskManager (new):", address(rm));
        console2.log("feed:", feed);
        console2.log("CONF_FLOOR_BPS:", uint256(rm.CONF_FLOOR_BPS()));
        console2.log("USDY riskState (0=Normal 1=Caution 2=Frozen):", uint256(rm.riskState(USDY_APY_24H)));
    }
}
