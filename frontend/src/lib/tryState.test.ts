import { describe, it, expect } from "vitest";
import { derivePanelState } from "./tryState";

const base = { isConnected: true, chainId: 5003, expectedChainId: 5003, balanceWei: BigInt(1) };

describe("derivePanelState", () => {
  it("disconnected when no wallet connected", () => {
    expect(derivePanelState({ ...base, isConnected: false })).toBe("disconnected");
  });
  it("wrong-network when chainId mismatches", () => {
    expect(derivePanelState({ ...base, chainId: 1 })).toBe("wrong-network");
  });
  it("wrong-network when chainId is undefined", () => {
    expect(derivePanelState({ ...base, chainId: undefined })).toBe("wrong-network");
  });
  it("no-gas when balance is exactly zero", () => {
    expect(derivePanelState({ ...base, balanceWei: BigInt(0) })).toBe("no-gas");
  });
  it("ready when connected, right network, positive balance", () => {
    expect(derivePanelState(base)).toBe("ready");
  });
  it("ready when balance is unknown (advisory, never hard-block)", () => {
    expect(derivePanelState({ ...base, balanceWei: undefined })).toBe("ready");
  });
});
