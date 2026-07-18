export type Page = "dashboard" | "case" | "report" | "assurance" | "radar" | "status";

export type AppRoute = {
  page: Page;
  caseId?: string;
  token?: string;
};

export function parseRoute(pathname: string): AppRoute {
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  if (normalized === "/") return { page: "dashboard" };
  if (normalized === "/assurance") return { page: "assurance" };
  if (normalized === "/radar") return { page: "radar" };
  if (normalized === "/report") return { page: "report" };

  const statusMatch = normalized.match(/^\/status\/([^/]+)$/);
  if (statusMatch) {
    try { return { page: "status", token: decodeURIComponent(statusMatch[1]) }; }
    catch { return { page: "dashboard" }; }
  }

  const caseMatch = normalized.match(/^\/cases\/([^/]+)$/);
  if (caseMatch) {
    try {
      return { page: "case", caseId: decodeURIComponent(caseMatch[1]) };
    } catch {
      return { page: "dashboard" };
    }
  }

  return { page: "dashboard" };
}

export function routePath(route: AppRoute): string {
  if (route.page === "assurance") return "/assurance";
  if (route.page === "radar") return "/radar";
  if (route.page === "report") return "/report";
  if (route.page === "status" && route.token) return `/status/${encodeURIComponent(route.token)}`;
  if (route.page === "case" && route.caseId) return `/cases/${encodeURIComponent(route.caseId)}`;
  return "/";
}
