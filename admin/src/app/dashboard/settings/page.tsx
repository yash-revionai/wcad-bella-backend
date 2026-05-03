import Link from "next/link";
import { CalendarDays, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";
import { getSettingsData } from "@/lib/admin-data";
import { disconnectGoogleAction, saveGoogleMappingAction } from "../actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SettingsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const saved = typeof searchParams.saved === "string" ? searchParams.saved : null;
  const data = await getSettingsData();

  return (
    <div className="min-h-screen">
      <PageHeader title="Settings" />
      <div className="px-8 py-7">
        {saved === "mapping" ? <div className="mb-5"><StatusBanner kind="success" message="Calendar mapping saved." /></div> : null}
        {saved === "disconnect" ? <div className="mb-5"><StatusBanner kind="success" message="Google Calendar disconnected." /></div> : null}
        {saved === "demo" ? <div className="mb-5"><StatusBanner kind="info" message="This action is a demo until backend env vars are configured." /></div> : null}

        <div className="grid max-w-[860px] gap-4">
          <section className="panel p-6">
            <h2 className="text-[28px] font-semibold text-[#f5f0e8]">Google Calendar</h2>
            <p className="mt-2 text-[16px] leading-7 text-[#a69b8d]">
              Bella reads your calendars to check availability and writes new bookings directly.
            </p>
            <div className="mt-5 rounded-[8px] border border-[rgba(70,123,92,0.42)] bg-[rgba(27,48,39,0.55)] px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-[#2d3233] text-[#e4ddd1]">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[18px] font-semibold text-[#f5f0e8]">
                      {data.google.connected ? "Connected — 3 location calendars active" : "Google Calendar disconnected"}
                    </p>
                    <p className="text-[15px] text-[#b7ab98]">worldclassautodetail@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {data.google.backendUrl ? (
                    <Link href={`${data.google.backendUrl}/api/auth/google`} className="ghost-button text-[#f5f0e8]">
                      Reconnect
                    </Link>
                  ) : null}
                  <form action={disconnectGoogleAction}>
                    <button type="submit" className="ghost-button text-[#f5f0e8]">Disconnect</button>
                  </form>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                { label: "World Class - Pikesville", color: "bg-[#d3b149]", mapped: Boolean(data.google.locations.find(l => l.slug === "pikesville")?.google_calendar_id) },
                { label: "World Class - Towson", color: "bg-[#6398cc]", mapped: Boolean(data.google.locations.find(l => l.slug === "towson")?.google_calendar_id) },
                { label: "World Class - Mobile", color: "bg-[#56b989]", mapped: Boolean(data.google.locations.find(l => l.slug === "mobile")?.google_calendar_id) },
              ].map((item) => (
                <div key={item.label} className="rounded-[8px] bg-[#26252d] px-4 py-3 text-[15px] text-[#c5baaa]">
                  <span className={`mr-3 inline-block h-2.5 w-2.5 rounded-full ${item.color}`} />
                  {item.label}
                  {item.mapped ? <span className="ml-auto float-right text-[#67cb96] text-[12px]">✓</span> : null}
                </div>
              ))}
            </div>

            {data.google.connected && data.google.calendarOptions.length > 0 && (
              <form action={saveGoogleMappingAction} className="mt-6 border-t border-[rgba(245,240,232,0.08)] pt-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#80786b]">Map Calendars</p>
                <p className="mt-2 text-[14px] text-[#9c9487]">
                  Link each Google Calendar to the right location. Bella reads the main calendar as a busy overlay and writes new bookings to each location calendar.
                </p>
                <div className="mt-4 grid gap-4">
                  {[
                    { label: "Main / PocketSuite (read-only busy overlay)", name: "mainCalendarId", current: data.google.mainCalendarId },
                    { label: "World Class — Pikesville", name: "pikesvilleCalendarId", current: data.google.locations.find(l => l.slug === "pikesville")?.google_calendar_id ?? null },
                    { label: "World Class — Towson", name: "towsonCalendarId", current: data.google.locations.find(l => l.slug === "towson")?.google_calendar_id ?? null },
                    { label: "World Class — Mobile", name: "mobileCalendarId", current: data.google.locations.find(l => l.slug === "mobile")?.google_calendar_id ?? null },
                  ].map(({ label, name, current }) => (
                    <div key={name}>
                      <label className="block text-[13px] text-[#b7ab98] mb-1.5">{label}</label>
                      <select name={name} defaultValue={current ?? ""} className="select-field">
                        <option value="">Select a calendar...</option>
                        {data.google.calendarOptions.map((cal) => (
                          <option key={cal.id} value={cal.id}>{cal.summary}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <button type="submit" className="action-button">Save Mapping</button>
                </div>
              </form>
            )}

            {data.google.connected && data.google.calendarOptions.length === 0 && (
              <p className="mt-4 text-[14px] text-[#9c9487]">No calendars found in the connected account. Try reconnecting Google Calendar.</p>
            )}
          </section>

          <section className="panel p-6">
            <h2 className="text-[28px] font-semibold text-[#f5f0e8]">Bella — Voice Agent</h2>
            <p className="mt-2 text-[16px] leading-7 text-[#a69b8d]">
              Ultravox voice agent answering all inbound calls for World Class Auto Detail.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-[8px] bg-[#26252d] px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#80786b]">Status</p>
                <p className="mt-4 text-[22px] text-[#67cb96]">• Active</p>
              </div>
              <div className="rounded-[8px] bg-[#26252d] px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#80786b]">Transfer — Primary</p>
                <p className="mt-4 text-[22px] text-[#f5f0e8]">443-957-4789</p>
              </div>
              <div className="rounded-[8px] bg-[#26252d] px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#80786b]">Transfer — Fallback</p>
                <p className="mt-4 text-[22px] text-[#f5f0e8]">443-463-3533</p>
              </div>
            </div>
          </section>

          <section className="panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[28px] font-semibold text-[#f5f0e8]">Notifications</h2>
                <p className="mt-2 text-[16px] leading-7 text-[#a69b8d]">What customers receive after Bella confirms a booking.</p>
              </div>
              <button className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#26252d] text-[#9c9487]">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {[
                {
                  title: "SMS confirmation",
                  subtitle: "Sent immediately after booking via Twilio",
                  active: data.notifications.smsEnabled,
                },
                {
                  title: "Email confirmation",
                  subtitle: "Sent immediately after booking via Resend",
                  active: data.notifications.emailEnabled,
                },
              ].map((item) => (
                <div key={item.title} className="rounded-[8px] bg-[#26252d] px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[22px] font-medium text-[#f5f0e8]">{item.title}</p>
                      <p className="mt-1 text-[15px] text-[#8e8578]">{item.subtitle}</p>
                    </div>
                    <p className="text-[16px] text-[#67cb96]">{item.active ? "Active" : "Pending"}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
