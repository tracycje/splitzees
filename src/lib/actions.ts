"use server";

import { prisma } from "./db";
import { getSession, requireAuth, requireAdmin } from "./session";
import { splitEqual, validateCustomShares } from "./calc";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// ---- Auth ----

export async function login(_prev: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return { error: "Invalid credentials" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid credentials" };
  }

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role;
  await session.save();

  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

// ---- Users (admin only) ----

export async function createUser(formData: FormData) {
  await requireAdmin();

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return { error: "All fields are required" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Email already in use" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash, role: "MEMBER" },
  });

  revalidatePath("/users");
  return { success: true };
}

export async function updateUser(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const active = formData.get("active") === "true";
  const password = formData.get("password") as string;

  if (!id || !name || !email) {
    return { error: "Name and email are required" };
  }

  const data: Record<string, unknown> = { name, email, active };
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  await prisma.user.update({ where: { id }, data });
  revalidatePath("/users");
  return { success: true };
}

// ---- Expenses ----

export async function createExpense(formData: FormData) {
  const session = await requireAuth();

  const title = (formData.get("title") as string)?.trim();
  const amountStr = formData.get("amount") as string;
  const currencyCode = (formData.get("currencyCode") as string) || "GBP";
  const date = (formData.get("date") as string) || new Date().toISOString().split("T")[0];
  const note = (formData.get("note") as string)?.trim() || null;
  const paidByUserId = formData.get("paidByUserId") as string;
  const splitType = (formData.get("splitType") as string) || "EQUAL";
  const participantIds = formData.getAll("participantIds") as string[];

  if (!title || !amountStr || !paidByUserId || participantIds.length === 0) {
    return { error: "Title, amount, payer, and at least one participant are required" };
  }

  const amountCents = Math.round(parseFloat(amountStr) * 100);
  if (isNaN(amountCents) || amountCents <= 0) {
    return { error: "Amount must be a positive number" };
  }

  let shares: { userId: string; shareCents: number }[];

  if (splitType === "EQUAL") {
    const splits = splitEqual(amountCents, participantIds.length);
    shares = participantIds.map((uid, i) => ({ userId: uid, shareCents: splits[i] }));
  } else {
    // CUSTOM
    shares = participantIds.map((uid) => {
      const shareStr = formData.get(`share_${uid}`) as string;
      return { userId: uid, shareCents: Math.round(parseFloat(shareStr || "0") * 100) };
    });

    if (!validateCustomShares(amountCents, shares.map((s) => s.shareCents))) {
      return { error: "Custom shares must sum to the total amount" };
    }
  }

  await prisma.expense.create({
    data: {
      title,
      amountCents,
      currencyCode,
      date: new Date(date),
      note,
      paidByUserId,
      createdByUserId: session.userId!,
      splitType,
      participants: {
        create: shares.map((s) => ({
          userId: s.userId,
          shareCents: s.shareCents,
        })),
      },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  revalidatePath("/balances");
  return { success: true };
}

export async function updateExpense(formData: FormData) {
  const session = await requireAuth();

  const id = formData.get("id") as string;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return { error: "Expense not found" };

  // Only admin or creator can edit
  if (session.role !== "ADMIN" && expense.createdByUserId !== session.userId) {
    return { error: "Not authorized" };
  }

  const title = (formData.get("title") as string)?.trim();
  const amountStr = formData.get("amount") as string;
  const currencyCode = (formData.get("currencyCode") as string) || "GBP";
  const date = (formData.get("date") as string) || new Date().toISOString().split("T")[0];
  const note = (formData.get("note") as string)?.trim() || null;
  const paidByUserId = formData.get("paidByUserId") as string;
  const splitType = (formData.get("splitType") as string) || "EQUAL";
  const participantIds = formData.getAll("participantIds") as string[];

  if (!title || !amountStr || !paidByUserId || participantIds.length === 0) {
    return { error: "Title, amount, payer, and at least one participant are required" };
  }

  const amountCents = Math.round(parseFloat(amountStr) * 100);
  if (isNaN(amountCents) || amountCents <= 0) {
    return { error: "Amount must be a positive number" };
  }

  let shares: { userId: string; shareCents: number }[];

  if (splitType === "EQUAL") {
    const splits = splitEqual(amountCents, participantIds.length);
    shares = participantIds.map((uid, i) => ({ userId: uid, shareCents: splits[i] }));
  } else {
    shares = participantIds.map((uid) => {
      const shareStr = formData.get(`share_${uid}`) as string;
      return { userId: uid, shareCents: Math.round(parseFloat(shareStr || "0") * 100) };
    });

    if (!validateCustomShares(amountCents, shares.map((s) => s.shareCents))) {
      return { error: "Custom shares must sum to the total amount" };
    }
  }

  await prisma.$transaction([
    prisma.expenseParticipant.deleteMany({ where: { expenseId: id } }),
    prisma.expense.update({
      where: { id },
      data: {
        title,
        amountCents,
        currencyCode,
        date: new Date(date),
        note,
        paidByUserId,
        splitType,
        participants: {
          create: shares.map((s) => ({
            userId: s.userId,
            shareCents: s.shareCents,
          })),
        },
      },
    }),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  revalidatePath("/balances");
  return { success: true };
}

export async function deleteExpense(formData: FormData) {
  const session = await requireAuth();
  const id = formData.get("id") as string;

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return { error: "Expense not found" };

  if (session.role !== "ADMIN" && expense.createdByUserId !== session.userId) {
    return { error: "Not authorized" };
  }

  await prisma.expense.delete({ where: { id } });

  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  revalidatePath("/balances");
  return { success: true };
}

// ---- Data fetchers ----

export async function getActiveUsers() {
  return prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function getAllUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getExpenses() {
  return prisma.expense.findMany({
    include: {
      paidBy: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      participants: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { date: "desc" },
  });
}

export async function getExpenseById(id: string) {
  return prisma.expense.findUnique({
    where: { id },
    include: {
      paidBy: { select: { id: true, name: true } },
      participants: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
}
