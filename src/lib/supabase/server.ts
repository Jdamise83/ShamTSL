import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env, hasSupabaseBrowserConfig } from "@/lib/env";

export async function createSupabaseServerClient() {
  if (!hasSupabaseBrowserConfig()) {
    throw new Error("Supabase browser configuration is missing.");
  }

  const cookieStore = await cookies();

  return createServerClient(
    env.nextPublicSupabaseUrl as string,
    env.nextPublicSupabaseAnonKey as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // In Server Components this can be called in a read-only context.
            // Middleware refreshes auth cookies separately.
          }
        }
      }
    }
  );
}
