import Image from "next/image";
import { monogram, type TeamMember } from "@/lib/team";

function GlobeGlyph({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3 12h18M12 3c2.3 2.5 3.5 5.6 3.5 9s-1.2 6.5-3.5 9c-2.3-2.5-3.5-5.6-3.5-9S9.7 5.5 12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function LinkedInGlyph({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM2.9 21.5h4.2V9.4H2.9v12.1ZM9.6 9.4h4v1.65h.06c.56-1.02 1.93-2.1 3.97-2.1 4.25 0 5.03 2.66 5.03 6.12v6.43h-4.19v-5.7c0-1.36-.03-3.11-1.94-3.11-1.94 0-2.24 1.48-2.24 3.01v5.8H9.6V9.4Z" />
    </svg>
  );
}

export function TeamCard({ member }: { member: TeamMember }) {
  // A profile link and a personal site want different labels, so read it off
  // the URL rather than carrying a redundant field in the data.
  const isLinkedIn = member.url?.includes("linkedin.com") ?? false;

  return (
    <article className="flex flex-col rounded-xl border border-border bg-background p-6">
      <div className="flex items-center gap-4">
        {member.photo ? (
          <Image
            src={`/team/${member.photo}`}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full border border-accent bg-secondary font-mono text-[15px] tracking-[0.06em] text-secondary-foreground"
          >
            {monogram(member.name)}
          </span>
        )}

        <h3 className="min-w-0 text-[17px] font-bold tracking-tight text-foreground">
          {member.name}
        </h3>
      </div>

      {member.url ? (
        <a
          href={member.url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-muted px-4 text-[13px] font-semibold text-foreground transition-colors hover:border-accent hover:bg-secondary hover:text-secondary-foreground"
        >
          {isLinkedIn ? <LinkedInGlyph /> : <GlobeGlyph />}
          {isLinkedIn ? "LinkedIn" : "Website"}
        </a>
      ) : null}
    </article>
  );
}
