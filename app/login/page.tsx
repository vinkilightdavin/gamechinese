"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "@/lib/actions/auth";

export default function LoginPage() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signInPending] = useActionState(signIn, undefined);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1410] px-4">
      <div className="w-full max-w-sm bg-[#fdfaf3] rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-[#3a2b1a] mb-1">学中文</h1>
        <p className="text-sm text-[#8a7a63] mb-6">Game nhập vai học tiếng Trung</p>

        <div className="flex mb-6 rounded-lg bg-[#f0e6d2] p-1">
          <button
            type="button"
            onClick={() => setTab("signin")}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
              tab === "signin" ? "bg-white text-[#3a2b1a] shadow" : "text-[#8a7a63]"
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => setTab("signup")}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
              tab === "signup" ? "bg-white text-[#3a2b1a] shadow" : "text-[#8a7a63]"
            }`}
          >
            Đăng ký
          </button>
        </div>

        {tab === "signin" ? (
          <form action={signInAction} className="space-y-3">
            <Field name="email" type="email" placeholder="Email" />
            <Field name="password" type="password" placeholder="Mật khẩu" />
            {signInState?.error && <p className="text-sm text-red-600">{signInState.error}</p>}
            <SubmitButton pending={signInPending} label="Đăng nhập" />
          </form>
        ) : (
          <form action={signUpAction} className="space-y-3">
            <Field name="displayName" type="text" placeholder="Tên hiển thị" />
            <Field name="email" type="email" placeholder="Email" />
            <Field name="password" type="password" placeholder="Mật khẩu (ít nhất 6 ký tự)" />
            {signUpState?.error && <p className="text-sm text-red-600">{signUpState.error}</p>}
            <SubmitButton pending={signUpPending} label="Tạo tài khoản" />
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ name, type, placeholder }: { name: string; type: string; placeholder: string }) {
  return (
    <input
      name={name}
      type={type}
      placeholder={placeholder}
      required={name !== "displayName"}
      className="w-full px-3 py-2.5 rounded-lg border border-[#d8cdb8] text-sm focus:outline-none focus:border-[#b5651d]"
    />
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2.5 rounded-lg bg-[#b5651d] text-white text-sm font-semibold hover:bg-[#965014] disabled:opacity-60"
    >
      {pending ? "Đang xử lý..." : label}
    </button>
  );
}
