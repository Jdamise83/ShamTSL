import crypto from "node:crypto";

import { NextResponse } from "next/server";

function readEnv(names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
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

function resolveCanonicalOrigin(requestUrl: URL): string {
  const configured = readEnv(["SHOPIFY_OAUTH_BASE_URL", "APP_BASE_URL"]);
  if (!configured) {
    return requestUrl.origin;
  }

  try {
    return new URL(configured).origin;
  } catch {
    return requestUrl.origin;
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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const canonicalOrigin = resolveCanonicalOrigin(requestUrl);
  const returnTo = normalizeReturnTo(
    requestUrl.searchParams.get("return_to") ?? `${requestUrl.origin}/shopify`,
    requestUrl.origin
  );

  if (requestUrl.origin !== canonicalOrigin) {
    const relayUrl = new URL("/api/shopify/connect", canonicalOrigin);
    relayUrl.searchParams.set("return_to", returnTo);
    return NextResponse.redirect(relayUrl.toString());
  }

  const shopDomainRaw = readEnv([
    "SHOPIFY_STORE_DOMAIN",
    "SHOPIFY_SHOP_DOMAIN",
    "SHOPIFY_SHOP",
    "SHOPIFY_DOMAIN",
    "SHOPIFY_MYSHOPIFY_DOMAIN",
    "SHOPIFY_STORE_ID"
  ]);
  const shopDomain = normalizeShopDomain(shopDomainRaw);
  const clientId = readEnv([
    "SHOPIFY_APP_CLIENT_ID",
    "SHOPIFY_CLIENT_ID",
    "SHOPIFY_API_KEY",
    "SHOPIFY_KEY",
    "SHOPIFY_PUBLIC_API_KEY"
  ]);

  if (!shopDomain) {
    return errorRedirect(requestUrl, "Missing Shopify store domain");
  }

  if (!clientId) {
    return errorRedirect(requestUrl, "Missing Shopify client id");
  }

  const state = crypto.randomBytes(20).toString("hex");
  const scopes =
    readEnv(["SHOPIFY_SCOPES"]) || "read_orders,read_customers,read_analytics";

  const redirectUri = new URL("/api/shopify/callback", canonicalOrigin).toString();

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
