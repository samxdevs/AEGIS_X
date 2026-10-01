import { feasibility } from "@/lib/content";
import { ArrowRight, Eyebrow, Lead, SectionTitle, StatCard } from "@/components/ui/bits";

export function Feasibility() {
  const { cost } = feasibility;

  return (
    <section id="feasibility" className="bg-background px-6 py-20 md:px-16 md:py-[88px]">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <Eyebrow>{feasibility.eyebrow}</Eyebrow>
            <SectionTitle className="mt-5" lines={feasibility.headline} />
          </div>
          <Lead className="max-w-[500px] lg:mb-2">{feasibility.sub}</Lead>
        </div>

        <div className="mt-11 grid gap-6 lg:grid-cols-[minmax(0,1fr)_560px]">
          {/* cost comparison */}
          <div className="rounded-xl border border-border bg-muted p-6 md:p-7">
            <h3 className="text-[17px] font-bold tracking-tight text-foreground">{cost.title}</h3>

            <div className="mt-6">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
                <span className="text-[13.5px] font-semibold text-secondary-foreground">
                  {cost.ours.label}
                </span>
                <span className="font-mono text-[15px] text-secondary-foreground">
                  {cost.ours.value}
                </span>
              </div>
              <div className="h-[34px] overflow-hidden rounded-md bg-border">
                <div className="h-full rounded-md bg-primary" style={{ width: `${cost.ours.pct}%` }} />
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
                <span className="text-[13.5px] font-semibold text-muted-foreground">
                  {cost.theirs.label}
                </span>
                <span className="font-mono text-[15px] text-muted-foreground">{cost.theirs.value}</span>
              </div>
              <div className="h-[34px] overflow-hidden rounded-md bg-border">
                <div className="h-full rounded-md bg-fg-faint" style={{ width: `${cost.theirs.pct}%` }} />
              </div>
            </div>

            <p className="mt-6 text-[13.5px] leading-[1.62] text-muted-foreground">{cost.note}</p>

            <div className="mt-3.5 rounded-md border border-dashed border-fg-faint bg-background px-3 py-2.5">
              <span className="font-mono text-[11px] text-fg-subtle">{cost.placeholder}</span>
            </div>
          </div>

          {/* hard specs */}
          <div className="grid gap-4 sm:grid-cols-2">
            {feasibility.specs.map((s) => (
              <StatCard
                key={s.k}
                value={s.v}
                caption={s.k}
                highlight={"highlight" in s && s.highlight}
              />
            ))}
          </div>
        </div>

        {/* risks */}
        <div className="mt-12">
          <div className="flex flex-wrap items-baseline gap-3.5 border-b border-border pb-3.5">
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              {feasibility.risksTitle}
            </h3>
            <span className="text-sm text-muted-foreground">{feasibility.risksSub}</span>
          </div>

          <ol>
            {feasibility.risks.map((r, i) => (
              <li
                key={r.risk}
                className="grid items-start gap-x-4 gap-y-2 border-b border-border py-5 md:grid-cols-[44px_minmax(0,1fr)_40px_minmax(0,1fr)]"
              >
                <span className="pt-0.5 font-mono text-[12px] text-fg-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[15px] font-semibold leading-snug text-foreground">
                  {r.risk}
                </span>
                <span className="hidden justify-center pt-1 md:flex">
                  <ArrowRight className="text-primary" />
                </span>
                <span className="text-[14.5px] leading-[1.6] text-muted-foreground">{r.fix}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
