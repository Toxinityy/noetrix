"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { ShieldCheck, ShieldAlert, ShieldX, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";

type Decision = "ALLOW" | "REVIEW" | "DENY";
type CheckStatus = "pass" | "warn" | "fail";
interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}
interface ScreenResult {
  decision: Decision;
  checks: Check[];
  memo: string;
  riskState: number;
  asset: string;
  amountUsd: number;
}

const CLEAN_EXAMPLE = "0x23015eEb4CDDBF71be80ea4259B5a32Cf1b60e60";
const SANCTIONED_EXAMPLE = "0x722122dF12D4e14e13Ac3b6895a86e84145b6967";

const DECISION_UI: Record<Decision, { tone: "up" | "warn" | "down"; label: string; Icon: typeof ShieldCheck }> = {
  ALLOW: { tone: "up", label: "Approved", Icon: ShieldCheck },
  REVIEW: { tone: "warn", label: "Manual review", Icon: ShieldAlert },
  DENY: { tone: "down", label: "Blocked", Icon: ShieldX },
};

const CHECK_ICON: Record<CheckStatus, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
};
const CHECK_COLOR: Record<CheckStatus, string> = {
  pass: "var(--color-up)",
  warn: "var(--color-warn)",
  fail: "var(--color-down)",
};

export function ComplianceClient() {
  const { address: wallet } = useAccount();
  const [address, setAddress] = React.useState("");
  const [amount, setAmount] = React.useState("25000");
  const [asset, setAsset] = React.useState<"meth" | "usdy">("usdy");
  const [kyc, setKyc] = React.useState(true);
  const [result, setResult] = React.useState<ScreenResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run(addr: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr.trim(), amountUsd: Number(amount) || 0, asset, kycVerified: kyc }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "screen failed");
      setResult(json as ScreenResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
          AI x RWA · compliance
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Deposit compliance screen</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-dim)]">
          An AI-assisted screen a vault runs at its deposit edge before accepting tokenized-RWA flow. It combines
          sanctions/AML screening, the asset&apos;s KYC / transfer-restriction rules, the live on-chain{" "}
          <span className="text-[var(--color-text)]">AI risk-state</span> (our forecast engine), and transaction
          monitoring — then an AI writes the recommendation. Also callable by agents at{" "}
          <code className="text-[var(--color-accent)]">/api/compliance</code>.
        </p>
      </header>

      <Panel elevation={1}>
        <PanelHeader caption="Screen a deposit" title="Prospective depositor" />
        <PanelBody className="space-y-4 pt-3">
          <div>
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
              Depositor address
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x…"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            />
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {wallet ? (
                <button onClick={() => setAddress(wallet)} className="rounded border border-[var(--color-border)] px-2 py-1 text-[var(--color-text-dim)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">
                  use my wallet
                </button>
              ) : null}
              <button onClick={() => setAddress(CLEAN_EXAMPLE)} className="rounded border border-[var(--color-border)] px-2 py-1 text-[var(--color-text-dim)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">
                example: clean address
              </button>
              <button onClick={() => setAddress(SANCTIONED_EXAMPLE)} className="rounded border border-[var(--color-border)] px-2 py-1 text-[var(--color-text-dim)] hover:border-[var(--color-down)] hover:text-[var(--color-down)]">
                example: sanctioned address
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                Deposit amount (USD)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                Asset
              </label>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value as "meth" | "usdy")}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              >
                <option value="usdy">USDY (tokenized Treasuries · KYC-gated)</option>
                <option value="meth">mETH (liquid staking · permissionless)</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-[var(--color-text-dim)]">
            <input type="checkbox" checked={kyc} onChange={(e) => setKyc(e.target.checked)} className="accent-[var(--color-accent)]" />
            Holder is KYC-verified / allow-listed (required for USDY)
          </label>

          <button
            onClick={() => run(address)}
            disabled={loading || !address.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2 font-mono text-[13px] font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {loading ? "Screening…" : "Run compliance screen"}
          </button>
          {error ? <p className="text-[12px] text-[var(--color-down)]">{error}</p> : null}
        </PanelBody>
      </Panel>

      {result ? (
        <div className="mt-5">
          <Panel elevation={2}>
            <PanelHeader
              caption="Decision"
              title={`${result.asset.toUpperCase()} deposit · $${result.amountUsd.toLocaleString("en-US")}`}
              right={<StatusPill tone={DECISION_UI[result.decision].tone}>{DECISION_UI[result.decision].label}</StatusPill>}
            />
            <PanelBody className="space-y-4 pt-3">
              <div className="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                {React.createElement(DECISION_UI[result.decision].Icon, {
                  size: 20,
                  style: { color: `var(--color-${DECISION_UI[result.decision].tone})` },
                  "aria-hidden": true,
                })}
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">AI compliance memo</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--color-text)]">{result.memo}</p>
                </div>
              </div>

              <ul className="space-y-2">
                {result.checks.map((c) => {
                  const Icon = CHECK_ICON[c.status];
                  return (
                    <li key={c.id} className="flex items-start gap-2.5">
                      <Icon size={15} style={{ color: CHECK_COLOR[c.status], marginTop: 2 }} aria-hidden />
                      <div>
                        <span className="text-[13px] text-[var(--color-text)]">{c.label}</span>
                        <p className="text-[12px] leading-relaxed text-[var(--color-text-dim)]">{c.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="border-t border-[var(--color-border)] pt-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                Testnet demo. Sanctions screening uses a sample OFAC SDN set (production swaps in Chainalysis / TRM / a
                live OFAC feed behind the same boundary); the AI risk-state is read live from the on-chain RiskManager.
                Advisory only — no funds move here.
              </p>
            </PanelBody>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
