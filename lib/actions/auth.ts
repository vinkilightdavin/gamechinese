"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string } | undefined;

export async function signIn(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) return { error: "Nhập đủ email và mật khẩu." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Sai email hoặc mật khẩu." };

  redirect("/game");
}

export async function signUp(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const displayName = String(formData.get("displayName") || "").trim();

  if (!email || !password) return { error: "Nhập đủ email và mật khẩu." };
  if (password.length < 6) return { error: "Mật khẩu cần ít nhất 6 ký tự." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || null } },
  });
  if (error) return { error: error.message === "User already registered" ? "Email này đã có tài khoản." : "Không tạo được tài khoản: " + error.message };

  redirect("/game");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
