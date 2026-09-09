import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSettings } from "@/lib/settings";
import PendingNpcsList from "./PendingNpcsList";
import SettingsForm from "./SettingsForm";

export default async function AdminPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/game");

  const admin = createAdminClient();
  const { data: pendingRaw } = await admin
    .from("npcs")
    .select("id, name, name_zh, emoji, gender, role, goal, greeting_zh, greeting_pinyin, greeting_vi, zones(name), profiles(email)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  type PendingRow = {
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
    zones: { name: string } | { name: string }[] | null;
    profiles: { email: string } | { email: string }[] | null;
  };

  const first = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

  const pendingNpcs = ((pendingRaw as PendingRow[] | null) ?? []).map((n) => ({
    id: n.id,
    name: n.name,
    name_zh: n.name_zh,
    emoji: n.emoji,
    gender: n.gender,
    role: n.role,
    goal: n.goal,
    greeting_zh: n.greeting_zh,
    greeting_pinyin: n.greeting_pinyin,
    greeting_vi: n.greeting_vi,
    zone_name: first(n.zones)?.name || "?",
    creator_email: first(n.profiles)?.email || "?",
  }));

  const settings = await getAppSettings();

  return (
    <div className="min-h-screen bg-[#1a1410] text-white p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Trang quản trị</h1>
        <a href="/game" className="text-[#e0a030] underline">
          ◀ Về game
        </a>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Cấu hình giới hạn</h2>
        <SettingsForm initialMaxMessages={settings.maxMessagesPerDay} initialMaxCharacters={settings.maxCharactersPerUser} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Nhân vật chờ duyệt ({pendingNpcs.length})</h2>
        <PendingNpcsList initialNpcs={pendingNpcs} />
      </section>
    </div>
  );
}
