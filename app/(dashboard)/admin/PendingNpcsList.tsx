"use client";

import { useState } from "react";

type PendingNpc = {
  id: string;
  name: string;
  name_zh: string;
  emoji: string;
  gender: string;
  role: string;
  goal: string;
  greeting_zh: string;
  greeting_pinyin: string;
  greeting_vi: string;
  zone_name: string;
  creator_email: string;
};

export default function PendingNpcsList({ initialNpcs }: { initialNpcs: PendingNpc[] }) {
  const [npcs, setNpcs] = useState(initialNpcs);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/npcs/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Có lỗi xảy ra.");
        return;
      }
      setNpcs((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  if (!npcs.length) {
    return <p className="text-[#8a7a63] text-sm">Không có nhân vật nào chờ duyệt.</p>;
  }

  return (
    <div className="space-y-3">
      {npcs.map((npc) => (
        <div key={npc.id} className="bg-[#f0e6d2] rounded-xl p-4 flex gap-4">
          <div className="text-3xl">{npc.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[#3a2b1a]">
              {npc.name} ({npc.name_zh}) — {npc.gender === "female" ? "Nữ" : "Nam"}
            </div>
            <div className="text-xs text-[#8a7a63] mb-1">
              Khu vực: {npc.zone_name} · Người tạo: {npc.creator_email}
            </div>
            <div className="text-sm text-[#5a4a35]">{npc.role}</div>
            <div className="text-sm text-[#5a4a35] italic">Mục tiêu: {npc.goal}</div>
            <div className="mt-2 text-sm">
              <div className="font-semibold">{npc.greeting_zh}</div>
              <div className="text-[#8a7a63]">{npc.greeting_pinyin}</div>
              <div className="text-[#8a7a63]">{npc.greeting_vi}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              disabled={busyId === npc.id}
              onClick={() => review(npc.id, "approve")}
              className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              ✓ Duyệt
            </button>
            <button
              disabled={busyId === npc.id}
              onClick={() => review(npc.id, "reject")}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              ✕ Từ chối
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
