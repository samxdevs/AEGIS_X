import type { ReactNode } from "react";
import { impact } from "@/lib/content";
import { Eyebrow, Lead, SectionTitle } from "@/components/ui/bits";
import { cn } from "@/lib/utils";

const ICONS: Record<string, ReactNode> = {
  sprout: (
    <path
      d="M12 21v-7M12 14c0-3.3-2.2-6-5-6 0 3.3 2.2 6 5 6ZM12 14c0-3.9 2.6-7 6-7 0 3.9-2.6 7-6 7Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  group: (
    <>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M16 6.2a3 3 0 0 1 0 5.6M18 19c0-2.4-1-4-2.6-4.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  ),
  clipboard: (
    <>
      <rect x="4.5" y="4" width="15" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 3.5h6v3H9zM8.5 12h7M8.5 16h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </>
  ),
};

/** Splits a benefit body so the emphasised phrase renders in full colour. */
function Emphasised({ body, phrase }: { body: string; phrase: string }) {
  const i = body.indexOf(phrase);
  if (i === -1) return <>{body}</>;
  return (
    <>
      {body.slice(0, i)}
      <span className="font-semibold text-foreground">{phrase}</span>
      {body.slice(i + phrase.length)}
    </>
  );
}

export function Impact() {
  return (
    <section id="impact" className="bg-muted px-6 py-20 md:px-16 md:py-[88px]">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <Eyebrow>{impact.eyebrow}</Eyebrow>
            <SectionTitle className="mt-5" lines={impact.headline} />
          </div>
          <Lead className="max-w-[480px] lg:mb-2">{impact.sub}</Lead>
        </div>

        <div className="mt-11 grid gap-4.5 sm:grid-cols-2 xl:grid-cols-4">
          {impact.audiences.map((a) => {
            const hl = "highlight" in a && a.highlight;
            return (
              <div
                key={a.title}
                className={cn(
                  "rounded-xl border p-6",
                  hl ? "border-accent bg-secondary" : "border-border bg-background"
                )}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary" aria-hidden="true">
                  {ICONS[a.icon]}
                </svg>
                <h3
                  className={cn(
                    "mt-3.5 text-base font-bold",
                    hl ? "text-secondary-foreground" : "text-foreground"
                  )}
                >
                  {a.title}
                </h3>
                <p
                  className={cn(
                    "mt-2 text-[13.5px] leading-[1.62]",
                    hl ? "text-secondary-foreground" : "text-muted-foreground"
                  )}
                >
                  {a.body}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-11 grid gap-11 border-t border-border pt-9 md:grid-cols-3">
          {impact.benefits.map((b) => (
            <div key={b.kicker}>
              <div className="font-mono text-[10.5px] tracking-[0.1em] text-primary">{b.kicker}</div>
              <p className="mt-3 text-[14.5px] leading-[1.66] text-muted-foreground">
                <Emphasised body={b.body} phrase={b.emphasis} />
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
