import Link from "next/link";
import { closing } from "@/lib/content";
import { Drone } from "@/components/drone/drone";
import { ArrowRight } from "@/components/ui/bits";
import { SiteFooter } from "@/components/sections/site-footer";

export function Closing() {
  return (
    <div className="bg-deep">
      <section id="closing" className="relative overflow-hidden">
        {/* dusk over the field */}
        <div className="absolute inset-x-0 top-0 h-[340px] aegis-dusk" />
        <div
          className="absolute -top-[90px] left-1/2 h-[420px] w-[900px] -translate-x-1/2"
          style={{
            background:
              "radial-gradient(ellipse, color-mix(in oklab, var(--warning) 16%, transparent), transparent 66%)",
          }}
        />
        <div className="absolute left-[-50%] top-[210px] h-[150px] w-[200%] overflow-hidden opacity-[0.22]">
          <div
            className="h-full w-full"
            style={{
              transform: "perspective(200px) rotateX(70deg)",
              transformOrigin: "50% 0%",
              background:
                "repeating-linear-gradient(90deg, var(--chart-1) 0 3px, transparent 3px 30px)",
            }}
          />
        </div>

        <div className="relative flex flex-col items-center px-6 pb-24 pt-20 md:px-16">
          {/* The aircraft holds station over the dusk field. It is absolutely
              placed so the empty cone area below it cannot push the copy down;
              the spacer reserves exactly the height it needs. */}
          <div className="pointer-events-none absolute left-1/2 top-[76px] -translate-x-1/2 lg:hidden">
            <Drone width={190} coneOpacity={0} idle />
          </div>
          <div className="pointer-events-none absolute left-1/2 top-[104px] hidden -translate-x-1/2 lg:block">
            <Drone width={300} coneOpacity={0} idle />
          </div>
          <div className="h-20 lg:h-40" />

          <p className="max-w-[960px] text-center text-[clamp(1.25rem,2.3vw,1.8125rem)] font-medium leading-[1.5] tracking-tight text-deep-foreground">
            {closing.line.map((part, i) =>
              part.accent ? (
                <span key={i} className="text-chart-1">
                  {part.t}
                </span>
              ) : (
                <span key={i}>{part.t}</span>
              )
            )}
          </p>

          <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Link
              href="#hero"
              className="flex h-12 items-center justify-center gap-2.5 rounded-md bg-chart-1 px-6 text-[14.5px] font-bold text-deep transition-opacity hover:opacity-90"
            >
              {closing.primaryCta}
              <ArrowRight />
            </Link>
            <Link
              href="#hero"
              className="flex h-12 items-center justify-center rounded-md border border-deep-border px-5 text-[14.5px] font-semibold text-deep-foreground transition-colors hover:bg-deep-elevated"
            >
              {closing.secondaryCta}
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
