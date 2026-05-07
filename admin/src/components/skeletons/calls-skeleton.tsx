import { Skeleton } from '../skeleton';

export function CallsSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="px-8 py-7">
        <Skeleton className="mb-8 h-8 w-40" />

        <div className="mb-5">
          <Skeleton className="h-4 w-48" />
        </div>

        <div className="panel overflow-hidden">
          <div className="grid grid-cols-[150px_1fr_120px_120px_150px] border-b border-[rgba(255,255,255,0.06)] bg-[#24232b] px-5 py-4">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>

          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="border-b border-[rgba(255,255,255,0.06)] px-5 py-6 last:border-b-0"
            >
              <div className="grid grid-cols-[150px_1fr_120px_120px_150px] items-center gap-4 mb-3">
                <Skeleton className="h-6 w-16" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-6 w-20 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
