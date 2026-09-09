-- ==========================================================================
-- Migration 0001: schema khởi tạo cho game nhập vai học tiếng Trung (multi-user)
-- Chạy thủ công trong Supabase Dashboard → SQL Editor.
-- ==========================================================================

-- ---------- profiles (hồ sơ người dùng, 1-1 với auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  status text not null default 'active' check (status in ('active', 'locked')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Mỗi người chỉ đọc được đúng hồ sơ của mình qua RLS. Admin cần xem hồ sơ người khác
-- thì dùng service-role client trong Server Action (đã tự kiểm tra role trong code),
-- không dựa vào RLS cho việc đó — tránh policy tự tham chiếu chính bảng profiles.
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Tự tạo 1 dòng profiles khi có tài khoản auth.users mới (mặc định role = 'user').
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- zones (khu vực trong game — admin tạo/quản lý) ----------
create table public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '📍',
  theme_id text not null default 'warm',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.zones enable row level security;

-- Đọc công khai cho người đã đăng nhập; ghi chỉ qua Server Action (service-role), không có policy ghi ở đây.
create policy "authenticated can read zones" on public.zones
  for select using (auth.role() = 'authenticated');

-- ---------- npcs (nhân vật trong từng khu vực) ----------
create table public.npcs (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete cascade,
  name text not null,
  name_zh text not null,
  emoji text not null default '🙂',
  gender text not null default 'male' check (gender in ('male', 'female')),
  color integer not null default 4886489,
  x integer not null default 480,
  y integer not null default 300,
  role text not null default '',
  goal text not null default '',
  greeting_zh text not null,
  greeting_pinyin text not null default '',
  greeting_vi text not null default '',
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  rejection_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.npcs enable row level security;

-- Ai cũng thấy nhân vật đã published; người tạo thấy thêm nhân vật pending/rejected của chính mình
-- (để tự xem trạng thái duyệt). Ghi (tạo/sửa/xóa/duyệt) chỉ qua Server Action.
create policy "read published or own npcs" on public.npcs
  for select using (status = 'published' or created_by = auth.uid());

-- ---------- app_settings (cấu hình admin chỉnh được, không cần deploy lại) ----------
create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "authenticated can read settings" on public.app_settings
  for select using (auth.role() = 'authenticated');

insert into public.app_settings (key, value) values
  ('max_messages_per_day', '30'),
  ('max_characters_per_user', '3');

-- ---------- usage_daily (đếm số tin nhắn/ngày để giới hạn chi phí AI) ----------
create table public.usage_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  message_count integer not null default 0,
  primary key (user_id, usage_date)
);

alter table public.usage_daily enable row level security;

create policy "read own usage" on public.usage_daily
  for select using (auth.uid() = user_id);

-- ---------- Seed: khu vực + nhân vật mặc định (Quán Trà Lão Vương) ----------
do $$
declare
  v_zone_id uuid;
begin
  insert into public.zones (name, emoji, theme_id) values ('Quán Trà Lão Vương', '🍵', 'warm')
    returning id into v_zone_id;

  insert into public.npcs (zone_id, name, name_zh, emoji, gender, color, x, y, role, goal, greeting_zh, greeting_pinyin, greeting_vi, status)
  values
    (v_zone_id, 'Lão Vương', '王师傅', '🧔', 'male', 11881245, 420, 260,
     'chủ quán trà, người Bắc Kinh trung niên, tính tình niềm nở, kiên nhẫn, hay mời khách thử trà mới',
     'giúp người chơi luyện hỏi giá, gọi trà, hỏi thăm sức khỏe/thời tiết — các chủ đề giao tiếp cơ bản ở quán trà',
     '欢迎光临!你想喝点什么茶?', 'Huānyíng guānglín! Nǐ xiǎng hē diǎn shénme chá?', 'Chào mừng! Cháu muốn uống trà gì?',
     'published'),
    (v_zone_id, 'Tiểu Mỹ', '小美', '👧', 'female', 14066319, 640, 340,
     'cô gái trẻ đang ngồi uống trà một mình, sinh viên, thân thiện và hay hỏi chuyện làm quen',
     'giúp người chơi luyện giới thiệu bản thân, hỏi tên/tuổi/quê quán, làm quen bạn mới',
     '你好呀!你也是来喝茶的吗?', 'Nǐ hǎo ya! Nǐ yě shì lái hē chá de ma?', 'Chào bạn! Bạn cũng đến uống trà à?',
     'published');
end $$;
