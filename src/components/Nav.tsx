"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/actions";

export default function Nav({ role }: { role: string }) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/expenses", label: "Expenses" },
    { href: "/balances", label: "Balances" },
    ...(role === "ADMIN" ? [{ href: "/users", label: "Users" }] : []),
  ];

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold text-lg text-indigo-600">
            Splitzees
          </Link>
          <div className="flex gap-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm ${
                  pathname === l.href
                    ? "text-indigo-600 font-medium"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Logout
          </button>
        </form>
      </div>
    </nav>
  );
}
