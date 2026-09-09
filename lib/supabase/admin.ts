// Client dùng service-role key, BỎ QUA RLS hoàn toàn — chỉ dùng bên trong Server Actions,
// và chỉ sau khi action đã tự kiểm tra quyền (requireUser/requireRole) trong code.
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
