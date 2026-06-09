import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export type AgentMode = "seed" | "normal";

export interface AgentState {
  mode: AgentMode;
  /// Unix seconds when seed mode began. Used for the 48h auto-flip fallback.
  seedStartTimestamp: number;
}

// Namespaced by STRATEGY so all four strategies can run as separate processes from one package dir
// without clobbering each other's seed/normal state.
const STATE_PATH = resolve(process.cwd(), `agent.state.${process.env.STRATEGY ?? "default"}.json`);

export function loadState(): AgentState {
  if (existsSync(STATE_PATH)) {
    try {
      return JSON.parse(readFileSync(STATE_PATH, "utf8")) as AgentState;
    } catch {
      /* fall through to fresh state */
    }
  }
  const fresh: AgentState = { mode: "seed", seedStartTimestamp: Math.floor(Date.now() / 1000) };
  saveState(fresh);
  return fresh;
}

export function saveState(state: AgentState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}
