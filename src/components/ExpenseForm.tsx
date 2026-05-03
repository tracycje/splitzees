"use client";

import { useState, useEffect, useActionState } from "react";
import { createExpense, updateExpense } from "@/lib/actions";
import { formatCents } from "@/lib/calc";
import { CURRENCIES, fetchRates, convertCents, getCachedRates } from "@/lib/rates";

interface User {
  id: string;
  name: string;
}

interface ExistingExpense {
  id: string;
  title: string;
  amountCents: number;
  currencyCode: string;
  date: string;
  note: string | null;
  paidByUserId: string;
  splitType: string;
  participants: { userId: string; shareCents: number }[];
}

export default function ExpenseForm({
  users,
  currentUserId,
  expense,
  onDone,
}: {
  users: User[];
  currentUserId: string;
  expense?: ExistingExpense | null;
  onDone?: () => void;
}) {
  const isEdit = !!expense;

  const [splitType, setSplitType] = useState(expense?.splitType || "EQUAL");
  const [selectedIds, setSelectedIds] = useState<string[]>(
    expense?.participants.map((p) => p.userId) ||
    (users.length <= 3 ? users.map((u) => u.id) : [currentUserId])
  );
  const [customShares, setCustomShares] = useState<Record<string, string>>(
    expense?.participants.reduce(
      (acc, p) => ({ ...acc, [p.userId]: (p.shareCents / 100).toFixed(2) }),
      {} as Record<string, string>
    ) || {}
  );
  const [amount, setAmount] = useState(
    expense ? (expense.amountCents / 100).toFixed(2) : ""
  );
  const [currency, setCurrency] = useState(expense?.currencyCode || "GBP");
  const [rates, setRates] = useState<Record<string, number> | null>(getCachedRates());

  useEffect(() => {
    if (rates) return;
    let cancelled = false;
    fetchRates().then((r) => {
      if (!cancelled && r) setRates(r);
    });
    return () => {
      cancelled = true;
    };
  }, [rates]);

  const amountNum = parseFloat(amount || "0");
  const conversions: { code: string; cents: number }[] = [];
  if (rates && amountNum > 0) {
    const sourceCents = Math.round(amountNum * 100);
    for (const c of CURRENCIES) {
      if (c === currency) continue;
      const converted = convertCents(sourceCents, currency, c, rates);
      if (converted !== null) conversions.push({ code: c, cents: converted });
    }
  }

  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const customSum = selectedIds.reduce(
    (sum, id) => sum + Math.round(parseFloat(customShares[id] || "0") * 100),
    0
  );
  const customValid = splitType !== "CUSTOM" || customSum === amountCents;

  async function handleAction(_prev: unknown, formData: FormData) {
    // Add participant IDs to form data
    selectedIds.forEach((id) => formData.append("participantIds", id));

    // Add custom shares
    if (splitType === "CUSTOM") {
      selectedIds.forEach((id) => {
        formData.set(`share_${id}`, customShares[id] || "0");
      });
    }

    if (isEdit) {
      formData.set("id", expense!.id);
    }

    const result = isEdit
      ? await updateExpense(formData)
      : await createExpense(formData);

    if (result?.error) return result;
    onDone?.();
    return result;
  }

  const [state, formAction, pending] = useActionState(handleAction, null);

  const toggleParticipant = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          name="title"
          required
          defaultValue={expense?.title}
          className="w-full border rounded-md px-3 py-2 text-sm"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Amount</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <select
            name="currencyCode"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
          >
            <option value="GBP">GBP (£)</option>
            <option value="MYR">MYR (RM)</option>
            <option value="NTD">NTD (NT$)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </div>
      </div>

      {conversions.length > 0 && (
        <div className="text-xs text-gray-500 -mt-2">
          ≈ {conversions.map((c) => formatCents(c.cents, c.code)).join(" · ")}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            name="date"
            type="date"
            defaultValue={
              expense?.date ||
              new Date().toISOString().split("T")[0]
            }
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Paid by</label>
          <select
            name="paidByUserId"
            defaultValue={expense?.paidByUserId || currentUserId}
            className="w-full border rounded-md px-3 py-2 text-sm"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Note (optional)</label>
        <input
          name="note"
          defaultValue={expense?.note || ""}
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Split type</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="splitType"
              value="EQUAL"
              checked={splitType === "EQUAL"}
              onChange={() => setSplitType("EQUAL")}
            />
            Equal
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="radio"
              name="splitType"
              value="CUSTOM"
              checked={splitType === "CUSTOM"}
              onChange={() => setSplitType("CUSTOM")}
            />
            Custom
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Participants</label>
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm flex-1">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(u.id)}
                  onChange={() => toggleParticipant(u.id)}
                />
                {u.name}
              </label>
              {splitType === "CUSTOM" && selectedIds.includes(u.id) && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={customShares[u.id] || ""}
                  onChange={(e) =>
                    setCustomShares((prev) => ({
                      ...prev,
                      [u.id]: e.target.value,
                    }))
                  }
                  className="border rounded-md px-2 py-1 text-sm w-24"
                />
              )}
            </div>
          ))}
        </div>
        {splitType === "CUSTOM" && amount && (
          <div className={`text-xs mt-2 ${customValid ? "text-green-600" : "text-red-600"}`}>
            Total of shares: {(customSum / 100).toFixed(2)} / {parseFloat(amount).toFixed(2)}
            {!customValid && " — must match!"}
          </div>
        )}
      </div>

      {state?.error && <p className="text-red-600 text-sm">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || (splitType === "CUSTOM" && !customValid)}
        className="w-full bg-indigo-600 text-white py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? "Saving..." : isEdit ? "Update Expense" : "Add Expense"}
      </button>
    </form>
  );
}
