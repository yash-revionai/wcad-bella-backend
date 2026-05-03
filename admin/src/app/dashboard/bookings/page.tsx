import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";
import { getBookingsData } from "@/lib/admin-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookingsPage(props: { searchParams: SearchParams }) {
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
        {saved === "demo" ? <div className="mb-5"><StatusBanner kind="info" message="This action is a demo until admin server env vars are configured." /></div> : null}

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
          </form>
        </div>

        <div className="panel overflow-hidden">
          <div className="grid grid-cols-[160px_1.5fr_1fr] border-b border-[rgba(255,255,255,0.06)] bg-[#24232b] px-5 py-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[#857c6e]">
            <span>Time</span>
            <span>CustomerService</span>
            <span>Location</span>
          </div>

          {bookings.map((booking) => {
            const start = new Date(booking.appointment_start);
            const isToday = new Date().toDateString() === start.toDateString();
            const timeLabel = isToday
              ? start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
              : `${start.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()} — ${start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;

            return (
              <div
                key={booking.id}
                className="grid grid-cols-[160px_1.5fr_1fr] items-center border-b border-[rgba(255,255,255,0.06)] px-5 py-6 last:border-b-0"
              >
                <span className="font-mono text-[24px] tracking-[0.16em] text-[#d8b960]">{timeLabel}</span>
                <div className="flex items-center gap-6">
                  <span className="max-w-[150px] text-[16px] font-semibold leading-7 text-[#f5f0e8]">{booking.customer_name}</span>
                  <span className="text-[16px] text-[#b6ab97]">{booking.services?.name ?? "Service"}</span>
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
