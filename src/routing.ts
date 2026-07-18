export type Page = "dashboard" | "case" | "report" | "assurance";

export type AppRoute = {
  page: Page;
  caseId?: string;
};

export function parseRoute(pathname: string): AppRoute {
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  if (normalized === "/") return { page: "dashboard" };
  if (normalized === "/assurance") return { page: "assurance" };
  if (normalized === "/report") return { page: "report" };

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
  if (route.page === "report") return "/report";
  if (route.page === "case" && route.caseId) return `/cases/${encodeURIComponent(route.caseId)}`;
  return "/";
}
