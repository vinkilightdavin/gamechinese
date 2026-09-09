import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getZonesWithNpcs } from "@/lib/zones";
import GameClient from "./GameClient";

export default async function GamePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  if (profile.status === "locked") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1410] text-white">
        <p>Tài khoản của bạn đã bị khóa. Liên hệ quản trị viên.</p>
      </div>
    );
  }

  const zones = await getZonesWithNpcs();

  return (
    <GameClient
      zones={zones}
      profile={{ id: profile.id, email: profile.email, displayName: profile.display_name, role: profile.role }}
    />
  );
}
