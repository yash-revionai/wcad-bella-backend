"use client";

import { LoaderCircle, LogIn } from "lucide-react";
import { useState, useTransition } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";

type LoginPanelProps = {
  authEnabled: boolean;
  missingEnv: string[];
};

export function LoginPanel({ authEnabled, missingEnv }: LoginPanelProps) {
  const [email, setEmail] = useState("worldclassautodetail@gmail.com");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        const supabase = createClientSupabaseClient();
        const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: redirectTo,
          },
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        setMessage("Magic link sent. Open it on this device and the dashboard will unlock.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to request a sign-in link.");
      }
    });
  };

  return (
    <section className="panel grid gap-6 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Bella Admin</span>
        <span className="rounded-full border border-[rgba(245,240,232,0.12)] bg-[rgba(245,240,232,0.04)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Live
        </span>
      </div>

      <div className="grid gap-3">
        <h1 className="font-serif text-4xl leading-none text-[var(--color-foreground)] sm:text-5xl">
          World Class stays calm when the phones stay busy.
        </h1>
        <p className="max-w-xl text-sm leading-7 text-[var(--color-muted)] sm:text-base">
          A mobile-first operations surface for bookings, schedule changes, and calendar control. Built to feel like a premium service business, not a generic dashboard.
        </p>
      </div>

      {authEnabled ? (
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-[var(--color-foreground)]">Admin email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="field"
              placeholder="worldclassautodetail@gmail.com"
            />
          </label>

          <button type="button" className="action-button" onClick={handleSubmit} disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            <span>{pending ? "Sending link" : "Send magic link"}</span>
          </button>

          <p className="text-xs leading-6 text-[var(--color-muted)]">
            Supabase Auth is enabled. The dashboard will only fully unlock after the email link is confirmed and the account matches an `admin_users` record.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-[8px] border border-[rgba(201,168,76,0.24)] bg-[rgba(201,168,76,0.08)] p-4 text-sm leading-7 text-[var(--color-foreground)]">
            Live admin auth is not configured yet. Add the missing values below, restart the admin server, then sign in.
          </div>
          <div className="rounded-[8px] border border-[rgba(245,240,232,0.08)] bg-[rgba(245,240,232,0.03)] p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">Missing env</p>
            <ul className="mt-3 grid gap-2 text-sm text-[var(--color-foreground)]">
              {missingEnv.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {message ? <p className="text-sm leading-7 text-[var(--color-muted)]">{message}</p> : null}
    </section>
  );
}
