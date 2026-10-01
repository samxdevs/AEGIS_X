import { alert } from "@/lib/content";
import { SeverityChip } from "@/components/ui/bits";
import { cn } from "@/lib/utils";

/**
 * The advisory an operator actually receives: class, severity, confidence,
 * the evidence frame it was called on, the ground-node reading that explains
 * it, and one action. "Needs inspection" is a first-class state.
 */
export function AlertCard({
  variant = "compact",
  className,
}: {
  variant?: "compact" | "full";
  className?: string;
}) {
  const full = variant === "full";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-background shadow-xl",
        className
      )}
    >
      {/* evidence frame */}
      <div className={cn("relative aegis-crop-photo", full ? "h-50" : "h-28")}>
        <div
          className="absolute rounded-md"
          style={{
            left: full ? "29%" : "31%",
            top: full ? "26%" : "23%",
            width: full ? "40%" : "34%",
            height: full ? "43%" : "50%",
            background:
              "radial-gradient(ellipse, color-mix(in oklab, var(--warning) 92%, transparent), transparent 72%)",
          }}
        />
        <div
          className="absolute rounded-[4px] border-2 border-warning"
          style={{
            left: full ? "27%" : "28%",
            top: full ? "21%" : "18%",
            width: full ? "45%" : "39%",
            height: full ? "53%" : "61%",
          }}
        />
        {full ? (
          <>
            <span className="absolute left-3 top-3 rounded-md bg-accent px-[7px] py-1 font-mono text-[9.5px] tracking-[0.06em] text-deep">
              {alert.capture}
            </span>
            <span className="absolute bottom-3 left-[27%] rounded-[4px] bg-deep/75 px-1.5 py-[3px] font-mono text-[9.5px] tracking-[0.06em] text-warning-muted">
              {alert.frameNote}
            </span>
          </>
        ) : (
          <span className="absolute left-[28%] top-0 rounded-b-[4px] bg-deep/75 px-1.5 py-[3px] font-mono text-[9.5px] tracking-[0.07em] text-warning-muted">
            {alert.capture}
          </span>
        )}
      </div>

      <div className={cn(full ? "p-[18px]" : "p-4")}>
        <div className="flex items-center justify-between">
          <h3
            className={cn(
              "font-bold tracking-tight text-foreground",
              full ? "text-lg" : "text-[15.5px]"
            )}
          >
            {alert.title}
          </h3>
          <SeverityChip level={alert.severity} />
        </div>

        <p className="mt-1.5 font-mono text-[11.5px] text-muted-foreground">{alert.zone}</p>

        <div className="mt-3.5 flex items-center gap-2.5">
          {full ? (
            <span className="font-mono text-[10px] tracking-[0.08em] text-fg-subtle">CONF</span>
          ) : null}
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-1.5 rounded-full bg-primary"
              style={{ width: `${alert.confidence * 100}%` }}
            />
          </div>
          <span className="font-mono text-[11.5px] text-foreground">
            {alert.confidence.toFixed(2)}
          </span>
        </div>

        {full ? (
          <>
            <div className="mt-4 rounded-md border border-border bg-muted p-3">
              <div className="font-mono text-[9.5px] tracking-[0.1em] text-fg-subtle">WHY</div>
              <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{alert.why}</p>
            </div>
            <div className="mt-2.5 rounded-md border border-accent bg-secondary p-3">
              <div className="font-mono text-[9.5px] tracking-[0.1em] text-primary">CHECK NEXT</div>
              <p className="mt-1.5 text-[13px] leading-snug text-secondary-foreground">
                {alert.action}
              </p>
            </div>
          </>
        ) : (
          <p className="mt-3 border-t border-border pt-3 text-[12.5px] leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">Why:</span> {alert.why}
          </p>
        )}

        <p className="mt-3.5 font-mono text-[9.5px] tracking-[0.1em] text-fg-subtle">
          SAMPLE ALERT · ILLUSTRATIVE VALUES
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(full ? alert.chips : ["NEEDS INSPECTION", "हिन्दी"]).map((c) => (
            <span
              key={c}
              className="flex h-6 items-center rounded-md border border-border bg-muted px-2 font-mono text-[10px] tracking-[0.04em] text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
