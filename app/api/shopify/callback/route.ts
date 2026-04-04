import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function verifyShopifyHmac(url: URL, clientSecret: string): boolean {
  const provided = url.searchParams.get("hmac") ?? "";
  if (!provided) {
    return false;
  }

  const entries = [...url.searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b));

  const message = entries.map(([key, value]) => `${key}=${value}`).join("&");
  const digest = crypto.createHmac("sha256", clientSecret).update(message).digest("hex");

  return safeEqualHex(digest, provided);
}

function errorRedirect(requestUrl: URL, message: string) {
  return NextResponse.redirect(
    new URL(`/shopify?shopify_error=${encodeURIComponent(message)}`, requestUrl.origin)
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code")?.trim() ?? "";
  const state = requestUrl.searchParams.get("state")?.trim() ?? "";
  const shopFromQuery = requestUrl.searchParams.get("shop")?.trim() ?? "";

  if (!code) {
    return errorRedirect(requestUrl, "Missing Shopify auth code");
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = new Map(
    cookieHeader
      .split(";")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const [name, ...rest] = chunk.split("=");
        return [name, decodeURIComponent(rest.join("="))];
      })
  );

  const stateCookie = (cookies.get("shopify_oauth_state") ?? "").trim();
  if (!stateCookie || !state || stateCookie !== state) {
    return errorRedirect(requestUrl, "Invalid Shopify OAuth state");
  }

  const shopDomain = normalizeShopDomain(shopFromQuery || (cookies.get("shopify_oauth_shop") ?? ""));
  if (!shopDomain) {
    return errorRedirect(requestUrl, "Missing Shopify shop domain");
  }

  const clientId = readEnv([
    "SHOPIFY_APP_CLIENT_ID",
    "SHOPIFY_CLIENT_ID",
    "SHOPIFY_API_KEY",
    "SHOPIFY_KEY",
    "SHOPIFY_PUBLIC_API_KEY"
  ]);
  const clientSecret = readEnv([
    "SHOPIFY_APP_CLIENT_SECRET",
    "SHOPIFY_CLIENT_SECRET",
    "SHOPIFY_API_SECRET",
    "SHOPIFY_SECRET_KEY",
    "SHOPIFY_SECRET",
    "SHOPIFY_API_PASSWORD"
  ]);

  if (!clientId || !clientSecret) {
    return errorRedirect(requestUrl, "Missing Shopify OAuth credentials");
  }

  if (!verifyShopifyHmac(requestUrl, clientSecret)) {
    return errorRedirect(requestUrl, "Invalid Shopify HMAC");
  }

  const exchangeUrl = `https://${shopDomain}/admin/oauth/access_token`;
  const tokenResponse = await fetch(exchangeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code
    }),
    cache: "no-store"
  });

  const tokenText = await tokenResponse.text();
  if (!tokenResponse.ok) {
    return errorRedirect(
      requestUrl,
      `Shopify token exchange failed (${tokenResponse.status})`
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(tokenText) as unknown;
  } catch {
    return errorRedirect(requestUrl, "Shopify token response was not JSON");
  }

  const accessToken =
    typeof (payload as { access_token?: unknown })?.access_token === "string"
      ? (payload as { access_token: string }).access_token.trim()
      : "";

  if (!accessToken) {
    return errorRedirect(requestUrl, "Shopify token was missing");
  }

  const supabase = createSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.from("integration_secrets").upsert(
      [
        {
          key: "shopify_admin_access_token",
          value: accessToken,
          meta: {
            shopDomain,
            source: "shopify_oauth"
          }
        },
        {
          key: "shopify_store_domain",
          value: shopDomain,
          meta: {
            source: "shopify_oauth"
          }
        }
      ],
      {
        onConflict: "key"
      }
    );

    if (error) {
      console.warn("[Shopify] Failed to persist token in Supabase integration_secrets.", {
        error: error.message
      });
    }
  }

  const response = NextResponse.redirect(
    new URL("/shopify?shopify_connected=1", requestUrl.origin)
  );

  response.cookies.set("shopify_admin_access_token", accessToken, {
    httpOnly: true,
    secure: requestUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  response.cookies.set("shopify_store_domain", shopDomain, {
    httpOnly: true,
    secure: requestUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  response.cookies.set("shopify_oauth_state", "", { path: "/", maxAge: 0 });
  response.cookies.set("shopify_oauth_shop", "", { path: "/", maxAge: 0 });

  return response;
}
