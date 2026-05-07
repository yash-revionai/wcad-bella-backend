import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { getSystemUsersData } from "@/lib/admin-data";
import { UsersSkeleton } from "@/components/skeletons/users-skeleton";
import { UserCard } from "./user-card";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function UsersContent() {
  const data = await getSystemUsersData();

  if (data.error || !data.accounts) {
    return (
      <div className="px-8 py-7">
        <PageHeader title="Users" />
        <div className="panel bg-[rgba(255,100,100,0.1)] p-4 text-[#ff6464]">
          Error loading users: {data.error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="px-8 py-7">
        <PageHeader title="System Users" />
        <div className="mb-5">
          <p className="font-mono text-[14px] uppercase tracking-[0.22em] text-[#8f8577]">All accounts & clients</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.accounts.map((account) => (
            <UserCard key={account.id} account={account} />
          ))}
        </div>

        {data.accounts.length === 0 && (
          <div className="panel text-center py-8 text-[#b6ab97]">
            No accounts found
          </div>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<UsersSkeleton />}>
      <UsersContent />
    </Suspense>
  );
}
