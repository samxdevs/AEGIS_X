import Link from "next/link";
import { hero, meta } from "@/lib/content";
import { AlertCard } from "@/components/alert-card";
import { Drone } from "@/components/drone/drone";
import { ArrowRight, Check, Chip, Eyebrow } from "@/components/ui/bits";

export function Hero() {
  return (
    <section
      id="hero"
      className="relative -mt-[74px] min-h-[1040px] overflow-hidden pt-[74px] lg:h-[1020px]"
    >
      {/* atmosphere */}
      <div className="absolute inset-0 aegis-sky" />
      <div
        className="absolute -top-50 left-[60%] size-[660px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.9900 0.0090 90 / 0.95) 0%, transparent 64%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[300px] aegis-field lg:h-[332px]" />
      <div className="absolute bottom-0 left-[-50%] h-[300px] w-[200%] overflow-hidden opacity-[0.42] lg:h-[332px]">
        <div
          className="h-full w-full aegis-rows"
          style={{ transform: "perspective(280px) rotateX(66deg)", transformOrigin: "50% 0%" }}
        />
      </div>
      <div className="absolute inset-x-0 bottom-[270px] h-16 aegis-haze lg:bottom-[300px]" />
      <div className="absolute inset-x-0 bottom-0 h-[260px] aegis-vignette lg:h-[280px]" />

      {/* the aircraft hovers over the field, scanning */}
      <div className="absolute left-1/2 top-[655px] -translate-x-1/2 lg:hidden">
        <Drone width={240} idle />
      </div>
      <div className="absolute left-1/2 top-[505px] hidden -translate-x-1/2 lg:block">
        <Drone width={520} idle />
      </div>

      {/* copy */}
      <div className="relative mx-auto flex max-w-[1440px] flex-col items-center px-6 pt-12 text-center md:pt-[36px]">
        <Eyebrow>{meta.eyebrow.toUpperCase()}</Eyebrow>

        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.26em] text-primary sm:text-[11.5px] sm:tracking-[0.3em]">
          {meta.fullName}
        </p>

        <h1 className="mt-4 max-w-[930px] text-balance text-[clamp(2.125rem,4.6vw,3.75rem)] font-bold leading-[1.07] tracking-tight text-foreground">
          {hero.headline.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h1>

        <p className="mt-6 max-w-[700px] text-[15px] leading-[1.66] text-muted-foreground md:text-base">
          {hero.sub}
        </p>

        <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Link
            href="#two-pass"
            className="flex h-12 items-center justify-center gap-2.5 rounded-md bg-primary px-6 text-[14.5px] font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-chart-4"
          >
            {hero.primaryCta}
            <ArrowRight />
          </Link>
          <Link
            href="#system"
            className="flex h-12 items-center justify-center rounded-md border border-border bg-background px-5 text-[14.5px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            {hero.secondaryCta}
          </Link>
        </div>
      </div>

      {/* telemetry */}
      <div className="absolute left-16 top-[600px] hidden flex-col items-start gap-2 xl:flex">
        {hero.telemetry.map((t) => (
          <Chip key={t.k} label={t.k} value={t.v} />
        ))}
        <Chip label={hero.link.k} value={hero.link.v} tone="warning" />
      </div>

      {/* live alert */}
      <div className="absolute right-16 top-[584px] hidden w-[308px] xl:block">
        <AlertCard />
      </div>

      {/* proof */}
      <div className="absolute inset-x-0 bottom-11 flex flex-wrap justify-center gap-x-9 gap-y-2 px-6">
        {hero.proof.map((p) => (
          <div key={p} className="flex items-center gap-2.5">
            <Check className="text-accent" />
            <span className="text-[13.5px] font-medium text-deep-foreground">{p}</span>
          </div>
        ))}
      </div>

    </section>
  );
}
