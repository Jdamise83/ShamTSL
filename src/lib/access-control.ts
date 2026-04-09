export type DashboardAccessLevel = "full" | "staff" | "staff-unleashed";
export type DashboardRole = "admin" | "staff";

const fullAccessLocalParts = new Set(["shampt19", "dylan", "john"]);
const unleashedAccessLocalParts = new Set(["reece"]);

const staffAllowedPages = new Set(["/calendar", "/holidays"]);
const staffUnleashedAllowedPages = new Set(["/calendar", "/holidays", "/unleashed"]);
const allowedApiPrefixes = ["/api/calendar/events", "/api/holidays"];

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function getEmailLocalPart(email: string | null | undefined) {
  return normalizeEmail(email).split("@")[0] ?? "";
}

export function resolveDashboardAccessLevel(email: string | null | undefined): DashboardAccessLevel {
  const localPart = getEmailLocalPart(email);

  if (fullAccessLocalParts.has(localPart)) {
    return "full";
  }

  if (unleashedAccessLocalParts.has(localPart)) {
    return "staff-unleashed";
  }

  return "staff";
}

export function resolveDashboardRole(email: string | null | undefined): DashboardRole {
  return resolveDashboardAccessLevel(email) === "full" ? "admin" : "staff";
}

export function getDefaultDashboardPath(accessLevel: DashboardAccessLevel) {
  return accessLevel === "full" ? "/home" : "/calendar";
}

function matchesApiPrefix(pathname: string) {
  return allowedApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAllowedDashboardPath(pathname: string, accessLevel: DashboardAccessLevel) {
  const normalizedPath = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  if (accessLevel === "full") {
    return true;
  }

  if (normalizedPath === "/") {
    return false;
  }

  if (normalizedPath.startsWith("/api/")) {
    return matchesApiPrefix(normalizedPath);
  }

  if (accessLevel === "staff-unleashed") {
    return staffUnleashedAllowedPages.has(normalizedPath);
  }

  return staffAllowedPages.has(normalizedPath);
}
