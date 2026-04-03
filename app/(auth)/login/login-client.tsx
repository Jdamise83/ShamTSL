"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlError = searchParams.get("error");
  const configMissing = urlError === "config_missing";

  const helperMessage = useMemo(() => {
    if (configMissing) {
      return "Supabase environment variables are missing. Add them in your .env.local before signing in.";
    }

    return "Use your admin email and password to access the private dashboard.";
  }, [configMissing]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(authError.message);
      } else {
        router.replace("/home?intro=1");
        router.refresh();
      }
    } catch (unexpectedError) {
      setError(
        unexpectedError instanceof Error ? unexpectedError.message : "Unexpected login error occurred."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl items-center px-6 py-12 lg:px-10">
      <div className="grid w-full gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-border/70 bg-card p-10 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">The Snus Life</p>
          <h1 className="mt-4 font-heading text-4xl font-bold uppercase tracking-[0.08em] text-foreground lg:text-5xl">
            Operations Dashboard
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Monitor channel performance, schedule key meetings, and manage team holidays inside a single private,
            premium workspace.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ["Calendar", "Meeting orchestration"],
              ["Performance", "Ads, SEO, GA4 and revenue"],
              ["Holiday Control", "Approvals and audit history"]
            ].map(([title, subtitle]) => (
              <div key={title} className="rounded-2xl bg-muted/60 p-4">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
              </div>
            ))}
          </div>
        </div>

        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="font-heading text-2xl uppercase tracking-[0.08em]">Sign In</CardTitle>
            <p className="text-sm text-muted-foreground">{helperMessage}</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@thesnuslife.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error || urlError ? (
                <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error || decodeURIComponent(urlError as string)}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={submitting || configMissing}>
                {submitting ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
