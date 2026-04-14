"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/update-password`;
      const { error: supaErr } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      );

      if (supaErr) {
        setError(supaErr.message);
        return;
      }

      setSent(true);
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: "#fafaf9",
        backgroundImage:
          "radial-gradient(at 0% 0%, rgba(255, 126, 103, 0.05) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(255, 126, 103, 0.05) 0px, transparent 50%)",
      }}
    >
      <header className="w-full max-w-7xl mx-auto px-6 sm:px-8 h-24 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Clinchd logo"
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <span className="text-xl font-extrabold tracking-tight">Clinchd</span>
        </Link>
        <Link
          href="/login"
          className="px-5 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-bold hover:bg-stone-50 transition-all shadow-sm"
        >
          Back to login
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 soft-shadow border border-stone-100">
            {sent ? (
              <div className="text-center space-y-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black">Check your inbox</h2>
                  <p className="text-sm text-stone-500 font-medium">
                    If an account exists for <strong>{email}</strong>, we sent a
                    link to reset your password.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm font-black text-[#ff7e67] hover:underline uppercase tracking-widest"
                >
                  Return to login
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-8 text-center">
                  <h2 className="text-3xl font-black mb-2">Reset password</h2>
                  <p className="text-sm text-stone-500 font-medium">
                    Enter the email on your account and we&apos;ll send you a
                    reset link.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="text-[11px] font-black text-stone-400 uppercase tracking-widest px-1 block"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 w-5 h-5" />
                      <input
                        id="email"
                        type="email"
                        placeholder="alex@clinchd.io"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        className="w-full pl-12 pr-5 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-medium transition-all focus:outline-none focus:border-[#ff7e67] focus:ring-4 focus:ring-[#fff5f2]"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl p-3">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 bg-[#ff7e67] text-white rounded-2xl text-lg font-black shadow-xl shadow-[#ff7e67]/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:hover:scale-100"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Send reset link
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-sm font-medium text-stone-400">
                    Remembered it?
                    <Link
                      href="/login"
                      className="text-[#ff7e67] font-black uppercase tracking-widest text-[11px] ml-2 hover:underline"
                    >
                      Sign In
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
