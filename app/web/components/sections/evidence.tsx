import { evidence } from "@/lib/content";
import { AlertCard } from "@/components/alert-card";
import { Eyebrow, Lead, SectionTitle } from "@/components/ui/bits";
import { cn } from "@/lib/utils";

function Callout({
  title,
  body,
  side,
}: {
  title: string;
  body: string;
  side: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "relative",
        side === "left" ? "lg:pr-8 lg:text-right" : "lg:pl-8"
      )}
    >
      {/* leader line into the card */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-2.5 hidden h-px w-6 bg-accent lg:block",
          side === "left" ? "right-0" : "left-0"
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-2 hidden size-[5px] rounded-full bg-primary lg:block",
          side === "left" ? "-right-0.5" : "-left-0.5"
        )}
      />
      <h3 className="text-[13px] font-semibold leading-snug text-foreground">{title}</h3>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{body}</p>
    </div>
  );
}

export function Evidence() {
  return (
    <section id="evidence" className="bg-secondary px-6 py-20 md:px-16 md:py-[88px]">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex flex-col items-center text-center">
          <Eyebrow tone="onSecondary">{evidence.eyebrow}</Eyebrow>
          <SectionTitle className="mt-5 max-w-[840px]" lines={evidence.headline} />
          <Lead className="mt-5 max-w-[720px]">{evidence.sub}</Lead>
        </div>

        <div className="mt-13 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_380px_minmax(0,1fr)] lg:gap-0">
          <div className="flex flex-col gap-7 lg:pl-16">
            {evidence.callouts.left.map((c) => (
              <Callout key={c.title} {...c} side="left" />
            ))}
          </div>

          <AlertCard variant="full" className="mx-auto w-full max-w-[380px]" />

          <div className="flex flex-col gap-7 lg:pr-16">
            {evidence.callouts.right.map((c) => (
              <Callout key={c.title} {...c} side="right" />
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {evidence.notes.map((n) => (
            <div key={n.title} className="rounded-xl border border-accent bg-background p-6">
              <div className="font-mono text-[clamp(1.1rem,1.5vw,1.375rem)] font-medium text-primary">
                {n.stat === "99.35% → 31%" ? (
                  <span className="flex items-baseline gap-2.5">
                    <span>99.35%</span>
                    <span className="text-sm text-fg-subtle">→</span>
                    <span className="text-destructive">31%</span>
                  </span>
                ) : (
                  n.stat
                )}
              </div>
              <h3 className="mt-2.5 text-sm font-semibold text-foreground">{n.title}</h3>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-muted-foreground">{n.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
