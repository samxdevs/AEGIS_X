"use client";

import { useId } from "react";
import { AEGIS_LETTERFORMS } from "@/components/ui/bits";

type DroneProps = {
  /** Rendered width in px. The SVG is authored at 480×460. */
  width?: number;
  /** Opacity of the scan cone + ground footprint. */
  coneOpacity?: number;
  /** Idle hover bob. Disabled automatically under prefers-reduced-motion. */
  idle?: boolean;
  className?: string;
};

/**
 * The AEGIS aircraft: an 800 mm quad seen head-on. One SVG, three
 * configurations: hover (legs down, no cone), banked (rolled by the layer
 * above), and scanning (cone + ground footprint faded in).
 */
export function Drone({ width = 520, coneOpacity = 1, idle = false, className }: DroneProps) {
  const uid = useId().replace(/:/g, "");
  const blur = `pb-${uid}`;
  const body = `body-${uid}`;
  const cone = `cone-${uid}`;
  const clip = `clip-${uid}`;

  return (
    <div
      className={className}
      style={{
        width,
        animation: idle ? "aegis-bob 5.2s ease-in-out infinite" : undefined,
      }}
    >
      <svg
        width={width}
        height={(width * 460) / 480}
        viewBox="0 0 480 460"
        fill="none"
        className="block overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={blur} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--deep-elevated)" stopOpacity=".5" />
            <stop offset="60%" stopColor="var(--deep-elevated)" stopOpacity=".22" />
            <stop offset="100%" stopColor="var(--deep-elevated)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.3400 0.0430 145.7)" />
            <stop offset="100%" stopColor="var(--deep)" />
          </linearGradient>
          <linearGradient id={cone} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity=".4" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
          <clipPath id={clip}>
            <path d="M232 156 L248 156 L372 398 L108 398 Z" />
          </clipPath>
        </defs>

        {/* scan cone + ground footprint */}
        <g style={{ opacity: coneOpacity }}>
          <path d="M232 156 L248 156 L372 398 L108 398 Z" fill={`url(#${cone})`} />
          <g clipPath={`url(#${clip})`}>
            <rect
              x="90"
              y="150"
              width="300"
              height="3"
              fill="var(--chart-1)"
              opacity=".9"
              className="aegis-idle"
              style={{ animation: "aegis-sweep 3.4s cubic-bezier(.45,0,.55,1) infinite" }}
            />
          </g>
          <ellipse cx="240" cy="398" rx="132" ry="21" fill="var(--accent)" opacity=".18" />
          <ellipse
            cx="240"
            cy="398"
            rx="132"
            ry="21"
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="2"
            strokeDasharray="9 7"
            opacity=".95"
          />
        </g>

        {/* rear rotors */}
        <ellipse
          cx="146"
          cy="84"
          rx="72"
          ry="12"
          fill={`url(#${blur})`}
          className="aegis-idle"
          style={{ animation: "aegis-shimmer 1.1s ease-in-out infinite" }}
        />
        <ellipse
          cx="334"
          cy="84"
          rx="72"
          ry="12"
          fill={`url(#${blur})`}
          className="aegis-idle"
          style={{ animation: "aegis-shimmer 1.1s ease-in-out .3s infinite" }}
        />
        <ellipse cx="146" cy="84" rx="72" ry="12" fill="none" stroke="var(--deep-elevated)" strokeOpacity=".3" />
        <ellipse cx="334" cy="84" rx="72" ry="12" fill="none" stroke="var(--deep-elevated)" strokeOpacity=".3" />
        <path d="M226 108 L152 88" stroke="var(--deep-elevated)" strokeWidth="9" strokeLinecap="round" />
        <path d="M254 108 L328 88" stroke="var(--deep-elevated)" strokeWidth="9" strokeLinecap="round" />
        <rect x="137" y="76" width="18" height="20" rx="5" fill="var(--deep-border)" />
        <rect x="325" y="76" width="18" height="20" rx="5" fill="var(--deep-border)" />

        {/* front rotors */}
        <ellipse
          cx="112"
          cy="106"
          rx="86"
          ry="15"
          fill={`url(#${blur})`}
          className="aegis-idle"
          style={{ animation: "aegis-shimmer 1.1s ease-in-out .55s infinite" }}
        />
        <ellipse
          cx="368"
          cy="106"
          rx="86"
          ry="15"
          fill={`url(#${blur})`}
          className="aegis-idle"
          style={{ animation: "aegis-shimmer 1.1s ease-in-out .15s infinite" }}
        />
        <ellipse cx="112" cy="106" rx="86" ry="15" fill="none" stroke="var(--deep-elevated)" strokeOpacity=".36" />
        <ellipse cx="368" cy="106" rx="86" ry="15" fill="none" stroke="var(--deep-elevated)" strokeOpacity=".36" />
        <path d="M222 122 L118 110" stroke="var(--deep)" strokeWidth="11" strokeLinecap="round" />
        <path d="M258 122 L362 110" stroke="var(--deep)" strokeWidth="11" strokeLinecap="round" />
        <rect x="102" y="96" width="20" height="24" rx="6" fill="oklch(0.3800 0.0400 145.7)" />
        <rect x="358" y="96" width="20" height="24" rx="6" fill="oklch(0.3800 0.0400 145.7)" />
        <rect x="102" y="96" width="20" height="6" rx="3" fill="oklch(0.5000 0.0350 145.7)" />
        <rect x="358" y="96" width="20" height="6" rx="3" fill="oklch(0.5000 0.0350 145.7)" />

        {/* airframe */}
        <rect x="196" y="100" width="88" height="46" rx="14" fill={`url(#${body})`} />
        <rect x="203" y="104" width="74" height="12" rx="6" fill="oklch(0.5000 0.0350 145.7)" opacity=".65" />
        <rect x="214" y="146" width="52" height="10" rx="4" fill="var(--deep)" />
        <circle
          cx="212"
          cy="133"
          r="3.4"
          fill="var(--chart-1)"
          className="aegis-idle"
          style={{ animation: "aegis-led 1.6s steps(1,end) infinite" }}
        />
        <circle
          cx="268"
          cy="133"
          r="3.4"
          fill="var(--warning)"
          className="aegis-idle"
          style={{ animation: "aegis-led 1.6s steps(1,end) .8s infinite" }}
        />
        {/* the wordmark itself, scaled onto the airframe. non-scaling-stroke
            keeps the hairline visible whatever size the drone renders at */}
        <g transform="translate(220 129) scale(0.081)" aria-hidden="true">
          {AEGIS_LETTERFORMS.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="var(--deep-muted)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
          ))}
        </g>

        {/* gimbal */}
        <rect x="226" y="154" width="28" height="22" rx="6" fill="oklch(0.1700 0.0300 145.7)" />
        <circle cx="240" cy="166" r="8" fill="var(--deep)" stroke="oklch(0.4400 0.0350 145.7)" strokeWidth="1.5" />
        <circle cx="237.6" cy="163.4" r="2.4" fill="var(--deep-muted)" opacity=".85" />

        {/* legs */}
        <path d="M214 150 L188 196" stroke="oklch(0.2700 0.0300 145.7)" strokeWidth="7" strokeLinecap="round" />
        <path d="M266 150 L292 196" stroke="oklch(0.2700 0.0300 145.7)" strokeWidth="7" strokeLinecap="round" />
        <path d="M166 198 L214 198" stroke="oklch(0.2700 0.0300 145.7)" strokeWidth="7" strokeLinecap="round" />
        <path d="M266 198 L314 198" stroke="oklch(0.2700 0.0300 145.7)" strokeWidth="7" strokeLinecap="round" />
      </svg>
    </div>
  );
}
