import { Skeleton } from '../skeleton';

export function UsersSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="px-8 py-7">
        <Skeleton className="mb-8 h-8 w-40" />
        <Skeleton className="h-4 w-48 mb-5" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="panel p-5 grid gap-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="rounded bg-[rgba(255,255,255,0.04)] p-2">
                    <Skeleton className="h-3 w-12 mb-1" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-10 w-full rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
