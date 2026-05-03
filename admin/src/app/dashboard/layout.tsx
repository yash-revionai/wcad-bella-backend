import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/sidebar-nav";
import { StatusBanner } from "@/components/status-banner";
import { getDevBypassAdmin } from "@/lib/admin-auth";
import { createServiceSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { hasSupabaseAuthEnv, hasSupabaseServiceEnv } from "@/lib/env";

async function getCurrentAdmin() {
  const devAdmin = await getDevBypassAdmin();
  if (devAdmin) {
    return { email: devAdmin.email, role: devAdmin.role };
  }

  if (!hasSupabaseAuthEnv() || !hasSupabaseServiceEnv()) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const serviceSupabase = createServiceSupabaseClient();
  const { data: adminUser } = await serviceSupabase
    .from("admin_users")
    .select("email,role")
    .eq("email", user.email)
    .single();

  if (!adminUser) {
    return { email: user.email, role: "unauthorized" };
  }

  return adminUser;
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-[#0b0b0e]">
      <SidebarNav />
      <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(56,56,70,0.18),transparent_32%),radial-gradient(circle_at_bottom,rgba(24,24,31,0.6),transparent_40%),#0c0c10]">
        <main className="flex-1 pb-24 lg:pb-0">
          <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col gap-5">
            {admin.role === "unauthorized" ? (
              <StatusBanner kind="warning" message="This Supabase account is authenticated but does not exist in admin_users yet." />
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
