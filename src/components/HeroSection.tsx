"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import ShinyText from "./ShinyText";
import { hyperspeedPresets } from "./Hyperspeed";

const Hyperspeed = dynamic(() => import("./Hyperspeed"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  ),
});

export function HeroSection() {
  const effectOptions = useMemo(() => hyperspeedPresets.one, []);

  const scrollToDashboard = () => {
    document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      {/* Hyperspeed background */}
      <div className="absolute inset-0 z-0">
        <Hyperspeed effectOptions={effectOptions} />
      </div>

      {/* Gradient overlay for text readability - pointer-events-none so clicks reach Hyperspeed */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none bg-gradient-to-b from-background/80 via-background/50 to-background"
        aria-hidden
      />

      {/* Content overlay - pointer-events-none so clicks reach Hyperspeed; Button has pointer-events-auto */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pointer-events-none">
        <h1 className="text-center text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          <ShinyText
            text="Hackathon Evaluator"
            speed={2}
            delay={0}
            color="#d1d5db"
            shineColor="#ffffff"
            spread={120}
            direction="left"
            yoyo={false}
            pauseOnHover={false}
          />
        </h1>
        <p className="mt-4 max-w-md text-center text-lg text-muted-foreground">
          AI-powered project evaluation
        </p>
        <Button
          size="lg"
          className="mt-8 gap-2 pointer-events-auto"
          onClick={scrollToDashboard}
        >
          Get Started
        </Button>
      </div>
    </section>
  );
}
