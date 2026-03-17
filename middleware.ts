import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;
  const moduleAccess = req.auth?.user?.moduleAccess ?? [];
  const permissionPayload =
    req.auth?.user &&
    "permissions" in req.auth.user &&
    typeof req.auth.user.permissions === "object" &&
    req.auth.user.permissions !== null
      ? (req.auth.user.permissions as { actionPermissions?: string[] })
      : null;
  const actionPermissions = permissionPayload?.actionPermissions ?? [];
  const canCreateByPermission = actionPermissions.includes("CREATE");
  const canUpdateByPermission =
    actionPermissions.includes("UPDATE") || actionPermissions.includes("EDIT");

  const isAuthPage =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/register");

  const isProtectedRoute =
    nextUrl.pathname.startsWith("/dashboard") ||
    nextUrl.pathname.startsWith("/employees") ||
    nextUrl.pathname.startsWith("/clients") ||
    nextUrl.pathname.startsWith("/crm") ||
    nextUrl.pathname.startsWith("/projects") ||
    nextUrl.pathname.startsWith("/work-tracking") ||
    nextUrl.pathname.startsWith("/reports") ||
    nextUrl.pathname.startsWith("/activity-logs") ||
    nextUrl.pathname.startsWith("/security");

  // Admin-only routes
  const isAdminRoute =
    nextUrl.pathname === "/employees/new" ||
    nextUrl.pathname.match(/^\/employees\/[^/]+\/edit$/) ||
    nextUrl.pathname.startsWith("/security");

  const isProjectCreateRoute = nextUrl.pathname === "/projects/new";
  const isProjectEditRoute = Boolean(nextUrl.pathname.match(/^\/projects\/[^/]+\/edit$/));
  const isClientRoute = nextUrl.pathname.startsWith("/clients");
  const isClientCreateRoute = nextUrl.pathname === "/clients/new";
  const isClientEditRoute = Boolean(nextUrl.pathname.match(/^\/clients\/[^/]+\/edit$/));
  const isCrmRoute = nextUrl.pathname.startsWith("/crm");
  const isProjectRoute = nextUrl.pathname.startsWith("/projects");

  // Redirect authenticated users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Redirect unauthenticated users to login
  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Check admin-only routes
  if (isAdminRoute && userRole !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Require person-level permission for project creation
  if (isProjectCreateRoute && userRole !== "ADMIN" && !canCreateByPermission) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Require person-level permission for project edit actions
  if (isProjectEditRoute && userRole !== "ADMIN" && !canUpdateByPermission) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  if (userRole !== "ADMIN") {
    const hasClientModuleAccess =
      moduleAccess.includes("CRM") || moduleAccess.includes("SALES");

    if (isClientRoute && !hasClientModuleAccess) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }

    if (isClientCreateRoute && !canCreateByPermission) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }

    if (isClientEditRoute && !canUpdateByPermission) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }

    if (isCrmRoute && !moduleAccess.includes("CRM")) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }

    if (isProjectRoute && !moduleAccess.includes("PROJECT")) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
