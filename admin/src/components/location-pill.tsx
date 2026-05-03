type LocationPillProps = {
  slug: string;
};

const locationStyles: Record<string, string> = {
  pikesville: "bg-[rgba(201,168,76,0.16)] text-[var(--color-gold)]",
  towson: "bg-[rgba(75,120,184,0.16)] text-[var(--color-blue)]",
  mobile: "bg-[rgba(79,158,124,0.16)] text-[var(--color-green)]",
};

export function LocationPill({ slug }: LocationPillProps) {
  return (
    <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${locationStyles[slug] ?? "bg-[rgba(245,240,232,0.08)] text-[var(--color-muted)]"}`}>
      {slug}
    </span>
  );
}
