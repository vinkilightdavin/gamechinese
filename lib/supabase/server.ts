// Client dùng anon key, tuân theo RLS — dùng trong Server Components để đọc dữ liệu public/của chính user.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Bị gọi từ Server Component (không có quyền set cookie) — bỏ qua,
            // vì proxy.ts đã lo phần refresh session trên mọi request rồi.
          }
        },
      },
    }
  );
}
