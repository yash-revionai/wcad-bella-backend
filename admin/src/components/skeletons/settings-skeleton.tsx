import { Skeleton } from '../skeleton';

export function SettingsSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="px-8 py-7">
        <Skeleton className="mb-8 h-8 w-32" />

        <div className="grid max-w-[860px] gap-4">
          <section className="panel p-6">
            <Skeleton className="mb-2 h-7 w-48" />
            <Skeleton className="mb-5 h-4 w-96" />

            <div className="mt-5 rounded-[8px] border border-[rgba(70,123,92,0.42)] bg-[rgba(27,48,39,0.55)] px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1">
                    <Skeleton className="mb-2 h-5 w-56" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-24 rounded" />
                  <Skeleton className="h-10 w-28 rounded" />
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="rounded-[8px] h-16" />
              ))}
            </div>

            <div className="mt-6 border-t border-[rgba(245,240,232,0.08)] pt-6">
              <Skeleton className="mb-2 h-3 w-20" />
              <Skeleton className="mb-4 h-4 w-80" />
              <div className="mt-4 grid gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i}>
                    <Skeleton className="mb-2 h-3 w-40" />
                    <Skeleton className="h-10 rounded" />
                  </div>
                ))}
              </div>
              <Skeleton className="mt-5 h-10 w-32 rounded" />
            </div>
          </section>

          <section className="panel p-6">
            <Skeleton className="mb-2 h-7 w-56" />
            <Skeleton className="mb-5 h-4 w-96" />
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="rounded-[8px] h-24" />
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <div>
              <Skeleton className="mb-2 h-7 w-48" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="mt-5 grid gap-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="rounded-[8px] bg-[#26252d] px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Skeleton className="mb-2 h-5 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-4 w-16" />
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
