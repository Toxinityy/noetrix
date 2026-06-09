import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

export default function NotFound() {
  return (
    <main
      id="main"
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-20 text-center"
    >
      {/* Faint accent glow, decorative */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(620px 360px at 50% 28%, rgba(51, 234, 179, 0.10), transparent 65%)",
        }}
      />

      {/* Brand mark */}
      <Link href="/" className="group flex items-center gap-2.5">
        <span
          className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]"
          style={{ boxShadow: "0 0 14px var(--color-accent-glow)" }}
        />
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-text)]">
          Noetri<span className="text-[var(--color-accent)]">x</span>
        </span>
      </Link>

      {/* 404 */}
      <h1 className="mt-10 font-mono text-[clamp(64px,16vw,140px)] font-medium leading-none tracking-[0.08em] text-[var(--color-text)]">
        4<span className="text-[var(--color-accent)]">0</span>4
      </h1>

      {/* Fake terminal prompt */}
      <div className="mt-8 w-full max-w-md overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] text-left">
        <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] px-4 py-2">
          <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--color-border-strong)]" />
          <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--color-border-strong)]" />
          <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--color-border-strong)]" />
          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            noetrix · terminal
          </span>
        </div>
        <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-relaxed text-[var(--color-text-dim)]">
          <span className="text-[var(--color-text-muted)]">noetrix:/</span>{" "}
          <span className="text-[var(--color-accent)]">$</span> cat &lt;route&gt;
          {"\n"}
          <span className="text-[var(--color-down)]">→ error: no such route on-chain</span>
        </pre>
      </div>

      {/* Message */}
      <p className="mt-8 max-w-md text-sm leading-relaxed text-[var(--color-text-dim)]">
        This page was never committed. The forecast you&apos;re looking for doesn&apos;t exist on
        the chain. It may have moved, or never been registered.
      </p>

      {/* CTAs */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded border border-[var(--color-accent)]/40 bg-[color:var(--color-accent)]/8 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-accent)] transition-colors hover:bg-[color:var(--color-accent)]/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
        >
          <ArrowLeft size={14} aria-hidden />
          Back to terminal
        </Link>
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-5 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
        >
          Leaderboard
          <ArrowUpRight size={14} aria-hidden />
        </Link>
      </div>

      {/* Footer code line */}
      <div className="mt-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        status 404 · resource not found
      </div>
    </main>
  );
}
