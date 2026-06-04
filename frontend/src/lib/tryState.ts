/// Linear states for the /try guided panel. Exactly one primary action is shown per state.
export type PanelState = "disconnected" | "wrong-network" | "no-gas" | "ready";

export interface PanelInput {
  isConnected: boolean;
  chainId: number | undefined;
  expectedChainId: number;
  /// Native MNT balance in wei. `undefined` = unknown/loading — treated as ready (advisory, never hard-block).
  balanceWei: bigint | undefined;
}

export function derivePanelState(i: PanelInput): PanelState {
  if (!i.isConnected) return "disconnected";
  if (i.chainId !== i.expectedChainId) return "wrong-network";
  if (i.balanceWei !== undefined && i.balanceWei === BigInt(0)) return "no-gas";
  return "ready";
}
