"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { workflow } from "@/lib/content";
import { Eyebrow, Lead, SectionTitle } from "@/components/ui/bits";
import { cn } from "@/lib/utils";

/**
 * The eight steps of a mission. Scrolling walks the rail; clicking a step
 * pins it until you scroll again.
 */
export function Workflow() {
  const listRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(6);
  const pinned = useRef(false);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 70%", "end 65%"],
  });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (pinned.current) return;
    const n = workflow.steps.length;
    const i = Math.min(n - 1, Math.max(0, Math.floor(p * n)));
    setActive(i);
  });

  // A click pins a step; the next real scroll hands control back.
  useEffect(() => {
    const release = () => {
      pinned.current = false;
    };
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", release);
    return () => {
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", release);
    };
  }, []);

  const railFill = ((active + 0.6) / workflow.steps.length) * 100;

  return (
    <section id="workflow" className="bg-background px-6 py-20 md:px-16 md:py-[88px]">
      <div className="mx-auto grid max-w-[1312px] gap-12 lg:grid-cols-[450px_minmax(0,1fr)] lg:gap-24">
        <div>
          <Eyebrow>{workflow.eyebrow}</Eyebrow>
          <SectionTitle className="mt-6" lines={workflow.headline} />
          <Lead className="mt-6">{workflow.sub}</Lead>

          <div className="mt-9 rounded-xl border border-accent bg-secondary p-5">
            <div className="font-mono text-[10.5px] tracking-[0.1em] text-primary">
              {workflow.loop.kicker}
            </div>
            <p className="mt-2 text-[13.5px] leading-[1.62] text-secondary-foreground">
              {workflow.loop.body}
            </p>
          </div>

          <div className="mt-8 flex items-center gap-2.5">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 3v10M4.5 9.5 8 13l3.5-3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-fg-subtle"
              />
            </svg>
            <span className="font-mono text-[10.5px] tracking-[0.1em] text-fg-subtle">
              SCROLL, OR PICK A STEP
            </span>
          </div>
        </div>

        <ol ref={listRef} className="relative pl-0.5">
          <div className="absolute bottom-4 left-1.5 top-2.5 w-[1.5px] bg-border" aria-hidden="true" />
          <div
            className="absolute left-1.5 top-2.5 w-[1.5px] bg-primary"
            style={{
              height: `${railFill}%`,
              transition: reduced ? undefined : "height 320ms cubic-bezier(.22,1,.36,1)",
            }}
            aria-hidden="true"
          />

          {workflow.steps.map((step, i) => {
            const on = i === active;
            return (
              <li key={step.label} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    pinned.current = true;
                    setActive(i);
                  }}
                  aria-current={on ? "step" : undefined}
                  className="flex w-full gap-6 pb-6 text-left"
                >
                  <span className="flex w-3.5 shrink-0 justify-center pt-1.5">
                    <span
                      className={cn(
                        "size-2 transition-all",
                        on ? "bg-primary ring-4 ring-accent" : "bg-border"
                      )}
                    />
                  </span>

                  <span className="flex-1 pr-4 md:pr-10">
                    <span className="flex items-baseline gap-4">
                      <span
                        className={cn(
                          "font-mono text-[11px] tracking-[0.07em]",
                          on ? "text-primary" : "text-fg-faint"
                        )}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "text-[clamp(1rem,1.5vw,1.25rem)] tracking-tight transition-colors",
                          on ? "font-bold text-foreground" : "font-medium text-fg-subtle"
                        )}
                      >
                        {step.label}
                      </span>
                    </span>

                    {on ? (
                      <span className="block">
                        <span className="mt-3 block max-w-[560px] text-[14.5px] leading-[1.68] text-muted-foreground">
                          {step.body}
                        </span>
                        <span className="mt-3 flex flex-wrap gap-1.5">
                          {step.tags.map((t) => (
                            <span
                              key={t}
                              className="inline-flex h-[23px] items-center rounded-md border border-border bg-muted px-2.5 font-mono text-[10px] tracking-[0.05em] text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </span>
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
