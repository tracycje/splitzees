import Shell from "@/components/Shell";
import { getExpenses, getActiveUsers } from "@/lib/actions";
import {
  computeUserBalances,
  computePairwiseGross,
  computePairwiseNet,
  ExpenseData,
} from "@/lib/calc";
import ConvertedAmount from "@/components/ConvertedAmount";

export const dynamic = "force-dynamic";

export default async function BalancesPage() {
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
        pairwiseGross: computePairwiseGross(data),
        pairwiseNet: computePairwiseNet(data),
      };
    }
  );

  const showCurrencyHeadings = currencyGroups.length > 1;

  return (
    <Shell>
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Balances</h1>

        {currencyGroups.map(({ currency, balances, pairwiseGross, pairwiseNet }) => (
          <div key={currency} className="space-y-6">
            {showCurrencyHeadings && (
              <h2 className="text-base font-semibold text-gray-700 border-b pb-1">
                {currency}
              </h2>
            )}

            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="font-semibold">User Balances</h2>
              </div>
              <div className="divide-y">
                {users.map((u) => {
                  const b = balances.get(u.id)!;
                  return (
                    <div key={u.id} className="p-4">
                      <div className="font-medium mb-2">{u.name}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Paid: </span>
                          <ConvertedAmount cents={b.totalPaid} currency={currency} />
                        </div>
                        <div>
                          <span className="text-gray-500">Own share: </span>
                          <ConvertedAmount cents={b.totalOwnShare} currency={currency} />
                        </div>
                        <div>
                          <span className="text-gray-500">Borrowed: </span>
                          <ConvertedAmount cents={b.grossBorrowed} currency={currency} />
                        </div>
                        <div>
                          <span className="text-gray-500">Lent: </span>
                          <ConvertedAmount cents={b.grossLent} currency={currency} />
                        </div>
                        <div>
                          <span className="text-gray-500">Net: </span>
                          <span
                            className={
                              b.netBalance >= 0 ? "text-green-600" : "text-red-600"
                            }
                          >
                            <ConvertedAmount cents={b.netBalance} currency={currency} />
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1">
                        {pairwiseGross
                          .filter((g) => g.fromUserId === u.id)
                          .map((g, i) => (
                            <div key={`bf-${i}`} className="text-xs text-gray-500">
                              Borrowed{" "}
                              <ConvertedAmount cents={g.amount} currency={currency} />{" "}
                              from {userMap.get(g.toUserId)}
                            </div>
                          ))}
                        {pairwiseGross
                          .filter((g) => g.toUserId === u.id)
                          .map((g, i) => (
                            <div key={`lt-${i}`} className="text-xs text-gray-500">
                              Lent{" "}
                              <ConvertedAmount cents={g.amount} currency={currency} />{" "}
                              to {userMap.get(g.fromUserId)}
                            </div>
                          ))}
                        {pairwiseNet
                          .filter((n) => n.fromUserId === u.id)
                          .map((n, i) => (
                            <div key={`ow-${i}`} className="text-xs text-red-600">
                              Owes{" "}
                              <ConvertedAmount cents={n.amount} currency={currency} />{" "}
                              to {userMap.get(n.toUserId)}
                            </div>
                          ))}
                        {pairwiseNet
                          .filter((n) => n.toUserId === u.id)
                          .map((n, i) => (
                            <div key={`ob-${i}`} className="text-xs text-green-600">
                              Is owed{" "}
                              <ConvertedAmount cents={n.amount} currency={currency} />{" "}
                              by {userMap.get(n.fromUserId)}
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {pairwiseNet.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="font-semibold mb-3">Settlement Summary</h2>
                <div className="space-y-2">
                  {pairwiseNet.map((d, i) => (
                    <div
                      key={i}
                      className="flex justify-between text-sm bg-gray-50 rounded px-3 py-2"
                    >
                      <span>
                        <span className="font-medium">
                          {userMap.get(d.fromUserId)}
                        </span>{" "}
                        should pay{" "}
                        <span className="font-medium">
                          {userMap.get(d.toUserId)}
                        </span>
                      </span>
                      <span className="font-bold text-red-600">
                        <ConvertedAmount cents={d.amount} currency={currency} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}
