"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { nav, meta } from "@/lib/content";
import { AegisMark, AegisWordmark } from "@/components/ui/bits";
import { cn } from "@/lib/utils";

/**
 * At the top of the page the bar is flush with the page grid: no card, no
 * border, nothing between it and the hero. Once you scroll it lifts off and
 * becomes a floating bar with its own surface.
 *
 * The sticky wrapper keeps a constant 74px of flow height, so the bar can
 * animate its inset and height inside it without moving the page.
 */
export function SiteNav() {
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-0 z-50 h-[74px]">
      <nav
        className={cn(
          "absolute flex items-center justify-between border transition-all duration-300 ease-out motion-reduce:transition-none",
          lifted
            ? "inset-x-4 top-4 h-[58px] rounded-xl border-border bg-background/80 pl-4 pr-2.5 shadow-sm backdrop-blur-md md:inset-x-10 md:pl-[18px]"
            : "inset-x-0 top-0 h-[74px] rounded-none border-transparent bg-transparent px-6 shadow-none md:px-16"
        )}
      >
        <Link href="/#hero" className="flex items-center gap-3" aria-label="AEGIS, home">
          <AegisMark className="text-primary" />
          <AegisWordmark height={16} className="text-foreground" />
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="hidden px-1.5 text-[13px] font-medium text-muted-foreground xl:inline">
            Team {meta.team}
          </span>
          <Link
            href="/#closing"
            className="flex h-[38px] items-center rounded-md bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-chart-4"
          >
            Read the deck
          </Link>
        </div>
      </nav>
    </div>
  );
}
