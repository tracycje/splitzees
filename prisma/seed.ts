import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const memberPassword = process.env.SEED_MEMBER_PASSWORD;
  if (!adminPassword || !memberPassword) {
    throw new Error(
      "SEED_ADMIN_PASSWORD and SEED_MEMBER_PASSWORD must be set in the environment before running the seed."
    );
  }

  // Clear existing data
  await prisma.expenseParticipant.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.user.deleteMany();

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const memberHash = await bcrypt.hash(memberPassword, 10);

  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@splitzees.local",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  const member = await prisma.user.create({
    data: {
      name: "Alex",
      email: "alex@splitzees.local",
      passwordHash: memberHash,
      role: "MEMBER",
    },
  });

  // Expense 1: Equal split, admin pays
  await prisma.expense.create({
    data: {
      title: "Groceries",
      amountCents: 4500,
      currencyCode: "GBP",
      date: new Date("2026-03-20"),
      note: "Weekly shop",
      paidByUserId: admin.id,
      createdByUserId: admin.id,
      splitType: "EQUAL",
      participants: {
        create: [
          { userId: admin.id, shareCents: 2250 },
          { userId: member.id, shareCents: 2250 },
        ],
      },
    },
  });

  // Expense 2: Equal split, member pays
  await prisma.expense.create({
    data: {
      title: "Coffee",
      amountCents: 750,
      currencyCode: "GBP",
      date: new Date("2026-03-21"),
      paidByUserId: member.id,
      createdByUserId: member.id,
      splitType: "EQUAL",
      participants: {
        create: [
          { userId: admin.id, shareCents: 375 },
          { userId: member.id, shareCents: 375 },
        ],
      },
    },
  });

  // Expense 3: Custom split, admin pays
  await prisma.expense.create({
    data: {
      title: "Dinner",
      amountCents: 6000,
      currencyCode: "GBP",
      date: new Date("2026-03-22"),
      note: "Admin had the steak",
      paidByUserId: admin.id,
      createdByUserId: admin.id,
      splitType: "CUSTOM",
      participants: {
        create: [
          { userId: admin.id, shareCents: 3500 },
          { userId: member.id, shareCents: 2500 },
        ],
      },
    },
  });

  // Expense 4: MYR currency
  await prisma.expense.create({
    data: {
      title: "Taxi in KL",
      amountCents: 2400,
      currencyCode: "MYR",
      date: new Date("2026-03-23"),
      paidByUserId: member.id,
      createdByUserId: member.id,
      splitType: "EQUAL",
      participants: {
        create: [
          { userId: admin.id, shareCents: 1200 },
          { userId: member.id, shareCents: 1200 },
        ],
      },
    },
  });

  console.log("Seeded: admin@splitzees.local (password from SEED_ADMIN_PASSWORD)");
  console.log("Seeded: alex@splitzees.local (password from SEED_MEMBER_PASSWORD)");
  console.log("Seeded: 4 example expenses");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
