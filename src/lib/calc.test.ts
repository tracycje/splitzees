import { describe, it, expect } from "vitest";
import {
  splitEqual,
  validateCustomShares,
  computeUserBalances,
  computePairwiseGross,
  computePairwiseNet,
  formatCents,
  ExpenseData,
} from "./calc";

describe("splitEqual", () => {
  it("splits evenly when divisible", () => {
    expect(splitEqual(1000, 2)).toEqual([500, 500]);
    expect(splitEqual(900, 3)).toEqual([300, 300, 300]);
  });

  it("distributes remainder to first participants", () => {
    expect(splitEqual(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEqual(100, 3)).toEqual([34, 33, 33]);
    expect(splitEqual(1, 3)).toEqual([1, 0, 0]);
  });

  it("sums to original amount", () => {
    for (const [amount, count] of [[9999, 7], [1, 5], [10000, 3], [5, 2]]) {
      const shares = splitEqual(amount, count);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(amount);
      expect(shares.length).toBe(count);
    }
  });

  it("handles single participant", () => {
    expect(splitEqual(500, 1)).toEqual([500]);
  });

  it("handles zero participants", () => {
    expect(splitEqual(500, 0)).toEqual([]);
  });
});

describe("validateCustomShares", () => {
  it("returns true when shares match amount", () => {
    expect(validateCustomShares(1000, [600, 400])).toBe(true);
  });

  it("returns false when shares don't match", () => {
    expect(validateCustomShares(1000, [600, 300])).toBe(false);
    expect(validateCustomShares(1000, [600, 500])).toBe(false);
  });
});

describe("computeUserBalances", () => {
  const alice = "alice";
  const bob = "bob";

  it("calculates simple equal split between two people", () => {
    const expenses: ExpenseData[] = [
      {
        id: "e1",
        amountCents: 1000,
        paidByUserId: alice,
        participants: [
          { userId: alice, shareCents: 500 },
          { userId: bob, shareCents: 500 },
        ],
      },
    ];

    const balances = computeUserBalances(expenses, [alice, bob]);
    const a = balances.get(alice)!;
    const b = balances.get(bob)!;

    expect(a.totalPaid).toBe(1000);
    expect(a.totalOwnShare).toBe(500);
    expect(a.grossLent).toBe(500);
    expect(a.grossBorrowed).toBe(0);
    expect(a.netBalance).toBe(500); // owed 500

    expect(b.totalPaid).toBe(0);
    expect(b.totalOwnShare).toBe(500);
    expect(b.grossLent).toBe(0);
    expect(b.grossBorrowed).toBe(500);
    expect(b.netBalance).toBe(-500); // owes 500
  });

  it("handles multiple expenses and netting", () => {
    const expenses: ExpenseData[] = [
      {
        id: "e1",
        amountCents: 3000,
        paidByUserId: alice,
        participants: [
          { userId: alice, shareCents: 1000 },
          { userId: bob, shareCents: 2000 },
        ],
      },
      {
        id: "e2",
        amountCents: 1000,
        paidByUserId: bob,
        participants: [
          { userId: alice, shareCents: 1000 },
        ],
      },
    ];

    const balances = computeUserBalances(expenses, [alice, bob]);
    const a = balances.get(alice)!;
    const b = balances.get(bob)!;

    expect(a.totalPaid).toBe(3000);
    expect(a.totalOwnShare).toBe(2000); // 1000 + 1000
    expect(a.grossLent).toBe(2000); // lent bob 2000
    expect(a.grossBorrowed).toBe(1000); // borrowed 1000 from bob
    expect(a.netBalance).toBe(1000); // 3000 - 2000

    expect(b.totalPaid).toBe(1000);
    expect(b.totalOwnShare).toBe(2000);
    expect(b.grossLent).toBe(1000); // lent alice 1000
    expect(b.grossBorrowed).toBe(2000); // borrowed 2000 from alice
    expect(b.netBalance).toBe(-1000);
  });

  it("handles expense where payer is only participant", () => {
    const expenses: ExpenseData[] = [
      {
        id: "e1",
        amountCents: 500,
        paidByUserId: alice,
        participants: [{ userId: alice, shareCents: 500 }],
      },
    ];

    const balances = computeUserBalances(expenses, [alice, bob]);
    const a = balances.get(alice)!;
    expect(a.totalPaid).toBe(500);
    expect(a.totalOwnShare).toBe(500);
    expect(a.grossLent).toBe(0);
    expect(a.grossBorrowed).toBe(0);
    expect(a.netBalance).toBe(0);
  });
});

describe("computePairwiseGross", () => {
  it("tracks gross borrowing per pair", () => {
    const expenses: ExpenseData[] = [
      {
        id: "e1",
        amountCents: 1000,
        paidByUserId: "alice",
        participants: [
          { userId: "alice", shareCents: 500 },
          { userId: "bob", shareCents: 500 },
        ],
      },
      {
        id: "e2",
        amountCents: 600,
        paidByUserId: "bob",
        participants: [
          { userId: "alice", shareCents: 300 },
          { userId: "bob", shareCents: 300 },
        ],
      },
    ];

    const gross = computePairwiseGross(expenses);
    const bobFromAlice = gross.find(
      (g) => g.fromUserId === "bob" && g.toUserId === "alice"
    );
    const aliceFromBob = gross.find(
      (g) => g.fromUserId === "alice" && g.toUserId === "bob"
    );

    expect(bobFromAlice?.amount).toBe(500);
    expect(aliceFromBob?.amount).toBe(300);
  });
});

describe("computePairwiseNet", () => {
  it("nets opposite directions", () => {
    const expenses: ExpenseData[] = [
      {
        id: "e1",
        amountCents: 3000,
        paidByUserId: "alice",
        participants: [
          { userId: "alice", shareCents: 1000 },
          { userId: "bob", shareCents: 2000 },
        ],
      },
      {
        id: "e2",
        amountCents: 1000,
        paidByUserId: "bob",
        participants: [
          { userId: "alice", shareCents: 1000 },
        ],
      },
    ];

    const net = computePairwiseNet(expenses);
    expect(net.length).toBe(1);
    // alice is owed net 1000 by bob (2000 - 1000)
    // So bob owes alice 1000
    const debt = net[0];
    expect(debt.fromUserId).toBe("bob");
    expect(debt.toUserId).toBe("alice");
    expect(debt.amount).toBe(1000);
  });

  it("returns empty when balanced", () => {
    const expenses: ExpenseData[] = [
      {
        id: "e1",
        amountCents: 1000,
        paidByUserId: "alice",
        participants: [
          { userId: "alice", shareCents: 500 },
          { userId: "bob", shareCents: 500 },
        ],
      },
      {
        id: "e2",
        amountCents: 1000,
        paidByUserId: "bob",
        participants: [
          { userId: "alice", shareCents: 500 },
          { userId: "bob", shareCents: 500 },
        ],
      },
    ];

    const net = computePairwiseNet(expenses);
    expect(net.length).toBe(0);
  });

  it("handles three-person scenario", () => {
    const expenses: ExpenseData[] = [
      {
        id: "e1",
        amountCents: 900,
        paidByUserId: "alice",
        participants: [
          { userId: "alice", shareCents: 300 },
          { userId: "bob", shareCents: 300 },
          { userId: "carol", shareCents: 300 },
        ],
      },
    ];

    const net = computePairwiseNet(expenses);
    expect(net.length).toBe(2);
    // bob owes alice 300, carol owes alice 300
    for (const debt of net) {
      expect(debt.toUserId).toBe("alice");
      expect(debt.amount).toBe(300);
    }
  });
});

describe("formatCents", () => {
  it("formats GBP correctly", () => {
    expect(formatCents(1234, "GBP")).toBe("£12.34");
    expect(formatCents(100, "GBP")).toBe("£1.00");
    expect(formatCents(0, "GBP")).toBe("£0.00");
  });

  it("formats negative amounts", () => {
    expect(formatCents(-500, "GBP")).toBe("-£5.00");
  });

  it("formats other currencies", () => {
    expect(formatCents(1000, "MYR")).toBe("RM10.00");
    expect(formatCents(1000, "NTD")).toBe("NT$10.00");
  });
});
