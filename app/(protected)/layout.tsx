import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TopBar } from "@/components/layout/top-bar";
import { hasSupabaseBrowserConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function signOutAction(_formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  redirect("/login");
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

  return (
    <div className="min-h-screen lg:flex">
      <SidebarNav />
      <div className="flex-1">
        <MobileNav />
        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8 lg:px-10">
          <TopBar userEmail={user.email ?? "admin"} onSignOut={signOutAction} />
          {children}
        </main>
      </div>
    </div>
  );
}
