import { formatCurrentDateLabelInBusinessZone } from "@/lib/timezone";

type PageHeaderProps = {
  title: string;
};

export function PageHeader({ title }: PageHeaderProps) {
  const dateLabel = formatCurrentDateLabelInBusinessZone();

  return (
    <header className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-8 py-7">
      <h1 className="font-serif text-[24px] text-[#f6f0e8]">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#232228] px-4 py-3 font-mono text-[12px] tracking-[0.22em] text-[#b8ac8f]">
          {dateLabel}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(201,168,76,0.32)] bg-[rgba(201,168,76,0.08)] font-mono text-[14px] font-medium text-[#d5b655]">
          QM
        </div>
      </div>
    </header>
  );
}
