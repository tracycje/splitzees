"use client";

import { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import ExpenseForm from "@/components/ExpenseForm";
import { getExpenses, getActiveUsers, deleteExpense } from "@/lib/actions";
import { formatCents } from "@/lib/calc";
import { useSearchParams } from "next/navigation";

// We need a client wrapper since we use useState for the modal
// But Shell is a server component — we'll work around this

export default function ExpensesPage() {
  return <ExpensesClient />;
}

type SortKey = "latestAdded" | "oldestAdded" | "newestDate" | "oldestDate";

const SORT_LABELS: Record<SortKey, string> = {
  latestAdded: "Latest added",
  oldestAdded: "Oldest added",
  newestDate: "Newest date",
  oldestDate: "Oldest date",
};

function ExpensesClient() {
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [editId, setEditId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof getExpenses>>>([]);
  const [users, setUsers] = useState<Awaited<ReturnType<typeof getActiveUsers>>>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [paidByFilter, setPaidByFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("latestAdded");

  const load = async () => {
    const [exp, usr] = await Promise.all([getExpenses(), getActiveUsers()]);
    setExpenses(exp);
    setUsers(usr);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Get current user from cookie — we'll read it via a simple fetch
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setCurrentUserId(d.userId || ""));
  }, []);

  const editingExpense = editId
    ? expenses.find((e) => e.id === editId)
    : null;

  const editData = editingExpense
    ? {
        id: editingExpense.id,
        title: editingExpense.title,
        amountCents: editingExpense.amountCents,
        currencyCode: editingExpense.currencyCode,
        date: new Date(editingExpense.date).toISOString().split("T")[0],
        note: editingExpense.note,
        paidByUserId: editingExpense.paidByUserId,
        splitType: editingExpense.splitType,
        participants: editingExpense.participants.map((p) => ({
          userId: p.userId,
          shareCents: p.shareCents,
        })),
      }
    : null;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    const fd = new FormData();
    fd.set("id", id);
    await deleteExpense(fd);
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  const filtersActive =
    (paidByFilter !== "all" ? 1 : 0) + (sortBy !== "latestAdded" ? 1 : 0);

  const visibleExpenses = expenses
    .filter((e) => paidByFilter === "all" || e.paidByUserId === paidByFilter)
    .slice()
    .sort((a, b) => {
      switch (sortBy) {
        case "latestAdded":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldestAdded":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "newestDate":
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case "oldestDate":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Expenses</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`px-3 py-2 rounded-md text-sm font-medium border ${
              filtersActive > 0
                ? "border-indigo-600 text-indigo-700 bg-indigo-50"
                : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            }`}
          >
            Filter{filtersActive > 0 ? ` (${filtersActive})` : ""}
          </button>
          <button
            onClick={() => {
              setEditId(null);
              setShowForm(true);
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
          >
            + Add Expense
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Paid by
              </label>
              <select
                value={paidByFilter}
                onChange={(e) => setPaidByFilter(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="all">Anyone</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {filtersActive > 0 && (
            <button
              onClick={() => {
                setPaidByFilter("all");
                setSortBy("latestAdded");
              }}
              className="text-xs text-indigo-600 hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {(showForm || editId) && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">
              {editId ? "Edit Expense" : "New Expense"}
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              Cancel
            </button>
          </div>
          <ExpenseForm
            users={users}
            currentUserId={currentUserId}
            expense={editData}
            onDone={() => {
              setShowForm(false);
              setEditId(null);
              load();
            }}
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        {expenses.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No expenses yet.</p>
        ) : visibleExpenses.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            No expenses match the current filter.
          </p>
        ) : (
          <div className="divide-y">
            {visibleExpenses.map((e) => (
              <div key={e.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-sm text-gray-500">
                      Paid by {e.paidBy.name} &middot;{" "}
                      {new Date(e.date).toLocaleDateString()} &middot;{" "}
                      {e.splitType === "EQUAL" ? "Equal split" : "Custom split"}
                    </div>
                    {e.note && (
                      <div className="text-sm text-gray-400 mt-1">{e.note}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      Split: {e.participants.map((p) => `${p.user.name} (${formatCents(p.shareCents, e.currencyCode)})`).join(", ")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {formatCents(e.amountCents, e.currencyCode)}
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => {
                          setShowForm(false);
                          setEditId(e.id);
                        }}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
