"use client";

import { useState } from "react";

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "user";
  status: "active" | "locked";
  created_at: string;
};

export default function UsersList({ initialUsers, currentUserId }: { initialUsers: UserRow[]; currentUserId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleLock(id: string, nextStatus: "active" | "locked") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Có lỗi xảy ra.");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u)));
    } finally {
      setBusyId(null);
    }
  }

  if (!users.length) {
    return <p className="text-[#8a7a63] text-sm">Chưa có người dùng nào đăng ký.</p>;
  }

  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className="bg-[#f0e6d2] rounded-xl p-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[#3a2b1a] truncate">
              {u.display_name || "(chưa đặt tên)"} — {u.email}
              {u.role === "admin" && <span className="ml-2 text-xs bg-[#e0a030] text-white px-2 py-0.5 rounded-full">Admin</span>}
            </div>
            <div className="text-xs text-[#8a7a63]">
              Đăng ký: {new Date(u.created_at).toLocaleString("vi-VN")} · Trạng thái:{" "}
              {u.status === "locked" ? <span className="text-red-600 font-semibold">Đã khóa</span> : <span className="text-green-700">Hoạt động</span>}
            </div>
          </div>
          {u.id === currentUserId ? (
            <span className="text-xs text-[#8a7a63] shrink-0">(bạn)</span>
          ) : (
            <button
              disabled={busyId === u.id}
              onClick={() => toggleLock(u.id, u.status === "locked" ? "active" : "locked")}
              className={`px-3 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 shrink-0 ${
                u.status === "locked" ? "bg-green-600" : "bg-red-600"
              }`}
            >
              {u.status === "locked" ? "Mở khóa" : "Khóa"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
