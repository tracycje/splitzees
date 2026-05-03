import Shell from "@/components/Shell";
import { getSession } from "@/lib/session";
import { getExpenses, getActiveUsers } from "@/lib/actions";
import { computeUserBalances, computePairwiseNet, formatCents, ExpenseData } from "@/lib/calc";
import Link from "next/link";
import PieChart from "@/components/PieChart";
import ConvertedAmount from "@/components/ConvertedAmount";
import { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  const [expenses, users] = await Promise.all([getExpenses(), getActiveUsers()]);

  const userIds = users.map((u) => u.id);
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const expensesByCurrency = new Map<string, typeof expenses>();
  for (const e of expenses) {
    const arr = expensesByCurrency.get(e.currencyCode) ?? [];
    arr.push(e);
    expensesByCurrency.set(e.currencyCode, arr);
  }

  const currencyGroups = Array.from(expensesByCurrency.entries()).map(
    ([currency, exps]) => {
      const data: ExpenseData[] = exps.map((e) => ({
        id: e.id,
        amountCents: e.amountCents,
        paidByUserId: e.paidByUserId,
        participants: e.participants.map((p) => ({
          userId: p.userId,
          shareCents: p.shareCents,
        })),
      }));
      return {
        currency,
        balances: computeUserBalances(data, userIds),
        pairwiseNet: computePairwiseNet(data),
      };
    }
  );

  const showCurrencyHeadings = currencyGroups.length > 1;

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Dashboard</h1>
          <Link
            href="/expenses?new=1"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
          >
            + Add Expense
          </Link>
        </div>

        {currencyGroups.map(({ currency, balances, pairwiseNet }) => {
          const myBalance = balances.get(session.userId!);
          return (
            <div key={currency} className="space-y-6">
              {showCurrencyHeadings && (
                <h2 className="text-base font-semibold text-gray-700 border-b pb-1">
                  {currency}
                </h2>
              )}

              {myBalance && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Card
                    label="Total Paid"
                    value={<ConvertedAmount cents={myBalance.totalPaid} currency={currency} />}
                  />
                  <Card
                    label="Total Borrowed"
                    value={<ConvertedAmount cents={myBalance.grossBorrowed} currency={currency} />}
                  />
                  <Card
                    label="Total Lent"
                    value={<ConvertedAmount cents={myBalance.grossLent} currency={currency} />}
                  />
                  <Card
                    label="Net Balance"
                    value={<ConvertedAmount cents={myBalance.netBalance} currency={currency} />}
                    color={myBalance.netBalance >= 0 ? "text-green-600" : "text-red-600"}
                  />
                  <Card
                    label="You Are Owed"
                    value={
                      <ConvertedAmount
                        cents={Math.max(0, myBalance.netBalance)}
                        currency={currency}
                      />
                    }
                    color="text-green-600"
                  />
                  <Card
                    label="You Owe"
                    value={
                      <ConvertedAmount
                        cents={Math.max(0, -myBalance.netBalance)}
                        currency={currency}
                      />
                    }
                    color="text-red-600"
                  />
                </div>
              )}

              <PieChart
                title={showCurrencyHeadings ? `Splitzees? (${currency})` : "Splitzees?"}
                slices={users.map((u, i) => ({
                  label: u.name,
                  value: balances.get(u.id)?.totalPaid || 0,
                  color: ["#ffd1dc", "#b3ebf2", "#10b981", "#ef4444", "#8b5cf6"][i % 5],
                }))}
              />

              {pairwiseNet.length > 0 && (
                <div className="bg-white rounded-lg shadow p-4">
                  <h2 className="font-semibold mb-3">Who Owes Whom</h2>
                  <div className="space-y-2">
                    {pairwiseNet.map((d, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>
                          <span className="font-medium">{userMap.get(d.fromUserId)}</span> owes{" "}
                          <span className="font-medium">{userMap.get(d.toUserId)}</span>
                        </span>
                        <span className="font-medium text-red-600">
                          <ConvertedAmount cents={d.amount} currency={currency} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Recent Expenses */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">Recent Expenses</h2>
          {expenses.length === 0 ? (
            <p className="text-sm text-gray-500">No expenses yet.</p>
          ) : (
            <div className="space-y-2">
              {expenses.slice(0, 10).map((e) => (
                <div key={e.id} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                  <div>
                    <span className="font-medium">{e.title}</span>
                    <span className="text-gray-500 ml-2">
                      paid by {e.paidBy.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{formatCents(e.amountCents, e.currencyCode)}</span>
                    <span className="text-gray-400 ml-2 text-xs">
                      {new Date(e.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Card({
  label,
  value,
  color,
}: {
  label: string;
  value: ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 overflow-visible">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color || ""}`}>{value}</div>
    </div>
  );
}
