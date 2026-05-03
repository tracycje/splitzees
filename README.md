# Splitzees

Simple private expense-sharing app for a small group.

## Setup

```bash
npm install
npx prisma db push
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Default Accounts

| Account | Email | Password |
|---------|-------|----------|
| Admin | admin@splitzees.local | admin123 |
| Member | alex@splitzees.local | member123 |

## Features

- Add expenses with equal or custom splits
- Track who paid, borrowed, lent, owes, and is owed
- Per-user balance summaries with pairwise breakdowns
- Settlement suggestions (who should pay whom)
- Multi-currency support (GBP, MYR, NTD, USD, EUR)
- Admin user management

## Stack

- Next.js 16 (App Router)
- TypeScript, Tailwind CSS
- Prisma + SQLite
- iron-session for auth
- Money stored as integer cents

## Tests

```bash
npm test
```

Covers the core calculation engine (equal splits, custom splits, user balances, pairwise gross/net).
