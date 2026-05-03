"use client";

import { useState, useEffect, useActionState } from "react";
import { getAllUsers, createUser, updateUser } from "@/lib/actions";

export default function UsersPage() {
  return <UsersClient />;
}

function UsersClient() {
  const [users, setUsers] = useState<Awaited<ReturnType<typeof getAllUsers>>>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const data = await getAllUsers();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Users</h1>
        <button
          onClick={() => {
            setEditId(null);
            setShowForm(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
        >
          + Add User
        </button>
      </div>

      {showForm && !editId && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">New User</h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              Cancel
            </button>
          </div>
          <CreateUserForm
            onDone={() => {
              setShowForm(false);
              load();
            }}
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow divide-y">
        {users.map((u) => (
          <div key={u.id} className="p-4">
            {editId === u.id ? (
              <EditUserForm
                user={u}
                onDone={() => {
                  setEditId(null);
                  load();
                }}
                onCancel={() => setEditId(null)}
              />
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{u.name}</span>
                  <span className="text-sm text-gray-500 ml-2">{u.email}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {u.role}
                  </span>
                  {!u.active && (
                    <span className="text-xs text-red-500 ml-2">
                      (inactive)
                    </span>
                  )}
                </div>
                {u.role !== "ADMIN" && (
                  <button
                    onClick={() => setEditId(u.id)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  async function handleAction(_prev: unknown, formData: FormData) {
    const result = await createUser(formData);
    if (result?.error) return result;
    onDone();
    return result;
  }

  const [state, formAction, pending] = useActionState(handleAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <input name="name" placeholder="Name" required className="w-full border rounded-md px-3 py-2 text-sm" />
      <input name="email" type="email" placeholder="Email" required className="w-full border rounded-md px-3 py-2 text-sm" />
      <input name="password" type="password" placeholder="Password" required className="w-full border rounded-md px-3 py-2 text-sm" />
      {state?.error && <p className="text-red-600 text-sm">{state.error}</p>}
      <button type="submit" disabled={pending} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
        {pending ? "Creating..." : "Create User"}
      </button>
    </form>
  );
}

function EditUserForm({
  user,
  onDone,
  onCancel,
}: {
  user: { id: string; name: string; email: string; active: boolean };
  onDone: () => void;
  onCancel: () => void;
}) {
  async function handleAction(_prev: unknown, formData: FormData) {
    formData.set("id", user.id);
    const result = await updateUser(formData);
    if (result?.error) return result;
    onDone();
    return result;
  }

  const [state, formAction, pending] = useActionState(handleAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <input name="name" defaultValue={user.name} required className="w-full border rounded-md px-3 py-2 text-sm" />
      <input name="email" type="email" defaultValue={user.email} required className="w-full border rounded-md px-3 py-2 text-sm" />
      <input name="password" type="password" placeholder="New password (leave empty to keep)" className="w-full border rounded-md px-3 py-2 text-sm" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" value="true" defaultChecked={user.active} />
        Active
      </label>
      {state?.error && <p className="text-red-600 text-sm">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {pending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </form>
  );
}
