import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

export default async function Home() {
  const profile = await getCurrentUserProfile();
  redirect(profile ? "/game" : "/login");
}
