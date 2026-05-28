import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { LivePulse } from "@/components/landing/LivePulse";
import { CategoriesShowcase } from "@/components/landing/CategoriesShowcase";
import { ReasoningReveal } from "@/components/landing/ReasoningReveal";
import { LeaderboardPreview } from "@/components/landing/LeaderboardPreview";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { Footer } from "@/components/landing/Footer";
import FlowArt from "@/components/ui/story-scroll";
import type { CSSProperties, ReactNode } from "react";

/**
 * Wrap each existing landing component in the DOM structure that
 * FlowArt's GSAP query selectors expect:
 *
 *   <section data-flow-section>
 *     <div class="flow-art-container">
 *       {children}
 *     </div>
 *   </section>
 *
 * GSAP pins each section at the viewport bottom while the next one
 * rotates in from 30° (bottom-left origin) to 0°. Doesn't impose
 * the demo's flex/padding layout — leaves our existing sections free.
 */
function StoryFrame({
  children,
  label,
  bg = "var(--color-bg)",
}: {
  children: ReactNode;
  label: string;
  bg?: string;
}) {
  const innerStyle: CSSProperties = {
    transformOrigin: "bottom left",
    background: bg,
  };
  return (
    <section
      data-flow-section
      aria-label={label}
      className="relative min-h-screen w-full overflow-hidden"
    >
      <div
        className="flow-art-container relative flex min-h-screen w-full flex-col will-change-transform"
        style={innerStyle}
      >
        {children}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="relative">
      <Nav />
      <FlowArt aria-label="Predictor Index landing">
        <StoryFrame label="Hero">
          <Hero />
        </StoryFrame>
        <StoryFrame label="Composite feed">
          <LivePulse />
        </StoryFrame>
        <StoryFrame label="Categories shipped">
          <CategoriesShowcase />
        </StoryFrame>
        <StoryFrame label="Claude reasoning">
          <ReasoningReveal />
        </StoryFrame>
        <StoryFrame label="Leaderboard preview">
          <LeaderboardPreview />
        </StoryFrame>
        <StoryFrame label="How it works">
          <HowItWorks />
        </StoryFrame>
        <StoryFrame label="FAQ">
          <FaqAccordion />
        </StoryFrame>
        <StoryFrame label="Footer">
          <Footer />
        </StoryFrame>
      </FlowArt>
    </div>
  );
}
