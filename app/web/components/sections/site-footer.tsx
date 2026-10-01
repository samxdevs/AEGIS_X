import { footer, meta } from "@/lib/content";
import { AegisMark, AegisWordmark } from "@/components/ui/bits";

/** Shared across the landing page and /team. Always sits on the deep panel. */
export function SiteFooter() {
  return (
    <footer className="relative border-t border-deep-border px-6 pb-10 pt-11 md:px-16">
      <div className="mx-auto grid max-w-[1312px] gap-10 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_200px_200px_240px]">
        <div>
          <div className="flex items-center gap-3">
            <AegisMark className="text-chart-1" />
            <AegisWordmark height={17} className="text-deep-foreground" />
          </div>
          <p className="mt-3.5 max-w-[300px] font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.18em] text-chart-1">
            {meta.fullName}
          </p>
          <p className="mt-3 max-w-[280px] text-[13.5px] leading-[1.62] text-deep-muted">
            {footer.blurb}
          </p>
        </div>

        {footer.columns.map((col) => (
          <div key={col.title}>
            <div className="font-mono text-[10px] tracking-[0.1em] text-deep-muted/80">
              {col.title}
            </div>
            <ul className="mt-2.5 space-y-1 text-[13.5px] leading-[2.05] text-deep-muted">
              {col.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 flex max-w-[1312px] flex-col gap-2 border-t border-deep-border pt-5 md:flex-row md:items-center md:justify-between">
        <span className="font-mono text-[11px] text-deep-muted/80">{footer.legal}</span>
        <span className="font-mono text-[11px] text-deep-muted/80">{footer.team}</span>
      </div>
    </footer>
  );
}
