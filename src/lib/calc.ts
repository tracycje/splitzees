/**
 * Pure calculation engine for expense splitting and balance computation.
 * All amounts are in integer cents.
 */

export interface ExpenseData {
  id: string;
  amountCents: number;
  paidByUserId: string;
  participants: { userId: string; shareCents: number }[];
}

export interface UserBalance {
  userId: string;
  totalPaid: number;
  totalOwnShare: number;
  grossBorrowed: number;
  grossLent: number;
  netBalance: number; // positive = owed, negative = owes
}

export interface PairwiseGross {
  fromUserId: string;
  toUserId: string;
  amount: number; // gross amount borrowed by fromUser from toUser
}

export interface PairwiseNet {
  fromUserId: string;
  toUserId: string;
  amount: number; // net: fromUser owes toUser this amount (always positive)
}

/**
 * Split an amount equally among n participants.
 * Distributes remainder cents to participants by order (first get extra cent).
 */
export function splitEqual(amountCents: number, participantCount: number): number[] {
  if (participantCount <= 0) return [];
  const base = Math.floor(amountCents / participantCount);
  const remainder = amountCents - base * participantCount;
  return Array.from({ length: participantCount }, (_, i) =>
    base + (i < remainder ? 1 : 0)
  );
}

/**
 * Validate that custom shares sum to the total.
 */
export function validateCustomShares(amountCents: number, shares: number[]): boolean {
  const sum = shares.reduce((a, b) => a + b, 0);
  return sum === amountCents;
}

/**
 * Compute per-user balances from a list of expenses.
 */
export function computeUserBalances(
  expenses: ExpenseData[],
  userIds: string[]
): Map<string, UserBalance> {
  const balances = new Map<string, UserBalance>();
  for (const uid of userIds) {
    balances.set(uid, {
      userId: uid,
      totalPaid: 0,
      totalOwnShare: 0,
      grossBorrowed: 0,
      grossLent: 0,
      netBalance: 0,
    });
  }

  for (const exp of expenses) {
    const payer = balances.get(exp.paidByUserId);
    if (payer) {
      payer.totalPaid += exp.amountCents;
    }

    for (const p of exp.participants) {
      const user = balances.get(p.userId);
      if (user) {
        user.totalOwnShare += p.shareCents;

        if (p.userId !== exp.paidByUserId) {
          // This user's share was paid by someone else -> borrowed
          user.grossBorrowed += p.shareCents;
        }
      }
    }

    // Payer lent to all non-payer participants
    if (payer) {
      for (const p of exp.participants) {
        if (p.userId !== exp.paidByUserId) {
          payer.grossLent += p.shareCents;
        }
      }
    }
  }

  for (const b of balances.values()) {
    b.netBalance = b.totalPaid - b.totalOwnShare;
  }

  return balances;
}

/**
 * Compute gross pairwise borrowing amounts.
 * Returns list of { fromUserId borrows amount from toUserId }.
 */
export function computePairwiseGross(expenses: ExpenseData[]): PairwiseGross[] {
  // Map: "fromId->toId" => total gross borrowed
  const grossMap = new Map<string, number>();

  for (const exp of expenses) {
    for (const p of exp.participants) {
      if (p.userId !== exp.paidByUserId) {
        const key = `${p.userId}->${exp.paidByUserId}`;
        grossMap.set(key, (grossMap.get(key) || 0) + p.shareCents);
      }
    }
  }

  const result: PairwiseGross[] = [];
  for (const [key, amount] of grossMap) {
    const [fromUserId, toUserId] = key.split("->");
    result.push({ fromUserId, toUserId, amount });
  }
  return result;
}

/**
 * Compute net pairwise balances (simplified debts).
 * After netting opposite directions, returns only positive amounts.
 */
export function computePairwiseNet(expenses: ExpenseData[]): PairwiseNet[] {
  // Net map: use sorted key to avoid double-counting
  const netMap = new Map<string, number>();

  for (const exp of expenses) {
    for (const p of exp.participants) {
      if (p.userId !== exp.paidByUserId) {
        // p.userId owes paidByUserId p.shareCents
        const [a, b] = [p.userId, exp.paidByUserId].sort();
        const key = `${a}<>${b}`;
        const current = netMap.get(key) || 0;
        // If p.userId === a, then p owes b, so add
        // If p.userId === b, then p owes a, so subtract
        if (p.userId === a) {
          netMap.set(key, current + p.shareCents);
        } else {
          netMap.set(key, current - p.shareCents);
        }
      }
    }
  }

  const result: PairwiseNet[] = [];
  for (const [key, amount] of netMap) {
    const [a, b] = key.split("<>");
    if (amount > 0) {
      // a owes b
      result.push({ fromUserId: a, toUserId: b, amount });
    } else if (amount < 0) {
      // b owes a
      result.push({ fromUserId: b, toUserId: a, amount: -amount });
    }
  }
  return result;
}

/**
 * Format cents to a display string (e.g. 1234 -> "12.34").
 */
export function formatCents(cents: number, currencyCode: string = "GBP"): string {
  const symbols: Record<string, string> = {
    GBP: "£",
    MYR: "RM",
    NTD: "NT$",
    USD: "$",
    EUR: "€",
  };
  const symbol = symbols[currencyCode] || currencyCode + " ";
  const abs = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  return `${sign}${symbol}${(abs / 100).toFixed(2)}`;
}
