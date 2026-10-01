import { twoPass } from "@/lib/content";
import { Eyebrow, Lead, SectionTitle, StatCard } from "@/components/ui/bits";

function PassHeader({
  kicker,
  title,
  spec,
  tone,
}: {
  kicker: string;
  title: string;
  spec: string;
  tone: "primary" | "warning";
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div className="flex items-baseline gap-3">
        <span
          className={`font-mono text-[11px] tracking-[0.11em] ${
            tone === "primary" ? "text-chart-1" : "text-warning"
          }`}
        >
          {kicker}
        </span>
        <span className="text-[17px] font-semibold text-deep-foreground">{title}</span>
      </div>
      <span className="font-mono text-[11px] text-deep-muted">{spec}</span>
    </div>
  );
}

export function TwoPass() {
  return (
    <section id="two-pass" className="bg-muted px-6 py-20 md:px-16 md:py-[88px]">
      <div className="mx-auto max-w-[1312px]">
        <Eyebrow>{twoPass.eyebrow}</Eyebrow>
        <SectionTitle
          className="mt-5"
          lines={["The survey finds where.", "The revisit decides what."]}
        />
        <Lead className="mt-5 max-w-[680px] text-base">{twoPass.sub}</Lead>

        <div className="mt-12 grid overflow-hidden rounded-xl border border-border bg-deep shadow-xl lg:grid-cols-2">
          {/* PASS 1: survey grid */}
          <div className="border-b border-deep-border p-6 lg:border-b-0 lg:border-r">
            <PassHeader {...twoPass.passOne} tone="primary" />
            <p className="mt-2.5 max-w-[94%] text-[13.5px] leading-[1.6] text-deep-muted">
              {twoPass.passOne.body}
            </p>

            <svg viewBox="0 0 560 400" className="mt-4 block h-auto w-full" aria-hidden="true">
              <defs>
                <linearGradient id="tp-field" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--deep-elevated)" />
                  <stop offset="100%" stopColor="oklch(0.2600 0.0430 145.7)" />
                </linearGradient>
              </defs>
              <path
                d="M40 58 L520 32 L538 346 L58 374 Z"
                fill="url(#tp-field)"
                stroke="var(--deep-border)"
                strokeWidth="1.5"
              />
              <path
                d="M40 58 L520 32 L538 346 L58 374 Z"
                fill="none"
                stroke="var(--chart-1)"
                strokeWidth="1.5"
                strokeDasharray="6 6"
                opacity=".45"
              />
              <g opacity=".28">
                <path
                  d="M70 70 L84 366 M140 66 L152 362 M210 62 L220 358 M280 58 L288 354 M350 54 L356 350 M420 50 L424 346 M490 46 L492 342"
                  stroke="var(--canopy)"
                  strokeWidth="1"
                />
              </g>

              {/* survey path */}
              <path
                d="M72 88 H500 V128 H72 V168 H500 V208 H72 V248 H500 V288 H72 V328 H500"
                fill="none"
                stroke="oklch(0.4000 0.0400 145.7)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path
                d="M72 88 H500 V128 H72 V168 H500 V208 H72 V248 H500 V288 H72 V328 H500"
                fill="none"
                stroke="var(--chart-1)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeDasharray="14 546"
                className="aegis-idle"
                style={{ animation: "aegis-fly 2.77s linear infinite" }}
              />
              <g fill="oklch(0.4600 0.0400 145.7)">
                <circle cx="72" cy="88" r="3" />
                <circle cx="500" cy="128" r="3" />
                <circle cx="72" cy="168" r="3" />
                <circle cx="500" cy="208" r="3" />
                <circle cx="72" cy="248" r="3" />
                <circle cx="500" cy="288" r="3" />
                <circle cx="72" cy="328" r="3" />
              </g>

              {/* flagged hotspots */}
              <g className="aegis-idle" style={{ animation: "aegis-pop 2.6s ease-in-out infinite" }}>
                <rect
                  x="158"
                  y="136"
                  width="34"
                  height="34"
                  rx="4"
                  fill="color-mix(in oklab, var(--warning) 24%, transparent)"
                  stroke="var(--warning)"
                  strokeWidth="2"
                />
              </g>
              <g className="aegis-idle" style={{ animation: "aegis-pop 2.6s ease-in-out .9s infinite" }}>
                <rect
                  x="372"
                  y="240"
                  width="42"
                  height="42"
                  rx="4"
                  fill="color-mix(in oklab, var(--destructive) 24%, transparent)"
                  stroke="var(--destructive)"
                  strokeWidth="2"
                />
              </g>
              <g className="aegis-idle" style={{ animation: "aegis-pop 2.6s ease-in-out 1.7s infinite" }}>
                <rect
                  x="244"
                  y="292"
                  width="30"
                  height="30"
                  rx="4"
                  fill="color-mix(in oklab, var(--warning) 24%, transparent)"
                  stroke="var(--warning)"
                  strokeWidth="2"
                />
              </g>

              {/* the aircraft flies the route: 3236 user units in 16 s, and the
                  dash pattern below travels at the same 202 units/s so the
                  trail moves with it rather than past it */}
              <g
                className="aegis-idle"
                style={{
                  offsetPath: `path("M72 88 H500 V128 H72 V168 H500 V208 H72 V248 H500 V288 H72 V328 H500")`,
                  offsetRotate: "0deg",
                  animation: "aegis-survey 16s linear infinite",
                }}
              >
                <circle r="26" fill="color-mix(in oklab, var(--chart-1) 12%, transparent)" />
                <path d="M-13 -13 L13 13 M13 -13 L-13 13" stroke="var(--secondary)" strokeWidth="2.4" />
                <circle cx="-13" cy="-13" r="7" fill="none" stroke="var(--secondary)" strokeWidth="2" opacity=".8" />
                <circle cx="13" cy="-13" r="7" fill="none" stroke="var(--secondary)" strokeWidth="2" opacity=".8" />
                <circle cx="-13" cy="13" r="7" fill="none" stroke="var(--secondary)" strokeWidth="2" opacity=".8" />
                <circle cx="13" cy="13" r="7" fill="none" stroke="var(--secondary)" strokeWidth="2" opacity=".8" />
                <rect x="-6" y="-6" width="12" height="12" rx="3" fill="var(--background)" />
              </g>

              <text x="40" y="394" fontFamily="var(--font-mono)" fontSize="11" fill="var(--deep-muted)">
                {twoPass.passOne.footnote}
              </text>
            </svg>
          </div>

          {/* PASS 2: flagged coordinates only */}
          <div className="p-6">
            <PassHeader {...twoPass.passTwo} tone="warning" />
            <p className="mt-2.5 max-w-[94%] text-[13.5px] leading-[1.6] text-deep-muted">
              {twoPass.passTwo.body}
            </p>

            <svg viewBox="0 0 560 400" className="mt-4 block h-auto w-full" aria-hidden="true">
              <defs>
                <linearGradient id="tp-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.2900 0.0430 145.7)" />
                  <stop offset="100%" stopColor="var(--deep)" />
                </linearGradient>
                <linearGradient id="tp-cone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--warning)" stopOpacity=".34" />
                  <stop offset="100%" stopColor="var(--warning)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="560" height="400" fill="url(#tp-sky)" />

              {/* altitude ladder: 25 m down to 4 m */}
              <line x1="58" y1="40" x2="58" y2="330" stroke="var(--deep-border)" strokeWidth="1.5" />
              <g fontFamily="var(--font-mono)" fontSize="10" fill="var(--deep-muted)">
                <line x1="52" y1="52" x2="64" y2="52" stroke="oklch(0.4400 0.0350 145.7)" strokeWidth="1.5" />
                <text x="14" y="56">30 m</text>
                <line x1="52" y1="128" x2="64" y2="128" stroke="oklch(0.4400 0.0350 145.7)" strokeWidth="1.5" />
                <text x="14" y="132">20 m</text>
                <line x1="52" y1="204" x2="64" y2="204" stroke="oklch(0.4400 0.0350 145.7)" strokeWidth="1.5" />
                <text x="14" y="208">10 m</text>
                <line x1="46" y1="272" x2="70" y2="272" stroke="var(--warning)" strokeWidth="2" />
                <text x="14" y="276" fill="var(--warning)">3–5 m</text>
              </g>
              <path
                d="M118 60 C 150 96, 150 210, 176 254"
                fill="none"
                stroke="oklch(0.4400 0.0350 145.7)"
                strokeWidth="2"
                strokeDasharray="5 6"
              />

              <rect x="0" y="330" width="560" height="70" fill="oklch(0.2600 0.0430 145.7)" />
              <g opacity=".55">
                <path d="M0 348 H560 M0 366 H560 M0 384 H560" stroke="var(--chart-4)" strokeWidth="6" />
              </g>
              <rect
                x="132"
                y="318"
                width="96"
                height="60"
                rx="4"
                fill="color-mix(in oklab, var(--warning) 14%, transparent)"
                stroke="var(--warning)"
                strokeWidth="2"
              />

              {/* descending aircraft */}
              <g>
                <path d="M180 268 L192 268 L228 330 L132 330 Z" fill="url(#tp-cone)" />
                <g transform="translate(186,258)">
                  <ellipse cx="-34" cy="-4" rx="28" ry="5" fill="var(--accent)" opacity=".38" />
                  <ellipse cx="34" cy="-4" rx="28" ry="5" fill="var(--accent)" opacity=".38" />
                  <path
                    d="M-14 4 L-30 -3 M14 4 L30 -3"
                    stroke="oklch(0.2700 0.0300 145.7)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <rect x="-16" y="-2" width="32" height="16" rx="5" fill="oklch(0.3800 0.0400 145.7)" />
                  <rect x="-6" y="14" width="12" height="9" rx="3" fill="oklch(0.1700 0.0300 145.7)" />
                  <circle cx="0" cy="19" r="3.4" fill="var(--deep)" stroke="var(--warning)" strokeWidth="1.2" />
                </g>
              </g>

              {/* the evidence frame that comes back */}
              <g transform="translate(300,120)">
                <rect
                  x="0"
                  y="0"
                  width="216"
                  height="150"
                  rx="10"
                  fill="oklch(0.2900 0.0430 145.7)"
                  stroke="var(--deep-border)"
                  strokeWidth="1.5"
                />
                <rect x="10" y="10" width="196" height="96" rx="6" fill="var(--chart-3)" />
                <g opacity=".6">
                  <path
                    d="M10 30 H206 M10 52 H206 M10 74 H206 M10 96 H206"
                    stroke="oklch(0.2600 0.0430 145.7)"
                    strokeWidth="9"
                  />
                </g>
                <ellipse cx="118" cy="58" rx="34" ry="22" fill="var(--warning)" opacity=".8" />
                <rect x="82" y="34" width="72" height="48" rx="4" fill="none" stroke="var(--warning)" strokeWidth="2" />
                <text x="10" y="126" fontSize="13" fontWeight="600" fill="var(--deep-foreground)">
                  {twoPass.passTwo.frameTitle}
                </text>
                <text x="10" y="142" fontFamily="var(--font-mono)" fontSize="10" fill="var(--deep-muted)">
                  {twoPass.passTwo.frameMeta}
                </text>
              </g>
              <path
                d="M232 272 C 262 260, 276 220, 296 196"
                fill="none"
                stroke="oklch(0.4400 0.0350 145.7)"
                strokeWidth="1.5"
                strokeDasharray="4 5"
              />
            </svg>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {twoPass.stats.map((s) => (
            <StatCard key={s.k} value={s.v} caption={s.k} highlight={"highlight" in s && s.highlight} />
          ))}
        </div>
      </div>
    </section>
  );
}
