import Nav from "./Nav";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function Shell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  return (
    <>
      <Nav role={session.role || "MEMBER"} />
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </>
  );
}
