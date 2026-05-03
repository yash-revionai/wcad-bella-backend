type StatusBannerProps = {
  kind?: "info" | "success" | "warning";
  message: string;
};

export function StatusBanner({ kind = "info", message }: StatusBannerProps) {
  const styles =
    kind === "success"
      ? "border-[rgba(79,158,124,0.28)] bg-[rgba(79,158,124,0.1)] text-[var(--color-foreground)]"
      : kind === "warning"
        ? "border-[rgba(201,168,76,0.28)] bg-[rgba(201,168,76,0.1)] text-[var(--color-foreground)]"
        : "border-[rgba(245,240,232,0.08)] bg-[rgba(245,240,232,0.04)] text-[var(--color-muted)]";

  return <div className={`rounded-[8px] border px-4 py-3 text-sm leading-7 ${styles}`}>{message}</div>;
}
