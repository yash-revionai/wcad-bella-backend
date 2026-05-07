"use client";

import { LoaderCircle, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginPanelProps = {
  missingEnv: string[];
};

export function LoginPanel({ missingEnv }: LoginPanelProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      const data = await response.json();
      router.push(data.redirectTo || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
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

      {missingEnv.length > 0 ? (
        <div className="grid gap-4">
          <div className="rounded-[8px] border border-[rgba(201,168,76,0.24)] bg-[rgba(201,168,76,0.08)] p-4 text-sm leading-7 text-[var(--color-foreground)]">
            Admin auth is not fully configured. Add the missing values, restart the server, then try again.
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
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-[var(--color-foreground)]">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              placeholder="admin@example.com"
              required
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-[var(--color-foreground)]">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              placeholder="••••••••"
              required
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" className="action-button" disabled={loading}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            <span>{loading ? "Signing in..." : "Sign in"}</span>
          </button>
        </form>
      )}
    </section>
  );
}
