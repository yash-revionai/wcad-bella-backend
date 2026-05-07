import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getDashboardData } from "@/lib/admin-data";
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton";

type PageProps = {
  params: Promise<{ accountId: string }>;
};

async function UserDashboardContent({ accountId }: { accountId: string }) {
  // TODO: Fetch data for the specific account - currently uses authorized account
  // For super-admin viewing, pass accountId override to data functions
  const data = await getDashboardData();

  return (
    <div className="min-h-screen">
      <div className="flex items-center gap-2 px-8 py-4 border-b border-[rgba(255,255,255,0.06)]">
        <Link href="/dashboard/users" className="flex items-center gap-2 text-[#b8ad96] hover:text-[#f5f0e8]">
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Link>
      </div>
      <div className="px-8 py-7">
        <PageHeader title={data.mode === 'live' ? 'Account Dashboard' : 'Dashboard'} />

        <div className="grid gap-6">
          {/* Today's stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="panel p-4">
              <p className="text-[#857c6e] text-[13px]">Today's Bookings</p>
              <p className="font-semibold text-[20px] text-[#f5f0e8]">{data.bookingsTodayCount}</p>
            </div>
            <div className="panel p-4">
              <p className="text-[#857c6e] text-[13px]">This Week Revenue</p>
              <p className="font-semibold text-[20px] text-[#f5f0e8]">${(data.revenueThisWeekCents / 100).toFixed(0)}</p>
            </div>
            <div className="panel p-4">
              <p className="text-[#857c6e] text-[13px]">Calendar Ready</p>
              <p className="font-semibold text-[20px] text-[#d3b149]">{data.calendarReady ? '✓' : '✗'}</p>
            </div>
            <div className="panel p-4">
              <p className="text-[#857c6e] text-[13px]">Google Connected</p>
              <p className="font-semibold text-[20px] text-[#d3b149]">{data.googleConnected ? '✓' : '✗'}</p>
            </div>
          </div>

          {/* Bookings preview */}
          <div className="panel">
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
              <h2 className="font-semibold text-[#f5f0e8]">Today's Bookings</h2>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {data.todayBookings.length > 0 ? (
                <div className="grid gap-2 p-4">
                  {data.todayBookings.map((booking) => (
                    <div key={booking.id} className="text-sm p-2 rounded bg-[rgba(255,255,255,0.03)]">
                      <p className="font-medium text-[#f5f0e8]">{booking.customer_name}</p>
                      <p className="text-[#b6ab97] text-[12px]">{booking.services?.name} • {booking.vehicle_type}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-4 text-[#b6ab97]">No bookings today</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function UserDashboardPage({ params }: PageProps) {
  const { accountId } = await params;

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <UserDashboardContent accountId={accountId} />
    </Suspense>
  );
}
