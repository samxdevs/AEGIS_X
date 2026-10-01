import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small mono eyebrow badge that opens most sections. */
export function Eyebrow({
  children,
  tone = "light",
  className,
}: {
  children: ReactNode;
  tone?: "light" | "onSecondary" | "onDeep";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[29px] items-center gap-2.5 rounded-md border px-3 font-mono text-[10.5px] tracking-[0.1em]",
        tone === "light" && "border-accent bg-secondary text-secondary-foreground",
        tone === "onSecondary" && "border-accent bg-background text-secondary-foreground",
        tone === "onDeep" && "border-deep-border bg-deep-elevated/60 text-deep-muted",
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "onDeep" ? "bg-chart-1" : "bg-primary"
        )}
      />
      {children}
    </span>
  );
}

/** Section headline, matching the 50px / 700 / -0.025em ramp. */
export function SectionTitle({
  lines,
  className,
  tone = "light",
}: {
  lines: readonly string[] | string;
  className?: string;
  tone?: "light" | "onDeep";
}) {
  const arr = typeof lines === "string" ? [lines] : lines;
  return (
    <h2
      className={cn(
        "text-balance text-[clamp(2rem,3.4vw,3.125rem)] font-bold leading-[1.09] tracking-tight",
        tone === "onDeep" ? "text-deep-foreground" : "text-foreground",
        className
      )}
    >
      {arr.map((l, i) => (
        <span key={i} className="block">
          {l}
        </span>
      ))}
    </h2>
  );
}

export function Lead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-[15.5px] leading-[1.68] text-muted-foreground", className)}>
      {children}
    </p>
  );
}

/** Mono key/value chip used for telemetry and tags. */
export function Chip({
  label,
  value,
  tone = "neutral",
  className,
}: {
  label?: string;
  value: ReactNode;
  tone?: "neutral" | "warning";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2.5 rounded-md border px-3 font-mono",
        tone === "warning"
          ? "border-warning-border bg-warning-muted text-warning-foreground"
          : "border-border bg-background/90 text-foreground",
        className
      )}
    >
      {label ? (
        <span
          className={cn(
            "text-[10px] tracking-[0.09em]",
            tone === "warning" ? "text-warning-foreground" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
      ) : null}
      <span className="text-[12.5px]">{value}</span>
    </span>
  );
}

export function SeverityChip({ level }: { level: "Healthy" | "Moderate" | "Severe" | string }) {
  const map: Record<string, string> = {
    Healthy: "border-accent bg-secondary text-secondary-foreground",
    Moderate: "border-warning-border bg-warning-muted text-warning-foreground",
    Severe: "border-destructive-border bg-destructive-muted text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2.5 text-[11.5px] font-semibold",
        map[level] ?? "border-border bg-muted text-muted-foreground"
      )}
    >
      {level}
    </span>
  );
}

/** Big mono figure over a caption: the stat card used in several sections. */
export function StatCard({
  value,
  caption,
  highlight = false,
}: {
  value: string;
  caption: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        highlight ? "border-accent bg-secondary" : "border-border bg-background"
      )}
    >
      <div
        className={cn(
          "font-mono text-[clamp(1.25rem,1.8vw,1.65rem)] font-medium",
          highlight ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          "mt-1.5 text-[13px] leading-snug",
          highlight ? "text-secondary-foreground" : "text-muted-foreground"
        )}
      >
        {caption}
      </div>
    </div>
  );
}

export function ArrowRight({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Check({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="7.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5 8.2 7.1 10.3 11 6.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AegisMark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2.2 20.5 7v10L12 21.8 3.5 17V7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.4 8.4 15.6 15.6M15.6 8.4 8.4 15.6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8.4" cy="8.4" r="1.8" fill="currentColor" />
      <circle cx="15.6" cy="8.4" r="1.8" fill="currentColor" />
      <circle cx="8.4" cy="15.6" r="1.8" fill="currentColor" />
      <circle cx="15.6" cy="15.6" r="1.8" fill="currentColor" />
    </svg>
  );
}

/**
 * The AEGIS letterforms on a 0-495 x 0-100 grid: crossbar-less A, geometric E,
 * G with a mid-height bar, I, and a two-arc S. Exported so the mark on the
 * aircraft is the same drawing as the wordmark, not a font approximation.
 */
export const AEGIS_LETTERFORMS = [
  "M0,100 L42,0 L84,100",
  "M133.5,0 V100 M133.5,3.5 H192 M133.5,50 H184 M133.5,96.5 H192",
  "M320.8,28.75 A42.5,42.5 0 1 0 326.5,50 L296,50",
  "M379.5,0 V100",
  "M484.66,14.93 A25,25 0 1 0 462,50.5 A25,25 0 1 1 439.34,85.07",
];

/**
 * The AEGIS wordmark, drawn rather than set: a thin geometric construction
 * with a crossbar-less A and wide tracking. Uniform stroke weight, so it
 * stays a hairline at any size and inherits currentColor.
 */
export function AegisWordmark({
  height = 18,
  className,
  strokeWidth = 8,
}: {
  height?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      height={height}
      width={(height * 507) / 112}
      viewBox="-6 -6 507 112"
      fill="none"
      className={className}
      role="img"
      aria-label="AEGIS"
    >
      <g
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        strokeLinejoin="miter"
      >
        {AEGIS_LETTERFORMS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
