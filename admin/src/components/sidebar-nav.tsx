"use client";

import { CalendarDays, Clock3, LayoutGrid, MapPin, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/schedule", label: "Schedule", icon: Clock3 },
      { href: "/dashboard/locations", label: "Locations", icon: MapPin },
    ],
  },
  {
    label: "System",
    items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings2 }],
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden min-h-screen w-[220px] shrink-0 flex-col border-r border-[rgba(255,255,255,0.06)] bg-[#121216] lg:flex">
        <div className="px-8 py-9">
          <p className="font-serif text-[24px] font-semibold text-[#d5b655]">Bella Admin</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.28em] text-[#9a9382]">Operations</p>
        </div>
        <div className="border-t border-[rgba(255,255,255,0.06)] px-8 py-5">
          <p className="text-[13px] text-[#9d968a]">Client</p>
          <p className="mt-2 text-[14px] font-medium text-[#f5f0e8]">World Class Auto Detail</p>
        </div>
        <div className="border-t border-[rgba(255,255,255,0.06)] px-4 py-6">
          <div className="grid gap-7">
            {sections.map((section) => (
              <div key={section.label}>
                <p className="px-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[#7e786d]">{section.label}</p>
                <div className="mt-3 grid gap-1">
                  {section.items.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex h-[38px] items-center gap-3 rounded-[6px] px-4 text-[15px] transition ${
                          active ? "bg-[rgba(201,168,76,0.1)] text-[#d5b655]" : "text-[#b8ad96] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#f5f0e8]"
                        }`}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto p-12 pt-6">
          <div className="rounded-[6px] border border-[rgba(72,138,108,0.4)] bg-[rgba(18,44,35,0.5)] px-4 py-3 text-[13px] text-[#6bd8a0]">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#3cd687]" />
            Live data
          </div>
        </div>
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(255,255,255,0.06)] bg-[#111115] px-2 py-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {sections.flatMap((section) => section.items).map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-[8px] px-2 text-[11px] ${
                  active ? "bg-[rgba(201,168,76,0.12)] text-[#d5b655]" : "text-[#9c9487]"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
