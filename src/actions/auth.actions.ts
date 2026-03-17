"use server";

import { auth, signIn, signOut } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import { loginSchema, registerSchema } from "@/lib/validations/auth.schema";
import { CredentialSystemError, getUserFromCredentials } from "@/lib/auth.config";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";

const loginServiceErrorMessage =
  "Login service is temporarily unavailable. Please check database connectivity and try again.";

export async function login(formData: FormData) {
  const validatedFields = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { error: "Invalid fields" };
  }

  const email = validatedFields.data.email.trim().toLowerCase();
  const { password } = validatedFields.data;

  const authenticatedUser = await getUserFromCredentials({ email, password }).catch((error) => {
    if (error instanceof CredentialSystemError) {
      return { systemError: true } as const;
    }
    throw error;
  });

  if (authenticatedUser && "systemError" in authenticatedUser) {
    return { error: loginServiceErrorMessage };
  }

  if (!authenticatedUser) {
    return { error: "Invalid credentials" };
  }

  try {
    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (signInResult && typeof signInResult === "object" && "error" in signInResult && signInResult.error) {
      return { error: "Invalid credentials" };
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (user) {
      await db.activityLog.create({
        data: {
          action: "LOGIN",
          entityType: "auth",
          entityId: user.id,
          userId: user.id,
          createdById: user.id,
          metadata: { method: "credentials" },
        },
      });
    }

    return { success: true };
  } catch (error) {
    if (error instanceof CredentialSystemError) {
      return { error: loginServiceErrorMessage };
    }

    const authType =
      error instanceof AuthError
        ? error.type
        : typeof error === "object" &&
            error !== null &&
            "type" in error &&
            typeof (error as { type?: unknown }).type === "string"
          ? (error as { type: string }).type
          : undefined;

    if (authType === "CredentialsSignin") {
      return { error: "Invalid credentials" };
    }

    if (error instanceof AuthError) {
      return { error: "Something went wrong" };
    }

    throw error;
  }
}

export async function register(formData: FormData) {
  const validatedFields = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  if (!isDatabaseConfigured) {
    return { error: loginServiceErrorMessage };
  }

  const name = validatedFields.data.name.trim();
  const email = validatedFields.data.email.trim().toLowerCase();
  const { password } = validatedFields.data;

  try {
    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return { error: "Email is already registered" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "EMPLOYEE",
        isActive: true,
      },
      select: { id: true },
    });

    return { success: true };
  } catch (error) {
    console.error("Registration failed:", error);
    return { error: loginServiceErrorMessage };
  }
}

export async function logout() {
  const session = await auth();

  if (session?.user?.id) {
    try {
      const existingUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: { id: true },
      });

      if (existingUser) {
        await db.activityLog.create({
          data: {
            action: "LOGOUT",
            entityType: "auth",
            entityId: existingUser.id,
            userId: existingUser.id,
            createdById: existingUser.id,
          },
        });
      }
    } catch (error) {
      // Logging must not block sign out.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003")) {
        throw error;
      }
    }
  }

  await signOut({ redirectTo: "/login" });
  revalidatePath("/");
}
