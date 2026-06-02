"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { DitheringShader } from "@/components/ui/dithering-shader";
import { useLeaderboard, useFeedHistory, useSmartMoneyBands } from "@/lib/hooks";
import { smartMoneyDivergence, notableMove, topFinding } from "@/lib/insights";
import { FRIENDLY_CATEGORY } from "@/lib/labels";

export function InsightTeaser() {
  const category = "METH_APR_24H" as const;
  const feed = useFeedHistory(category);
  const bands = useSmartMoneyBands(category);
  useLeaderboard(category); // warms the same query cache used on /insights
  const reducedMotion = useReducedMotion();

  const crowd = feed.data[feed.data.length - 1]?.value ?? null;
  const div = smartMoneyDivergence(bands.data, crowd);
  const move = notableMove(feed.data, 16, 1);
  const headline = topFinding(div, move, FRIENDLY_CATEGORY[category]);

  return (
    <section className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Pixelated moving gradient — chunky 'warp' plasma, deliberately distinct from the hero's fine swirl. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
        <DitheringShader
          fill
          shape="simplex"
          type="4x4"
          pxSize={10}
          colorBack="#050607"
          colorFront="#33EAB3"
          speed={reducedMotion ? 0 : 0.6}
          style={{ opacity: 0.55, mixBlendMode: "screen" }}
        />
      </div>
      {/* Center scrim: darkens the middle so the headline stays legible, leaves the pixel gradient at the edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 50% 46%, var(--color-bg) 0%, color-mix(in srgb, var(--color-bg) 72%, transparent) 36%, transparent 74%)",
        }}
      />

      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev-1)]/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] backdrop-blur-sm">
        <Sparkles size={12} className="text-[var(--color-accent)]" aria-hidden />
        insight of the moment
      </div>
      <p className="max-w-3xl text-[clamp(22px,3.4vw,38px)] font-medium leading-snug tracking-tight text-[var(--color-text)]">
        {headline}
      </p>
      <Link
        href="/insights"
        className="mt-8 inline-flex items-center gap-2 rounded border border-[var(--color-accent)]/40 bg-[color:var(--color-accent)]/8 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-accent)] backdrop-blur-sm transition-colors hover:bg-[color:var(--color-accent)]/15"
      >
        See all AI insights <ArrowUpRight size={14} aria-hidden />
      </Link>
    </section>
  );
}
