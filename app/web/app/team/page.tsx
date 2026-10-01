import type { Metadata } from "next";
import Link from "next/link";
import { meta } from "@/lib/content";
import { roster, team } from "@/lib/team";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/sections/site-footer";
import { TeamCard } from "@/components/team/team-card";
import { ArrowRight, Eyebrow, Lead, SectionTitle } from "@/components/ui/bits";

export const metadata: Metadata = {
  title: "Team · AEGIS",
  description:
    "Team AEGIS (TH10-HW) is building a field-deployable AI farming assistant for Smart India Hackathon 2026, problem statement 26180.",
};

export default function TeamPage() {
  return (
    <>
      <main className="flex-1">
        <SiteNav />

        {/* hero */}
        <section className="relative overflow-hidden bg-background px-6 pb-16 pt-10 md:px-16 md:pb-20">
          <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
          <div className="mx-auto max-w-[1312px]">
            <Eyebrow>{team.eyebrow}</Eyebrow>
            <SectionTitle className="mt-5 max-w-[900px]" lines={team.headline} />
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.26em] text-primary sm:text-[11.5px] sm:tracking-[0.3em]">
              {meta.fullName}
            </p>
            <Lead className="mt-6 max-w-[680px] text-base">{team.sub}</Lead>
          </div>
        </section>

        {/* roster */}
        <section className="bg-muted px-6 py-16 md:px-16 md:py-20">
          <div className="mx-auto max-w-[1312px]">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {roster.map((m) => (
                <TeamCard key={m.name} member={m} />
              ))}
            </div>
          </div>
        </section>

        {/* back to the project */}
        <div className="bg-deep">
          <section className="relative overflow-hidden px-6 py-20 md:px-16">
            <div className="absolute inset-x-0 top-0 h-[220px] aegis-dusk" />
            <div className="relative mx-auto flex max-w-[1312px] flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-[clamp(1.375rem,2.2vw,1.75rem)] font-bold tracking-tight text-deep-foreground">
                  See what the team is building.
                </h2>
                <p className="mt-2 max-w-[520px] text-[14.5px] leading-[1.62] text-deep-muted">
                  Two passes over the field, four layers, and an alert you can argue with.
                </p>
              </div>
              <Link
                href="/#two-pass"
                className="flex h-12 shrink-0 items-center gap-2.5 rounded-md bg-chart-1 px-6 text-[14.5px] font-bold text-deep transition-opacity hover:opacity-90"
              >
                See the two-pass flow
                <ArrowRight />
              </Link>
            </div>
          </section>
          <SiteFooter />
        </div>
      </main>
    </>
  );
}
