import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TopBar } from "@/components/layout/top-bar";
import { hasSupabaseBrowserConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function signOutAction() {
  "use server";

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  redirect("/login");
}

function resolveSignedInName(email: string) {
  const localPart = (email.split("@")[0] ?? "").trim();
  const firstToken = localPart.split(/[._-]/).filter(Boolean)[0] ?? localPart;

  if (!firstToken) {
    return "User";
  }

  if (firstToken.toLowerCase() === "info") {
    return "info";
  }

  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
}

export default async function ProtectedLayout({
  children
}: {
  children: ReactNode;
}) {
  if (!hasSupabaseBrowserConfig()) {
    redirect("/login?error=config_missing");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  const role = profile?.role === "staff" ? "staff" : "admin";
  const signedInName = resolveSignedInName(user.email ?? "");

  return (
    <div className="min-h-screen lg:flex">
      <SidebarNav role={role} />
      <div className="flex-1">
        <MobileNav role={role} />
        <main className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-8 lg:px-10">
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-3xl">
            <div className="tsl-page-watermark" />
          </div>
          <div className="relative z-10">
            <TopBar signedInName={signedInName} onSignOut={signOutAction} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
