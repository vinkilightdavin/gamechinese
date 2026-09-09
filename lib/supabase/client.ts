// Client dùng anon key, chạy trong trình duyệt — dùng cho Client Component cần tự gọi Supabase
// (vd: đăng xuất, theo dõi trạng thái auth). Các thao tác ghi dữ liệu quan trọng vẫn nên đi qua Server Action.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SB_URL!, process.env.NEXT_PUBLIC_SB_ANON_KEY!);
}
