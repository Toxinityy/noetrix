import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const STATE_FILE = resolve(process.cwd(), "resolver.state.json");

export interface ResolverState {
  /// Lowest predictionId not yet known to be in a terminal state (Resolved/Cancelled/Forfeited).
  /// The scan starts here each tick so it doesn't re-read finalized predictions forever.
  cursor: number;
}

export function loadState(): ResolverState {
  if (existsSync(STATE_FILE)) {
    try {
      const s = JSON.parse(readFileSync(STATE_FILE, "utf8")) as ResolverState;
      if (typeof s.cursor === "number" && s.cursor >= 1) return s;
    } catch {
      /* fall through to default */
    }
  }
  return { cursor: 1 };
}

export function saveState(state: ResolverState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
