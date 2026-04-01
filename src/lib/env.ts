export const env = {
  nextPublicSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  nextPublicSupabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  appBaseUrl: process.env.APP_BASE_URL
};

export function hasSupabaseBrowserConfig() {
  return Boolean(env.nextPublicSupabaseUrl && env.nextPublicSupabaseAnonKey);
}

export function hasSupabaseServiceConfig() {
  return Boolean(env.nextPublicSupabaseUrl && env.supabaseServiceRoleKey);
}
