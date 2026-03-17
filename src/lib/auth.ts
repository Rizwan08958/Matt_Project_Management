import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import authConfig from "@/lib/auth.config";
import type { Role } from "@prisma/client";
import type {
  ActionPermissionOption,
  EmployeePermissions,
  ModuleAccessOption,
  PermissionBucket,
  RecordRuleOption,
} from "@/lib/employee-permissions";
import {
  buildProjectWhereForViewer,
  hasPermission,
  normalizeEmployeePermissions,
} from "@/lib/employee-permissions";

declare module "next-auth" {
  interface User {
    role: Role;
    permissions?: EmployeePermissions | null;
  }

  interface Session {
    user: User & {
      id: string;
      role: Role;
      permissions: EmployeePermissions;
      moduleAccess: EmployeePermissions["moduleAccess"];
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    permissions: EmployeePermissions;
    moduleAccess: EmployeePermissions["moduleAccess"];
  }
}

const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === "development"
    ? "dev-only-auth-secret-change-me"
    : undefined);

if (!authSecret) {
  throw new Error(
    "Missing AUTH_SECRET/NEXTAUTH_SECRET. Set AUTH_SECRET in your environment."
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db) as never,
  session: { strategy: "jwt" },
  secret: authSecret,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const normalizedPermissions = normalizeEmployeePermissions(user.permissions);
        token.id = user.id!;
        token.role = user.role;
        token.permissions = normalizedPermissions;
        token.moduleAccess = normalizedPermissions.moduleAccess;
        return token;
      }

      if (token.id) {
        const currentUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: {
            id: true,
            role: true,
            permissions: true,
            isActive: true,
          },
        });

        if (!currentUser || !currentUser.isActive) {
          return {};
        }

        const normalizedPermissions = normalizeEmployeePermissions(currentUser.permissions);
        token.id = currentUser.id;
        token.role = currentUser.role;
        token.permissions = normalizedPermissions;
        token.moduleAccess = normalizedPermissions.moduleAccess;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.permissions = normalizeEmployeePermissions(token.permissions);
        session.user.moduleAccess = session.user.permissions.moduleAccess;
      }
      return session;
    },
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAuthPage =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register");
      const isOnDashboard =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/employees") ||
        nextUrl.pathname.startsWith("/clients") ||
        nextUrl.pathname.startsWith("/crm") ||
        nextUrl.pathname.startsWith("/projects") ||
        nextUrl.pathname.startsWith("/work-tracking") ||
        nextUrl.pathname.startsWith("/reports") ||
        nextUrl.pathname.startsWith("/activity-logs") ||
        nextUrl.pathname.startsWith("/security");

      if (isOnAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (isOnDashboard) {
        return isLoggedIn;
      }

      return true;
    },
  },
  ...authConfig,
});

export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}

export async function requireManagerOrAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "BA" && user.role !== "TEAMLEADER") {
    throw new Error("Forbidden: Admin, BA, or Team Leader access required");
  }
  return user;
}

export async function requireCrmAccess() {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && !user.moduleAccess.includes("CRM")) {
    throw new Error("Forbidden: CRM access required");
  }
  return user;
}

export async function requirePermission<K extends PermissionBucket>(
  bucket: K,
  value: EmployeePermissions[K][number]
) {
  const user = await requireAuth();
  if (user.role === "ADMIN") {
    return user;
  }

  if (!hasPermission(user.permissions, bucket, value)) {
    throw new Error(`Forbidden: Missing permission ${bucket}:${String(value)}`);
  }

  return user;
}

export async function requireModuleAccess(module: ModuleAccessOption) {
  return requirePermission("moduleAccess", module);
}

export async function requireRecordRule(rule: RecordRuleOption) {
  return requirePermission("recordRules", rule);
}

export function hasActionPermission(
  permissions: EmployeePermissions | null | undefined,
  action: ActionPermissionOption
) {
  return hasPermission(permissions, "actionPermissions", action);
}

export function canAccessAction(input: {
  role?: Role | string | null;
  permissions?: EmployeePermissions | null;
  action: ActionPermissionOption;
  module?: ModuleAccessOption;
}) {
  if (input.role === "ADMIN") {
    return true;
  }

  if (input.module && !hasPermission(input.permissions, "moduleAccess", input.module)) {
    return false;
  }

  return hasActionPermission(input.permissions, input.action);
}

export async function requireActionPermission(
  action: ActionPermissionOption,
  module?: ModuleAccessOption
) {
  const user = await requireAuth();
  if (!canAccessAction({ role: user.role, permissions: user.permissions, action, module })) {
    if (module && !hasPermission(user.permissions, "moduleAccess", module)) {
      throw new Error(`Forbidden: Missing module access ${module}`);
    }
    throw new Error(`Forbidden: Missing permission actionPermissions:${action}`);
  }

  return user;
}

export async function requireProjectRecordAccess(projectId: string) {
  const user = await requireAuth();
  if (user.role === "ADMIN") {
    return user;
  }

  const projectWhere = buildProjectWhereForViewer({
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
  });

  const canAccess = await db.project.count({
    where: {
      id: projectId,
      ...projectWhere,
    },
  });

  if (canAccess === 0) {
    throw new Error("Forbidden: Record rule does not allow access to this project");
  }

  return user;
}
