"use client";

import { createBrowserClient } from "@supabase/ssr";

import { env, hasSupabaseBrowserConfig } from "@/lib/env";

export function createSupabaseBrowserClient() {
  if (!hasSupabaseBrowserConfig()) {
    throw new Error("Supabase browser configuration is missing.");
  }

  return createBrowserClient(
    env.nextPublicSupabaseUrl as string,
    env.nextPublicSupabaseAnonKey as string
  );
}
