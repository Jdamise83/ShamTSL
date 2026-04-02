import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { env, hasSupabaseBrowserConfig } from "@/lib/env";

const publicRoutes = ["/login"];
const staffAllowedRoutes = ["/holidays"];

export async function updateSession(request: NextRequest) {
  if (!hasSupabaseBrowserConfig()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.nextPublicSupabaseUrl as string,
    env.nextPublicSupabaseAnonKey as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`)
  );
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  if (isApiRoute) {
    return supabaseResponse;
  }

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role === "staff" ? "staff" : "admin";

    if (role === "staff") {
      const isAllowedStaffRoute = staffAllowedRoutes.some((route) =>
        request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`)
      );

      if (!isAllowedStaffRoute && request.nextUrl.pathname !== "/login") {
        const url = request.nextUrl.clone();
        url.pathname = "/holidays";
        return NextResponse.redirect(url);
      }
    }

    if (request.nextUrl.pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = role === "staff" ? "/holidays" : "/home";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
