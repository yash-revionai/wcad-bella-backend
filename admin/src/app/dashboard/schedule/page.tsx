import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";
import { getScheduleData } from "@/lib/admin-data";
import { createOverrideAction, updateLocationSettingsAction } from "../actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SchedulePage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const saved = typeof searchParams.saved === "string" ? searchParams.saved : null;
  const data = await getScheduleData();
  const primaryLocations = data.locations.filter((location) => location.slug !== "mobile");
  const mobileLocation = data.locations.find((location) => location.slug === "mobile");
  const activeBlocks = data.locations.flatMap((location) =>
    location.overrides.map((override) => ({
      ...override,
      locationName: location.slug === "towson" ? "Towson" : location.slug === "pikesville" ? "Pikesville" : "All locations",
    })),
  );

  return (
    <div className="min-h-screen">
      <PageHeader title="Schedule" />
      <div className="px-8 py-7">
        {saved === "hours" ? <div className="mb-5"><StatusBanner kind="success" message="Location hours updated." /></div> : null}
        {saved === "override" ? <div className="mb-5"><StatusBanner kind="success" message="Day override saved." /></div> : null}
        {saved === "demo" ? <div className="mb-5"><StatusBanner kind="info" message="This action is a demo until admin server env vars are configured." /></div> : null}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="panel p-6">
            <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-[#8f8577]">Block a day off</p>
            <form action={createOverrideAction} className="mt-5 grid gap-4">
              <div className="grid grid-cols-[0.9fr_1fr_1fr_auto] gap-3">
                <select name="locationId" className="select-field bg-[#3a3832] text-[#f3ecdf]" defaultValue={data.locations[0]?.id}>
                  {data.locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.slug === "pikesville" ? "Pike" : location.slug === "towson" ? "Towson" : "Mobile"}
                    </option>
                  ))}
                </select>
                <input name="overrideDate" type="date" className="field bg-[#3a3832]" required />
                <input name="overrideReason" type="text" className="field bg-[#3a3832]" placeholder="e.g." />
                <button type="submit" className="ghost-button justify-center text-[#f5f0e8]">Block</button>
              </div>
              <label className="hidden">
                <input type="checkbox" name="overrideClosed" defaultChecked />
              </label>

              <div>
                <p className="mb-3 font-mono text-[12px] uppercase tracking-[0.2em] text-[#777062]">Active blocks</p>
                <div className="grid gap-2">
                  {activeBlocks.map((block) => (
                    <div key={`${block.locationName}-${block.override_date}`} className="rounded-[6px] bg-[#26252d] px-4 py-3 text-[14px] text-[#beb29f]">
                      <span className="mr-5 font-mono text-[#d8b960]">{new Date(block.override_date).toLocaleDateString("en-US", { month: "short", day: "2-digit" }).toUpperCase()}</span>
                      <span className="mr-4">{block.locationName}</span>
                      <span className="italic text-[#8d8578]">{block.reason ?? "Blocked"}</span>
                      <span className="float-right text-[#ba5f61]">Remove</span>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          </section>

          <section className="panel p-6">
            <p className="font-mono text-[13px] uppercase tracking-[0.22em] text-[#8f8577]">Same-day rules</p>
            <div className="mt-5 rounded-[8px] bg-[#26252d] p-5">
              <p className="text-[15px] text-[#f5f0e8]">Mobile cutoff</p>
              <p className="mt-2 font-serif text-[40px] text-[#d8b960]">{mobileLocation?.same_day_cutoff_time ?? "14:00"}</p>
              <p className="mt-2 text-[14px] text-[#9f978b]">After this time, Bella should offer the next day instead of same-day mobile service.</p>
            </div>
          </section>
        </div>

        <section className="mt-10">
          <p className="mb-5 font-mono text-[13px] uppercase tracking-[0.22em] text-[#8f8577]">Location hours</p>
          <div className="grid gap-5 xl:grid-cols-3">
            {primaryLocations.concat(mobileLocation ? [mobileLocation] : []).map((location) => (
              <form key={location.id} action={updateLocationSettingsAction} className="panel overflow-hidden p-5">
                <input type="hidden" name="locationId" value={location.id} />
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      location.slug === "pikesville" ? "bg-[#d3b149]" : location.slug === "towson" ? "bg-[#6398cc]" : "bg-[#56b989]"
                    }`}
                  />
                  <h3 className="text-[24px] font-semibold text-[#f5f0e8]">
                    {location.slug === "pikesville" ? "Pikesville" : location.slug === "towson" ? "Towson" : "Mobile"}
                  </h3>
                </div>

                <div className="schedule-hours-shell px-5 py-4">
                  {location.hours
                    .filter((hour) => [1, 6, 0].includes(hour.day_of_week))
                    .sort((a, b) => a.day_of_week - b.day_of_week)
                    .map((hour) => {
                      const label = hour.day_of_week === 1 ? "Mon–Fri" : hour.day_of_week === 6 ? "Saturday" : "Sunday";
                      const defaultOpen = hour.day_of_week === 1 ? "09:00" : hour.open_time ?? "";
                      const defaultClose = hour.day_of_week === 1 ? "17:00" : hour.close_time ?? "";
                      return (
                        <div
                          key={hour.day_of_week}
                          className={`border-b border-[rgba(255,255,255,0.06)] py-4 last:border-b-0 ${
                            hour.day_of_week === 0 ? "schedule-hours-row-closed" : "schedule-hours-row"
                          }`}
                        >
                          <span className="text-[18px] text-[#b7ad9d]">{label}</span>
                          {hour.day_of_week === 0 ? (
                            <>
                              <input type="hidden" name={`closed-${hour.day_of_week}`} value="on" />
                              <span className="text-[16px] font-medium text-[#d56662]">Closed</span>
                            </>
                          ) : (
                            <>
                              <input
                                name={`open-${hour.day_of_week}`}
                                type="time"
                                defaultValue={defaultOpen}
                                className="schedule-time-input"
                              />
                              <input
                                name={`close-${hour.day_of_week}`}
                                type="time"
                                defaultValue={defaultClose}
                                className="schedule-time-input"
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>

                <input type="hidden" name="sameDayCutoff" value={location.same_day_cutoff_time ?? ""} />
                <button type="submit" className="ghost-button mt-4 w-full justify-center text-[#f5f0e8]">Save hours</button>
              </form>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
