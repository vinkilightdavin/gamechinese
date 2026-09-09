-- ==========================================================================
-- Migration 0002: gộp kiểm tra + tăng usage_daily thành 1 lệnh atomic phía DB.
-- Trước đây route /api/chat làm 2 round-trip riêng (SELECT rồi UPSERT) — vừa chậm (mỗi round-trip
-- tới Supabase tốn 150-300ms) vừa có race condition nhẹ (2 tin nhắn gửi cùng lúc có thể cùng đọc
-- được count cũ rồi cùng ghi đè, lọt quá hạn mức 1 tin). Hàm dưới đây làm cả 2 việc trong 1 câu lệnh.
-- Chạy thủ công trong Supabase Dashboard → SQL Editor.
-- ==========================================================================

create or replace function public.increment_usage(p_user_id uuid, p_max integer)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.usage_daily (user_id, usage_date, message_count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set message_count = usage_daily.message_count + 1
  returning message_count into v_count;

  if v_count > p_max then
    -- Đã vượt hạn mức — lùi lại số đếm vừa tăng để không tính tin nhắn bị từ chối này vào ngày mai.
    update public.usage_daily set message_count = message_count - 1
      where user_id = p_user_id and usage_date = current_date;
    raise exception 'USAGE_LIMIT_EXCEEDED';
  end if;

  return v_count;
end;
$$;

grant execute on function public.increment_usage(uuid, integer) to authenticated;
