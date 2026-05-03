import { Skeleton } from '../skeleton';

export function BookingsSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="px-8 py-7">
        <Skeleton className="mb-8 h-8 w-40" />

        <div className="mb-5 flex items-end justify-between">
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32 rounded" />
            <Skeleton className="h-10 w-32 rounded" />
            <Skeleton className="h-10 w-20 rounded" />
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="grid grid-cols-[150px_1.4fr_1fr_170px] border-b border-[rgba(255,255,255,0.06)] bg-[#24232b] px-5 py-4">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>

          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="border-b border-[rgba(255,255,255,0.06)] px-5 py-6 last:border-b-0"
            >
              <div className="grid grid-cols-[150px_1.4fr_1fr_170px] items-center mb-3">
                <Skeleton className="h-6 w-16" />
                <div className="flex items-center gap-6">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
