import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/sidebar-nav";
import { getAdminSession } from "@/lib/admin-auth";

async function getCurrentAdmin() {
  const session = await getAdminSession();
  if (!session) return null;

  return {
    email: session.email,
    isSuperAdmin: session.isSuperAdmin,
  };
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  return (
    <div className="flex min-h-screen bg-[#0b0b0e]">
      <SidebarNav isSuperAdmin={admin.isSuperAdmin} />
      <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(56,56,70,0.18),transparent_32%),radial-gradient(circle_at_bottom,rgba(24,24,31,0.6),transparent_40%),#0c0c10]">
        <main className="flex-1 pb-24 lg:pb-0">
          <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col gap-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
