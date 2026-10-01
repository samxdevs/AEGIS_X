/**
 * Team roster.
 *
 * To add a photo: drop a square image in `public/team/` and set `photo` to its
 * filename. Without one the card falls back to a monogram.
 */
export type TeamMember = {
  name: string;
  /** Profile URL. Omit it and the card simply carries no link. */
  url?: string;
  photo?: string;
};

export const team = {
  eyebrow: "TEAM TH10-HW",
  headline: ["The people who have", "to make it fly."],
  sub: "Team AEGIS is building a field-deployable scouting drone for Smart India Hackathon 2026, problem statement 26180. Four layers, one offline system, and a six-week build order that ends in a live two-pass field demonstration.",
  members: [
    {
      name: "Vitthal Goel",
      url: "https://vitthalgoel.com",
    },
    {
      name: "Suman Mondal",
      url: "https://www.linkedin.com/in/suman-mondal-315954273/",
    },
    {
      // display name inferred from the profile slug, correct it if it is wrong
      name: "Mohd Ahsan",
      url: "https://www.linkedin.com/in/mohd-ahsan8178/",
    },
    {
      // display name inferred from the profile slug, correct it if it is wrong
      name: "Sania Malik",
      url: "https://www.linkedin.com/in/saniamalik08",
    },
    {
      name: "Samriddh Murgai",
      url: "https://www.linkedin.com/in/samriddh-murgai-5128b33b6",
    },
    {
      name: "Akshat Bisht",
      url: "https://www.linkedin.com/in/akshat-bisht-0122ab3a1",
    },
  ] satisfies TeamMember[] as TeamMember[],
} as const;

/** The roster, A-Z by name, so additions stay ordered without anyone re-sorting. */
export const roster: TeamMember[] = [...team.members].sort((a, b) =>
  a.name.localeCompare(b.name)
);

/** "Vitthal Goel" -> "VG" */
export function monogram(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
