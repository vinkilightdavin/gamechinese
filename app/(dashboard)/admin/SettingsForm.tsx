"use client";

import { useState } from "react";

export default function SettingsForm({
  initialMaxMessages,
  initialMaxCharacters,
}: {
  initialMaxMessages: number;
  initialMaxCharacters: number;
}) {
  const [maxMessages, setMaxMessages] = useState(initialMaxMessages);
  const [maxCharacters, setMaxCharacters] = useState(initialMaxCharacters);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxMessagesPerDay: maxMessages, maxCharactersPerUser: maxCharacters }),
      });
      const data = await res.json();
      setMessage(res.ok ? "Đã lưu." : data.error || "Có lỗi xảy ra.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-[#f0e6d2] rounded-xl p-4 max-w-sm space-y-3">
      <div>
        <label className="block text-sm font-semibold text-[#3a2b1a] mb-1">Số tin nhắn tối đa / ngày / tài khoản</label>
        <input
          type="number"
          min={1}
          value={maxMessages}
          onChange={(e) => setMaxMessages(Number(e.target.value))}
          className="w-full px-3 py-2 rounded-lg border border-[#d8cdb8] text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-[#3a2b1a] mb-1">Số nhân vật tối đa / tài khoản</label>
        <input
          type="number"
          min={0}
          value={maxCharacters}
          onChange={(e) => setMaxCharacters(Number(e.target.value))}
          className="w-full px-3 py-2 rounded-lg border border-[#d8cdb8] text-sm"
        />
      </div>
      <button
        disabled={saving}
        onClick={save}
        className="px-4 py-2 rounded-lg bg-[#b5651d] text-white text-sm font-semibold disabled:opacity-60"
      >
        {saving ? "Đang lưu..." : "Lưu"}
      </button>
      {message && <p className="text-sm text-[#5a4a35]">{message}</p>}
    </div>
  );
}
