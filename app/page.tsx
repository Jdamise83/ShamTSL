import { redirect } from "next/navigation";

import { hasSupabaseBrowserConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function IndexPage() {
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

  redirect("/home");
}
