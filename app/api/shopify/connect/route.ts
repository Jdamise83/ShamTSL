import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_SHOP_DOMAIN = "cwu5dz-dz.myshopify.com";

function readEnv(names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function resolveRequestOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();

  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return requestUrl.origin;
}

function normalizeShopDomain(value: string): string {
  const raw = value.trim();
  if (!raw) {
    return "";
  }

  const toDomain = (shop: string) => {
    const cleanShop = shop.trim().toLowerCase();
    if (!cleanShop) {
      return "";
    }

    if (cleanShop.includes(".")) {
      return cleanShop;
    }

    return `${cleanShop}.myshopify.com`;
  };

  try {
    const parsed = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    if (parsed.hostname.toLowerCase() === "admin.shopify.com") {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const storeIndex = segments.findIndex((segment) => segment.toLowerCase() === "store");
      const handle = storeIndex >= 0 ? (segments[storeIndex + 1] ?? "") : "";
      return toDomain(handle);
    }

    return toDomain(parsed.hostname);
  } catch {
    const clean = raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const storeMatch = clean.match(/admin\.shopify\.com\/store\/([^/]+)/i);
    if (storeMatch?.[1]) {
      return toDomain(storeMatch[1]);
    }

    return toDomain(clean.split("/")[0] ?? "");
  }
}

function normalizeReturnTo(value: string, fallbackOrigin: string): string {
  const raw = value.trim();
  if (!raw) {
    return `${fallbackOrigin}/shopify`;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return `${fallbackOrigin}/shopify`;
    }

    return parsed.toString();
  } catch {
    return `${fallbackOrigin}/shopify`;
  }
}

function errorRedirect(requestUrl: URL, message: string) {
  return NextResponse.redirect(
    new URL(`/shopify?shopify_error=${encodeURIComponent(message)}`, requestUrl.origin)
  );
}

function readCookie(request: Request, name: string): string {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const pairs = cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const pair of pairs) {
    const [cookieName, ...rest] = pair.split("=");
    if (cookieName !== name) {
      continue;
    }

    return decodeURIComponent(rest.join("=")).trim();
  }

  return "";
}

async function readShopDomainFromSupabase(): Promise<string> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return "";
  }

  const { data, error } = await supabase
    .from("integration_secrets")
    .select("value")
    .eq("key", "shopify_store_domain")
    .maybeSingle();

  if (error) {
    console.warn("[Shopify] Could not read store domain from Supabase integration_secrets.", {
      error: error.message
    });
    return "";
  }

  return typeof data?.value === "string" ? data.value.trim() : "";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestOrigin = resolveRequestOrigin(request);
  const returnTo = normalizeReturnTo(
    requestUrl.searchParams.get("return_to") ?? `${requestOrigin}/shopify`,
    requestOrigin
  );

  const shopFromQuery = normalizeShopDomain(requestUrl.searchParams.get("shop") ?? "");
  const shopFromCookie = normalizeShopDomain(
    readCookie(request, "shopify_store_domain") || readCookie(request, "shopify_oauth_shop")
  );
  const shopFromSupabase = normalizeShopDomain(await readShopDomainFromSupabase());
  const shopFromEnv = normalizeShopDomain(
    readEnv([
      "SHOPIFY_STORE_DOMAIN",
      "SHOPIFY_SHOP_DOMAIN",
      "SHOPIFY_SHOP",
      "SHOPIFY_DOMAIN",
      "SHOPIFY_MYSHOPIFY_DOMAIN",
      "SHOPIFY_STORE_ID"
    ])
  );
  const shopDomain = shopFromQuery || shopFromEnv || shopFromSupabase || shopFromCookie || DEFAULT_SHOP_DOMAIN;
  const clientId = readEnv([
    "SHOPIFY_APP_CLIENT_ID",
    "SHOPIFY_CLIENT_ID",
    "SHOPIFY_API_KEY",
    "SHOPIFY_KEY",
    "SHOPIFY_PUBLIC_API_KEY"
  ]);

  if (!shopDomain) {
    return errorRedirect(
      requestUrl,
      "Missing Shopify store domain. Add ?shop=your-store.myshopify.com once to connect."
    );
  }

  if (!clientId) {
    return errorRedirect(requestUrl, "Missing Shopify client id");
  }

  const state = crypto.randomBytes(20).toString("hex");
  const scopes =
    readEnv(["SHOPIFY_SCOPES"]) || "read_orders,read_customers,read_analytics";

  const redirectUri = new URL("/api/shopify/callback", requestOrigin).toString();

  const authorizeUrl = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("access_mode", "offline");

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: requestUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60
  });
  response.cookies.set("shopify_oauth_shop", shopDomain, {
    httpOnly: true,
    secure: requestUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60
  });
  response.cookies.set("shopify_oauth_return_to", returnTo, {
    httpOnly: true,
    secure: requestUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60
  });

  return response;
}
