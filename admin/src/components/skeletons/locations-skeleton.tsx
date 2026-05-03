import { Skeleton } from '../skeleton';

export function LocationsSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="px-8 py-7">
        <Skeleton className="mb-8 h-8 w-40" />
        <div className="overflow-x-auto">
          <div className="flex min-w-[980px] gap-4">
            {[...Array(3)].map((_, i) => (
              <article key={i} className="panel w-[290px] shrink-0 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-2.5 w-2.5 rounded-full" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                  <Skeleton className="h-7 w-12 rounded-full" />
                </div>

                <Skeleton className="mb-3 h-6 w-40" />

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-[8px] bg-[#26252d] px-4 py-3">
                    <Skeleton className="mb-3 h-3 w-16" />
                    <Skeleton className="h-8 w-12" />
                  </div>
                  <div className="rounded-[8px] bg-[#26252d] px-4 py-3">
                    <Skeleton className="mb-3 h-3 w-12" />
                    <Skeleton className="h-8 w-12" />
                  </div>
                </div>

                <Skeleton className="mt-5 h-16 w-full" />

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Skeleton className="h-12 rounded" />
                  <Skeleton className="h-12 rounded" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
