import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  getDefaultDashboardPath,
  isAllowedDashboardPath,
  resolveDashboardAccessLevel
} from "@/lib/access-control";
import { env, hasSupabaseBrowserConfig } from "@/lib/env";

const publicRoutes = ["/login", "/app:auth:callback"];

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
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
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

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (!user) {
    return supabaseResponse;
  }

  const accessLevel = resolveDashboardAccessLevel(user.email);

  if (isApiRoute) {
    if (!isAllowedDashboardPath(request.nextUrl.pathname, accessLevel)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return supabaseResponse;
  }

  if (!isAllowedDashboardPath(request.nextUrl.pathname, accessLevel)) {
    const url = request.nextUrl.clone();
    url.pathname = getDefaultDashboardPath(accessLevel);
    return NextResponse.redirect(url);
  }

  if (request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = getDefaultDashboardPath(accessLevel);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
