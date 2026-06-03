import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export type AgentMode = "seed" | "normal";

export interface AgentState {
  mode: AgentMode;
  /// Unix seconds when seed mode began. Drives the 48h auto-flip fallback (§8.2/§8.3).
  seedStartTimestamp: number;
}

const STATE_PATH = resolve(process.cwd(), "agent.state.json");

export function loadState(): AgentState {
  if (existsSync(STATE_PATH)) {
    try {
      return JSON.parse(readFileSync(STATE_PATH, "utf8")) as AgentState;
    } catch {
      /* fall through */
    }
  }
  const fresh: AgentState = { mode: "seed", seedStartTimestamp: Math.floor(Date.now() / 1000) };
  saveState(fresh);
  return fresh;
}

export function saveState(state: AgentState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}
