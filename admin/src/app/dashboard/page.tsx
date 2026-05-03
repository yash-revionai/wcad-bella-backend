import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";
import { getDashboardData } from "@/lib/admin-data";
import { formatVehicleLabel } from "@/lib/format";
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

async function DashboardContent() {
  const data = await getDashboardData();

  return (
    <div className="min-h-screen">
      <PageHeader title="Good morning, Quintin" />
      <div className="px-8 py-7">
        {data.needsAttention.length > 0 ? (
          <div className="mb-5 grid gap-3">
            {data.needsAttention.map((message) => (
              <StatusBanner key={message} kind="warning" message={message} />
            ))}
          </div>
        ) : null}

        <section className="panel mb-6 flex items-start justify-between px-8 py-6">
          <div className="flex items-start gap-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(201,168,76,0.32)] bg-[rgba(201,168,76,0.08)] font-serif text-[22px] text-[#d8b960]">
              B
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-[#f5f0e8]">Bella is active</h2>
              <p className="mt-1 text-[14px] text-[#a99f92]">
                {data.calendarReady ? "Calendar connected and mapped" : "Calendar setup needs attention"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-10 text-right">
            <div>
              <p className="font-serif text-[36px] leading-none text-[#d8b960]">{data.calendarReady ? "Ready" : "Setup"}</p>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#7e786d]">Calendar</p>
            </div>
            <div>
              <p className="font-serif text-[36px] leading-none text-[#d8b960]">{data.bookingsWeekCount}</p>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#7e786d]">Booked this week</p>
            </div>
            <div>
              <p className="font-serif text-[36px] leading-none text-[#d8b960]">{formatMoney(data.revenueThisWeekCents)}</p>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#7e786d]">Revenue this week</p>
            </div>
          </div>
        </section>

        <section className="mb-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Today’s bookings", value: data.bookingsTodayCount, sublabel: "Across 3 locations" },
            { label: "This week", value: data.bookingsWeekCount, sublabel: "Confirmed bookings" },
            { label: "Calendar", value: data.calendarReady ? "Ready" : "Setup", sublabel: data.googleConnected ? "Connected" : "Disconnected" },
            { label: "Revenue this week", value: formatMoney(data.revenueThisWeekCents), sublabel: "Confirmed bookings" },
          ].map((card) => (
            <article key={card.label} className="panel min-h-[170px] px-6 py-5">
              <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-[#7e786d]">{card.label}</p>
              <p className="mt-6 font-serif text-[52px] leading-none text-[#f5f0e8]">{card.value}</p>
              <p className="mt-2 text-[14px] text-[#9d9587]">{card.sublabel}</p>
            </article>
          ))}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-[#8e8678]">Today&apos;s appointments</p>
            <Link href="/dashboard/bookings" className="text-[14px] font-medium text-[#d8b960]">
              View all →
            </Link>
          </div>

          <div className="panel overflow-hidden">
            <div className="grid grid-cols-[160px_1.5fr_1fr] border-b border-[rgba(255,255,255,0.06)] bg-[#24232b] px-5 py-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[#857c6e]">
              <span>Time</span>
              <span>CustomerService</span>
              <span>Location</span>
            </div>

            {data.todayBookings.map((booking) => (
              <div
                key={booking.id}
                className="grid grid-cols-[160px_1.5fr_1fr] items-center border-b border-[rgba(255,255,255,0.06)] px-5 py-6 last:border-b-0"
              >
                <span className="font-mono text-[28px] tracking-[0.16em] text-[#d8b960]">
                  {new Date(booking.appointment_start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="flex items-center gap-6">
                  <span className="max-w-[150px] text-[16px] font-semibold leading-7 text-[#f5f0e8]">{booking.customer_name}</span>
                  <span className="text-[16px] text-[#b6ab97]">{booking.services?.name ?? formatVehicleLabel(booking.vehicle_type)}</span>
                </div>
                <div className="flex items-center gap-2 text-[16px] text-[#b9b09f]">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      booking.locations?.slug === "pikesville"
                        ? "bg-[#d3b149]"
                        : booking.locations?.slug === "towson"
                          ? "bg-[#6398cc]"
                          : "bg-[#56b989]"
                    }`}
                  />
                  <span>{booking.locations?.slug === "pikesville" ? "Pikesville" : booking.locations?.slug === "towson" ? "Towson" : "Mobile"}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
