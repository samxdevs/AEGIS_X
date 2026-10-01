"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { layers } from "@/lib/content";
import { Eyebrow, Lead, SectionTitle } from "@/components/ui/bits";
import { cn } from "@/lib/utils";

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={dir === "next" ? "M6 3.5 10.5 8 6 12.5" : "M10 3.5 5.5 8 10 12.5"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The four layers, shown against one persistent schematic: the selected layer
 * lights up and the others recede, so the whole system stays on screen.
 *
 * Driven as a carousel — rail, arrows, arrow keys and swipe all move the same
 * index, and it wraps at both ends.
 */
export function LayerStack() {
  const [active, setActive] = useState(1);
  const reduced = useReducedMotion();
  const count = layers.items.length;
  const cur = layers.items[active];

  // Autoplay advances the carousel on its own, but yields to the reader:
  // it pauses under the pointer or keyboard focus, holds while off screen,
  // and stops for good the moment someone takes control.
  const [autoplay, setAutoplay] = useState(true);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (delta: number) => {
      setAutoplay(false);
      setActive((i) => (i + delta + count) % count);
    },
    [count]
  );

  const pick = useCallback((i: number) => {
    setAutoplay(false);
    setActive(i);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      threshold: 0.35,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !autoplay || paused || !inView) return;
    const t = window.setInterval(() => setActive((i) => (i + 1) % count), 6000);
    return () => window.clearInterval(t);
  }, [reduced, autoplay, paused, inView, count]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  };

  // touch swipe: horizontal intent only, so vertical page scroll is untouched
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };
  const dim = (i: number) => (i === active ? 1 : 0.3);
  const ring = (i: number) => (i === active ? "var(--primary)" : "transparent");

  return (
    <section id="system" className="bg-muted px-6 py-20 md:px-16 md:py-[88px]">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <Eyebrow>{layers.eyebrow}</Eyebrow>
            <SectionTitle className="mt-5" lines={layers.headline} />
          </div>
          <Lead className="max-w-[520px] lg:mb-2">{layers.sub}</Lead>
        </div>

        <div
          ref={rootRef}
          role="group"
          aria-roledescription="carousel"
          aria-label="The four layers"
          onKeyDown={onKeyDown}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          className="mt-11 overflow-hidden rounded-xl border border-border bg-background shadow-xl"
        >
          <div className="flex h-10 items-center gap-3.5 border-b border-border bg-muted px-4">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
            </div>
            <span className="hidden font-mono text-[11px] tracking-[0.05em] text-muted-foreground sm:inline">
              aegis · system view · offline
            </span>

            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[10.5px] tracking-[0.08em] text-fg-subtle">
                {String(active + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous layer"
                className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-accent hover:bg-secondary hover:text-secondary-foreground"
              >
                <Chevron dir="prev" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next layer"
                className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-accent hover:bg-secondary hover:text-secondary-foreground"
              >
                <Chevron dir="next" />
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-[262px_minmax(0,1fr)]">
            {/* layer rail */}
            <div className="border-b border-border bg-muted p-3 lg:border-b-0 lg:border-r">
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                {layers.items.map((l, i) => {
                  const on = i === active;
                  return (
                    <button
                      key={l.title}
                      type="button"
                      onClick={() => pick(i)}
                      aria-pressed={on}
                      className={cn(
                        "flex gap-3 rounded-md border p-3.5 text-left transition-colors",
                        on
                          ? "border-accent bg-secondary"
                          : "border-transparent hover:bg-background/60"
                      )}
                    >
                      <span
                        className={cn("mt-1.5 size-[7px] shrink-0", on ? "bg-primary" : "bg-border")}
                      />
                      <span className="flex-1">
                        <span
                          className={cn(
                            "block font-mono text-[9.5px] tracking-[0.1em]",
                            on ? "text-primary" : "text-fg-faint"
                          )}
                        >
                          {l.kicker}
                        </span>
                        <span
                          className={cn(
                            "mt-1 block text-[15px] font-semibold tracking-tight",
                            on ? "text-foreground" : "text-fg-subtle"
                          )}
                        >
                          {l.title}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mx-1.5 mt-3.5 border-t border-border pt-3.5">
                <div className="font-mono text-[9.5px] tracking-[0.1em] text-fg-subtle">
                  {layers.aside.kicker}
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
                  {layers.aside.body}
                </p>
              </div>
            </div>

            {/* schematic + detail */}
            <div className="p-6">
              <svg viewBox="0 0 1000 318" className="block h-auto w-full" aria-hidden="true">
                <rect
                  x="0"
                  y="0"
                  width="1000"
                  height="318"
                  rx="10"
                  fill="oklch(0.9800 0.0120 147.6)"
                  stroke="var(--accent)"
                />
                <rect x="1" y="236" width="998" height="81" fill="var(--secondary)" />
                <path d="M0 236 H1000" stroke="var(--accent)" strokeWidth="1.5" />
                <g opacity=".7">
                  <path d="M0 258 H1000 M0 280 H1000 M0 302 H1000" stroke="var(--accent)" strokeWidth="6" />
                </g>

                {/* links between the layers */}
                {[
                  { d: "M196 236 C 300 200, 520 210, 656 244", label: "LoRa · soil, leaf, water", lx: 360, ly: 205 },
                  { d: "M470 128 C 560 150, 620 200, 668 232", label: "image + GPS + attitude", lx: 556, ly: 140 },
                  { d: "M764 250 H852", label: "advisory", lx: 758, ly: 232 },
                ].map((l) => (
                  <g key={l.label}>
                    <path
                      d={l.d}
                      fill="none"
                      stroke="var(--fg-faint)"
                      strokeWidth="1.5"
                      strokeDasharray="6 6"
                      className="aegis-idle"
                      style={{ animation: "aegis-flow 1.6s linear infinite" }}
                    />
                    <text x={l.lx} y={l.ly} fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--fg-subtle)">
                      {l.label}
                    </text>
                  </g>
                ))}

                {/* L1: ground node */}
                <g style={{ opacity: dim(0), transition: "opacity 400ms" }}>
                  <circle cx="152" cy="196" r="62" fill="none" stroke={ring(0)} strokeWidth="1.5" strokeDasharray="4 6" />
                  <rect x="146" y="176" width="7" height="62" fill="oklch(0.5600 0.0400 50)" />
                  <rect x="122" y="156" width="56" height="26" rx="5" fill="var(--background)" stroke="var(--chart-4)" strokeWidth="1.5" />
                  <circle cx="134" cy="169" r="3" fill="var(--primary)" />
                  <text x="146" y="173" fontFamily="var(--font-mono)" fontSize="9" fill="var(--foreground)">ESP32</text>
                  <path d="M182 150 q 14 -12 0 -26 M190 156 q 22 -20 0 -42" fill="none" stroke="var(--primary)" strokeWidth="1.6" />
                  <path d="M150 222 l -22 14 M150 230 l 22 12" stroke="oklch(0.5600 0.0400 50)" strokeWidth="2.4" />
                  <text x="100" y="272" fontSize="12" fontWeight="600" fill="var(--chart-4)">Ground node</text>
                </g>

                {/* L2: aircraft */}
                <g style={{ opacity: dim(1), transition: "opacity 400ms" }}>
                  <circle cx="436" cy="94" r="74" fill="none" stroke={ring(1)} strokeWidth="1.5" strokeDasharray="4 6" />
                  <ellipse cx="372" cy="82" rx="42" ry="7" fill="var(--deep-elevated)" opacity=".22" />
                  <ellipse cx="500" cy="82" rx="42" ry="7" fill="var(--deep-elevated)" opacity=".22" />
                  <path d="M414 96 L378 84 M458 96 L494 84" stroke="oklch(0.2700 0.0300 145.7)" strokeWidth="6" strokeLinecap="round" />
                  <rect x="410" y="86" width="52" height="26" rx="7" fill="var(--deep-elevated)" />
                  <rect x="428" y="112" width="16" height="12" rx="4" fill="oklch(0.1700 0.0300 145.7)" />
                  <circle cx="436" cy="119" r="4.4" fill="var(--deep)" stroke="var(--chart-1)" strokeWidth="1.4" />
                  <text x="436" y="103" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" letterSpacing="1" fill="var(--accent)">JETSON</text>
                  <text x="392" y="192" fontSize="12" fontWeight="600" fill="var(--chart-4)">800 mm quad</text>
                </g>

                {/* L3: field edge station */}
                <g style={{ opacity: dim(2), transition: "opacity 400ms" }}>
                  <circle cx="710" cy="228" r="62" fill="none" stroke={ring(2)} strokeWidth="1.5" strokeDasharray="4 6" />
                  <rect x="662" y="212" width="96" height="50" rx="8" fill="var(--background)" stroke="var(--chart-4)" strokeWidth="1.5" />
                  <rect x="672" y="222" width="52" height="6" rx="3" fill="var(--accent)" />
                  <rect x="672" y="234" width="34" height="6" rx="3" fill="var(--accent)" />
                  <circle cx="746" cy="250" r="4" fill="var(--primary)" />
                  <path d="M756 212 v -22 M748 190 h 16" stroke="var(--primary)" strokeWidth="2" />
                  <text x="654" y="286" fontSize="12" fontWeight="600" fill="var(--chart-4)">Field edge station</text>
                </g>

                {/* L4: farmer interface */}
                <g style={{ opacity: dim(3), transition: "opacity 400ms" }}>
                  <circle cx="900" cy="222" r="60" fill="none" stroke={ring(3)} strokeWidth="1.5" strokeDasharray="4 6" />
                  <rect x="864" y="192" width="42" height="72" rx="8" fill="var(--background)" stroke="var(--chart-4)" strokeWidth="1.5" />
                  <rect x="870" y="200" width="30" height="46" rx="3" fill="var(--secondary)" />
                  <rect x="874" y="206" width="22" height="10" rx="2" fill="var(--chart-1)" />
                  <rect x="874" y="220" width="22" height="3" rx="1.5" fill="var(--accent)" />
                  <rect x="874" y="228" width="14" height="3" rx="1.5" fill="var(--accent)" />
                  <rect x="918" y="206" width="52" height="40" rx="6" fill="var(--background)" stroke="var(--chart-4)" strokeWidth="1.5" />
                  <circle cx="944" cy="226" r="7" fill="none" stroke="var(--primary)" strokeWidth="1.6" />
                  <text x="922" y="264" fontFamily="var(--font-mono)" fontSize="9" fill="var(--muted-foreground)">SMS</text>
                  <text x="852" y="288" fontSize="12" fontWeight="600" fill="var(--chart-4)">Farmer interface</text>
                </g>
              </svg>

              <motion.div
                key={active}
                initial={reduced ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                aria-live="polite"
                className="mt-6 grid gap-8 border-t border-border pt-5 lg:grid-cols-[minmax(0,1fr)_268px]"
              >
                <div>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <h3 className="text-[21px] font-bold tracking-tight text-foreground">{cur.title}</h3>
                    <span className="font-mono text-[10.5px] tracking-[0.1em] text-primary">{cur.kicker}</span>
                  </div>
                  <ul className="mt-3.5 grid gap-2.5 sm:grid-cols-2 sm:gap-x-7">
                    {cur.specs.map((s) => (
                      <li key={s} className="flex items-start gap-2.5">
                        <span className="mt-2 size-1 shrink-0 bg-chart-1" />
                        <span className="text-[13.5px] leading-[1.52] text-muted-foreground">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-2">
                  {cur.stats.map((st) => (
                    <div
                      key={st.k}
                      className="flex items-center justify-between rounded-md border border-border bg-muted px-3.5 py-2.5"
                    >
                      <span className="font-mono text-[10px] tracking-[0.09em] text-fg-subtle">{st.k}</span>
                      <span className="font-mono text-[13px] text-foreground">{st.v}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
