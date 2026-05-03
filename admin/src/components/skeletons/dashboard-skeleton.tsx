import { Skeleton } from '../skeleton';

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="px-8 py-7">
        <Skeleton className="mb-8 h-8 w-64" />

        <section className="panel mb-6 flex items-start justify-between px-8 py-6">
          <div className="flex items-start gap-5">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="mb-2 h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-10">
            <div className="text-right">
              <Skeleton className="mb-2 h-9 w-24 ml-auto" />
              <Skeleton className="h-3 w-20 ml-auto" />
            </div>
            <div className="text-right">
              <Skeleton className="mb-2 h-9 w-16 ml-auto" />
              <Skeleton className="h-3 w-24 ml-auto" />
            </div>
            <div className="text-right">
              <Skeleton className="mb-2 h-9 w-20 ml-auto" />
              <Skeleton className="h-3 w-28 ml-auto" />
            </div>
          </div>
        </section>

        <section className="mb-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <article key={i} className="panel min-h-[170px] px-6 py-5">
              <Skeleton className="mb-6 h-3 w-24" />
              <Skeleton className="mb-2 h-12 w-20" />
              <Skeleton className="h-3 w-32" />
            </article>
          ))}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>

          <div className="panel overflow-hidden">
            <div className="grid grid-cols-[160px_1.5fr_1fr] border-b border-[rgba(255,255,255,0.06)] bg-[#24232b] px-5 py-4">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>

            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[160px_1.5fr_1fr] items-center border-b border-[rgba(255,255,255,0.06)] px-5 py-6 last:border-b-0"
              >
                <Skeleton className="h-6 w-16" />
                <div className="flex items-center gap-6">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
