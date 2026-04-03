import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { LoginIntro } from "@/components/layout/login-intro";
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

function toTitleCase(text: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getFirstName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[0] : "";
}

function deriveNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const normalizedLocal = localPart.toLowerCase();

  if (normalizedLocal === "info") {
    return "Dylan";
  }

  return toTitleCase(
    localPart
      .replace(/[._-]+/g, " ")
      .replace(/\d+/g, " ")
      .trim()
  );
}

function resolveWelcomeName({
  email,
  profileFullName,
  metadataFullName
}: {
  email: string;
  profileFullName: string | null;
  metadataFullName: string | null;
}) {
  const emailName = deriveNameFromEmail(email);
  if (emailName) {
    return emailName;
  }

  const profileName = profileFullName ? getFirstName(profileFullName) : "";
  if (profileName) {
    return toTitleCase(profileName);
  }

  const metadataName = metadataFullName ? getFirstName(metadataFullName) : "";
  if (metadataName) {
    return toTitleCase(metadataName);
  }

  return "there";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,full_name")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role === "staff" ? "staff" : "admin";
  const metadataFullName =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  const welcomeName = resolveWelcomeName({
    email: user.email ?? "",
    profileFullName: profile?.full_name ?? null,
    metadataFullName
  });

  return (
    <div className="min-h-screen lg:flex">
      <LoginIntro welcomeName={welcomeName} />
      <SidebarNav role={role} />
      <div className="flex-1">
        <MobileNav />
        <main className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-8 lg:px-10">
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-3xl">
            <div className="tsl-page-watermark" />
          </div>
          <div className="relative z-10">
            <TopBar userEmail={user.email ?? "admin"} onSignOut={signOutAction} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
