import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";
import { getBookingsData } from "@/lib/admin-data";
import { formatTimeInBusinessZone, formatWeekdayTimeInBusinessZone, isTodayInBusinessZone } from "@/lib/timezone";
import { updateBookingStatusAction } from "../actions";
import { BookingsSkeleton } from "@/components/skeletons/bookings-skeleton";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function BookingsContent(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const saved = typeof searchParams.saved === "string" ? searchParams.saved : null;
  const locationFilter = typeof searchParams.location === "string" ? searchParams.location : "all";
  const statusFilter = typeof searchParams.status === "string" ? searchParams.status : "all";
  const data = await getBookingsData();
  const bookings = data.bookings.filter((booking) => {
    const matchesLocation = locationFilter === "all" || booking.locations?.slug === locationFilter;
    const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
    return matchesLocation && matchesStatus;
  });

  return (
    <div className="min-h-screen">
      <PageHeader title="Bookings" />
      <div className="px-8 py-7">
        {saved === "status" ? <div className="mb-5"><StatusBanner kind="success" message="Booking status updated." /></div> : null}
        {saved === "config-error" ? <div className="mb-5"><StatusBanner kind="warning" message="Admin environment is not fully configured." /></div> : null}

        <div className="mb-5 flex items-end justify-between">
          <p className="font-mono text-[14px] uppercase tracking-[0.22em] text-[#8f8577]">All upcoming bookings</p>
          <form className="flex gap-3" method="get">
            <select name="location" defaultValue={locationFilter} className="select-field min-w-[132px] bg-[#3a3832] text-[#f3ecdf]">
              <option value="all">All locations</option>
              <option value="pikesville">Pikesville</option>
              <option value="towson">Towson</option>
              <option value="mobile">Mobile</option>
            </select>
            <select name="status" defaultValue={statusFilter} className="select-field min-w-[132px] bg-[#3a3832] text-[#f3ecdf]">
              <option value="all">All statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
              <option value="no_show">No show</option>
            </select>
            <button type="submit" className="ghost-button text-[#f5f0e8]">Apply</button>
          </form>
        </div>

        <div className="panel overflow-hidden">
          <div className="grid grid-cols-[150px_1.4fr_1fr_170px] border-b border-[rgba(255,255,255,0.06)] bg-[#24232b] px-5 py-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[#857c6e]">
            <span>Time</span>
            <span>Customer / Service</span>
            <span>Location</span>
            <span>Status</span>
          </div>

          {bookings.map((booking) => {
            const timeLabel = isTodayInBusinessZone(booking.appointment_start)
              ? formatTimeInBusinessZone(booking.appointment_start)
              : formatWeekdayTimeInBusinessZone(booking.appointment_start);

            return (
              <details key={booking.id} className="border-b border-[rgba(255,255,255,0.06)] last:border-b-0">
                <summary className="grid cursor-pointer list-none grid-cols-[150px_1.4fr_1fr_170px] items-center px-5 py-6">
                  <span className="font-mono text-[24px] tracking-[0.16em] text-[#d8b960]">{timeLabel}</span>
                  <div className="grid gap-1">
                    <span className="text-[16px] font-semibold leading-7 text-[#f5f0e8]">{booking.customer_name}</span>
                    <span className="text-[15px] text-[#b6ab97]">{booking.services?.name ?? "Service"} · {booking.vehicle_type}</span>
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
                  <span className="rounded-[6px] bg-[rgba(245,240,232,0.06)] px-3 py-2 text-center text-[13px] capitalize text-[#d9d2c6]">
                    {booking.status.replace("_", " ")}
                  </span>
                </summary>
                <div className="grid gap-4 bg-[#1f1e25] px-5 pb-5 pt-1 md:grid-cols-[1fr_220px]">
                  <div className="grid gap-2 text-[14px] leading-7 text-[#bdb19e]">
                    <p><span className="text-[#f5f0e8]">Phone:</span> {booking.customer_phone}</p>
                    <p><span className="text-[#f5f0e8]">Email:</span> {booking.customer_email ?? "Not provided"}</p>
                    <p><span className="text-[#f5f0e8]">Notes:</span> {booking.notes ?? "No notes"}</p>
                  </div>
                  <form action={updateBookingStatusAction} className="grid gap-2 self-start">
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <select name="status" defaultValue={booking.status} className="select-field bg-[#3a3832] text-[#f3ecdf]">
                      <option value="confirmed">Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="completed">Completed</option>
                      <option value="no_show">No show</option>
                    </select>
                    <button type="submit" className="action-button justify-center">Update status</button>
                  </form>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function BookingsPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<BookingsSkeleton />}>
      <BookingsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
