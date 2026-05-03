import { redirect } from "next/navigation";
import { LoginPanel } from "@/components/login-panel";
import { getMissingAdminEnv, hasAdminDevBypass, hasSupabaseAuthEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const missingEnv = getMissingAdminEnv();

  if (hasAdminDevBypass()) {
    redirect("/dashboard");
  }

  if (hasSupabaseAuthEnv()) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-10">
      <div className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <LoginPanel authEnabled={hasSupabaseAuthEnv()} missingEnv={missingEnv} />

        <section className="panel grid gap-5 p-6 sm:p-8">
          <div>
            <span className="eyebrow">Live Operations</span>
            <h2 className="mt-3 font-serif text-3xl text-[var(--color-foreground)]">Real dashboard, real data.</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[8px] border border-[rgba(245,240,232,0.08)] bg-[rgba(245,240,232,0.03)] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Dashboard</p>
              <p className="mt-2 text-sm leading-7 text-[var(--color-foreground)]">Today’s bookings, weekly volume, connection health, and same-day operating pressure.</p>
            </div>
            <div className="rounded-[8px] border border-[rgba(245,240,232,0.08)] bg-[rgba(245,240,232,0.03)] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Bookings</p>
              <p className="mt-2 text-sm leading-7 text-[var(--color-foreground)]">Filterable upcoming work with status controls for confirmed, completed, cancelled, and no-show.</p>
            </div>
            <div className="rounded-[8px] border border-[rgba(245,240,232,0.08)] bg-[rgba(245,240,232,0.03)] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Schedule</p>
              <p className="mt-2 text-sm leading-7 text-[var(--color-foreground)]">Location hours, same-day cutoffs, and day-specific overrides without touching code.</p>
            </div>
            <div className="rounded-[8px] border border-[rgba(245,240,232,0.08)] bg-[rgba(245,240,232,0.03)] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Settings</p>
              <p className="mt-2 text-sm leading-7 text-[var(--color-foreground)]">Google Calendar connection state, calendar mapping, and transport readiness for email and SMS.</p>
            </div>
          </div>

          <div className="rounded-[8px] border border-[rgba(245,240,232,0.08)] bg-[rgba(245,240,232,0.03)] p-4 text-sm leading-7 text-[var(--color-muted)]">
            {missingEnv.length === 0
              ? "This environment is connected to Supabase Auth, the backend admin API, and live booking data."
              : "Add the missing environment variables shown on the sign-in panel before testing the live dashboard."}
          </div>
        </section>
      </div>
    </main>
  );
}
