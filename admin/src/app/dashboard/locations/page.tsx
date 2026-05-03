import { PageHeader } from "@/components/page-header";
import { getLocationsData } from "@/lib/admin-data";

export default async function LocationsPage() {
  const data = await getLocationsData();

  return (
    <div className="min-h-screen">
      <PageHeader title="Locations" />
      <div className="overflow-x-auto px-8 py-7">
        <div className="flex min-w-[980px] gap-4">
          {data.locations.map((location) => (
            <article key={location.id} className="panel w-[290px] shrink-0 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      location.slug === "pikesville" ? "bg-[#d3b149]" : location.slug === "towson" ? "bg-[#6398cc]" : "bg-[#56b989]"
                    }`}
                  />
                  <h2 className="text-[24px] font-semibold text-[#f5f0e8]">
                    {location.slug === "pikesville" ? "Pikesville" : location.slug === "towson" ? "Towson" : "Mobile"}
                  </h2>
                </div>
                <div className="relative h-7 w-12 rounded-full bg-[rgba(73,151,115,0.28)]">
                  <div className="absolute right-1 top-1 h-5 w-5 rounded-full bg-[#61be8b]" />
                </div>
              </div>

              <p className="text-[18px] leading-8 text-[#beb29f]">{location.hoursSummary}</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[8px] bg-[#26252d] px-4 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#80786b]">{location.unitsLabel}</p>
                  <p className="mt-3 text-[34px] text-[#f5f0e8]">{location.capacity}</p>
                </div>
                <div className="rounded-[8px] bg-[#26252d] px-4 py-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#80786b]">Buffer</p>
                  <p className="mt-3 text-[34px] text-[#f5f0e8]">{location.buffer}</p>
                </div>
              </div>

              <p className="mt-5 max-w-[180px] text-[16px] leading-7 text-[#8f8779]">{location.shortAddress}</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button className="ghost-button min-h-[48px] justify-center text-[#d9d2c6]">View calendar</button>
                <button className="action-button min-h-[48px] justify-center">Edit settings</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
