import { createClient } from "@supabase/supabase-js";

import { env, hasSupabaseServiceConfig } from "@/lib/env";

export function createSupabaseAdminClient() {
  if (!hasSupabaseServiceConfig()) {
    return null;
  }

  return createClient(env.nextPublicSupabaseUrl as string, env.supabaseServiceRoleKey as string, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
