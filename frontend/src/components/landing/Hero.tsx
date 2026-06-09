"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { DitheringShader } from "@/components/ui/dithering-shader";

const TITLE = ["NOETRIX"];

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [hoverable, setHoverable] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Detect hover-capable input device.
  useEffect(() => {
    const mql = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHoverable(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  // Section dims as motion values so derived transforms react to resize.
  const widthMV = useMotionValue(1);
  const heightMV = useMotionValue(1);

  // Raw cursor pixel coords relative to section. Dot uses these directly (instant lead).
  const cursorPxX = useMotionValue(-9999);
  const cursorPxY = useMotionValue(-9999);

  // ONE spring config. Ring + halo + title-parallax all derive from this so they
  // stay locked together visually. Dot remains raw for an intentional "leader" feel.
  const SPRING = { stiffness: 260, damping: 32, mass: 0.55 } as const;
  const sCursorX = useSpring(cursorPxX, SPRING);
  const sCursorY = useSpring(cursorPxY, SPRING);

  // Title parallax — same spring, normalized about section center.
  // Guard the off-screen sentinel (-9999): real in-section coords are always >= 0, so before the
  // first pointer event the offset is 0 and the title renders centered (no jump-to-center on hover).
  const titleX = useTransform([sCursorX, widthMV] as const, ([x, w]) =>
    reduced || (x as number) < 0 ? 0 : ((x as number) / Math.max(1, w as number) - 0.5) * -12,
  );
  const titleY = useTransform([sCursorY, heightMV] as const, ([y, h]) =>
    reduced || (y as number) < 0 ? 0 : ((y as number) / Math.max(1, h as number) - 0.5) * -8,
  );

  // Keep section dims in sync (handles resize + GSAP pin layout shifts).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const update = () => {
      widthMV.set(el.clientWidth || 1);
      heightMV.set(el.clientHeight || 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [widthMV, heightMV]);

  // Track the cursor at the WINDOW level (not a React onMouseMove on the section, which the GSAP
  // z-stacked wrapper could cover). Attached ONCE — hovering lives in a ref so the listener never
  // detaches/re-attaches mid-interaction — and listens to BOTH pointermove and mousemove, since some
  // browser setups/extensions don't deliver pointermove to window (mousemove is the universal
  // fallback). clientX/Y are mapped to hero-local coords via getBoundingClientRect.
  const hoveringRef = useRef(false);
  useEffect(() => {
    if (!hoverable) return;
    const el = sectionRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent | MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;

      if (inside) {
        if (Math.abs(rect.width - widthMV.get()) > 1) widthMV.set(rect.width || 1);
        if (Math.abs(rect.height - heightMV.get()) > 1) heightMV.set(rect.height || 1);
        if (!hoveringRef.current) {
          hoveringRef.current = true;
          // Seed the springs at the entry point so the followers don't fly in from the sentinel.
          sCursorX.jump(x);
          sCursorY.jump(y);
          setHovering(true);
        }
        cursorPxX.set(x);
        cursorPxY.set(y);
      } else if (hoveringRef.current) {
        hoveringRef.current = false;
        setHovering(false);
        // Reset to the sentinel so the title parallax re-centers (guarded transforms return 0).
        cursorPxX.set(-9999);
        cursorPxY.set(-9999);
        sCursorX.jump(-9999);
        sCursorY.jump(-9999);
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("mousemove", onMove);
    };
  }, [hoverable, cursorPxX, cursorPxY, sCursorX, sCursorY, widthMV, heightMV]);

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex min-h-screen w-full flex-1 items-center justify-center overflow-hidden"
      style={{ cursor: hoverable && hovering ? "none" : undefined }}
    >
      {/* Layer 1: ambient WebGL swirl (deepest) */}
      <div className="pointer-events-none absolute inset-0 mask-radial-fade" aria-hidden="true">
        <DitheringShader
          fill
          shape="swirl"
          type="4x4"
          colorBack="#050607"
          colorFront="#33EAB3"
          pxSize={3}
          speed={reduced ? 0 : 0.55}
          style={{ mixBlendMode: "screen", opacity: 0.5 }}
        />
      </div>

      {/* Layer 3: parallax grids */}
      <div className="absolute inset-0 bg-grid mask-radial-fade" />
      <div className="absolute inset-0 bg-grid-fine opacity-30 mask-radial-fade" />

      {/* Layer 4: glow ring */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_var(--color-accent-glow)_0%,_transparent_70%)] opacity-70" />

      {/* Layer 4b: cursor glow halo — a self-contained teal glow that travels with the cursor.
          Unlike the shader-reveal lens (Layer 2), this is visible even over dark regions, so the
          "glow on the cursor" reads everywhere. Same spring as the ring → they move locked together.
          Sits below the title (z-10) so text stays legible; screen-blends additively on the dark bg. */}
      {hoverable ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-[5] h-[440px] w-[440px] rounded-full mix-blend-screen"
          style={{
            x: sCursorX,
            y: sCursorY,
            translateX: "-50%",
            translateY: "-50%",
            opacity: hovering ? 1 : 0,
            transition: "opacity 300ms cubic-bezier(0.22,1,0.36,1)",
            background:
              "radial-gradient(circle, rgba(51,234,179,0.22) 0%, rgba(51,234,179,0.08) 38%, transparent 72%)",
          }}
        />
      ) : null}

      {/* Layer 5: cursor follower ring + dot */}
      {hoverable ? (
        <>
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-30 h-12 w-12 rounded-full border border-[var(--color-accent)] mix-blend-screen"
            style={{
              x: sCursorX,
              y: sCursorY,
              translateX: "-50%",
              translateY: "-50%",
              opacity: hovering ? 1 : 0,
              transition: "opacity 250ms ease-out",
              boxShadow: "0 0 24px var(--color-accent-glow)",
            }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-30 h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
            style={{
              x: cursorPxX,
              y: cursorPxY,
              translateX: "-50%",
              translateY: "-50%",
              opacity: hovering ? 1 : 0,
              transition: "opacity 200ms ease-out",
              boxShadow: "0 0 12px var(--color-accent)",
            }}
          />
        </>
      ) : null}

      {/* Ticker breadcrumb */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
        className="absolute top-28 z-10 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]"
      >
        <span className="h-1 w-1 rounded-full bg-[var(--color-accent)]" />
        <span>The Turing Test Hackathon · Mantle Network</span>
        <span className="h-1 w-1 rounded-full bg-[var(--color-accent)]" />
      </motion.div>

      {/* Title block — subtle magnetic parallax to cursor */}
      <motion.div
        style={{ x: titleX, y: titleY }}
        className="relative z-10 flex max-w-6xl flex-col items-center px-6 text-center"
      >
        <div className="flex flex-col items-center">
          {TITLE.map((word, wIdx) => (
            <h1
              key={word}
              className="flex select-none flex-row text-[clamp(3.2rem,12vw,9.5rem)] font-semibold leading-[0.88] tracking-[-0.045em] text-[var(--color-text)]"
              aria-hidden={reduced ? undefined : true}
              style={{ marginTop: wIdx === 0 ? 0 : "-0.06em" }}
            >
              {word.split("").map((char, cIdx) => (
                <motion.span
                  key={`${word}-${cIdx}`}
                  initial={reduced ? { opacity: 1 } : { opacity: 0, y: 70, filter: "blur(12px)" }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                  whileHover={
                    reduced
                      ? undefined
                      : {
                          y: -8,
                          color: "var(--color-accent)",
                          transition: { duration: 0.25, ease: EASE },
                        }
                  }
                  transition={{
                    duration: 0.95,
                    ease: EASE,
                    delay: 0.2 + (wIdx * word.length + cIdx) * 0.04,
                  }}
                  className={cn(
                    "inline-block cursor-default",
                    wIdx === TITLE.length - 1 && cIdx === word.length - 1 && "text-[var(--color-accent)]",
                  )}
                >
                  {char}
                </motion.span>
              ))}
            </h1>
          ))}
          <span className="sr-only">Noetrix</span>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 1.1 }}
          className="mt-8 max-w-2xl text-balance text-base text-[var(--color-text-dim)] sm:text-lg"
        >
          A live, on-chain leaderboard of AI forecasters. Predictions locked in before the outcome,
          graded against the truth: proof of which AI is actually right.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 1.35 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <motion.a
            href="#start-here"
            whileHover={reduced ? undefined : { scale: 1.04 }}
            whileTap={reduced ? undefined : { scale: 0.98 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="group inline-flex h-11 items-center gap-2 rounded-sm bg-[var(--color-accent)] px-5 font-mono text-xs uppercase tracking-[0.18em] text-black transition-all hover:bg-white hover:shadow-[0_0_30px_var(--color-accent-glow)]"
          >
            Start here
            <span aria-hidden="true" className="transition-transform group-hover:translate-y-0.5">
              ↓
            </span>
          </motion.a>
          <a
            href="/terminal/leaderboard"
            className="group inline-flex h-11 items-center gap-1.5 px-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] underline-offset-4 transition-colors hover:text-[var(--color-text)] hover:underline"
          >
            Enter terminal
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </a>
          <a
            href="#how"
            className="inline-flex h-11 items-center px-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] underline-offset-4 transition-colors hover:text-[var(--color-text)] hover:underline"
          >
            How it works
          </a>
        </motion.div>
      </motion.div>

      {/* Corner meta */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: EASE, delay: 1.4 }}
        className="absolute bottom-12 left-6 hidden flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] sm:flex"
      >
        <span>track · ai alpha &amp; data</span>
        <span>markets · meth + usdy</span>
        <span>scorer · range-crps</span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: EASE, delay: 1.4 }}
        className="absolute bottom-12 right-6 hidden flex-col items-end gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] sm:flex"
      >
        <span>identity · erc-8004</span>
        <span>composite · rank-weighted</span>
        <span>↓ scroll</span>
      </motion.div>
    </section>
  );
}
