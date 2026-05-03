import { Skeleton } from '../skeleton';

export function ScheduleSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="px-8 py-7">
        <Skeleton className="mb-8 h-8 w-40" />

        <div className="max-w-4xl space-y-6">
          {[...Array(3)].map((_, i) => (
            <section key={i} className="panel p-6">
              <Skeleton className="mb-4 h-6 w-48" />
              <Skeleton className="mb-6 h-4 w-96" />

              <div className="space-y-4">
                <div className="border-b border-[rgba(255,255,255,0.06)] pb-4">
                  <Skeleton className="mb-3 h-4 w-32" />
                  <div className="grid grid-cols-3 gap-3">
                    <Skeleton className="h-10 rounded" />
                    <Skeleton className="h-10 rounded" />
                    <Skeleton className="h-10 rounded" />
                  </div>
                </div>

                <div className="border-b border-[rgba(255,255,255,0.06)] pb-4">
                  <Skeleton className="mb-3 h-4 w-32" />
                  <div className="grid grid-cols-3 gap-3">
                    <Skeleton className="h-10 rounded" />
                    <Skeleton className="h-10 rounded" />
                    <Skeleton className="h-10 rounded" />
                  </div>
                </div>

                <div>
                  <Skeleton className="mb-3 h-4 w-32" />
                  <div className="grid grid-cols-3 gap-3">
                    <Skeleton className="h-10 rounded" />
                    <Skeleton className="h-10 rounded" />
                    <Skeleton className="h-10 rounded" />
                  </div>
                </div>
              </div>

              <Skeleton className="mt-6 h-10 w-40 rounded" />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
