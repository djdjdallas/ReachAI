"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);

  // Supabase exchanges the recovery token in the URL fragment via the SSR
  // client on mount. We wait until the session is established before
  // allowing the password update.
  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Also check existing session in case the event already fired.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: supaErr } = await supabase.auth.updateUser({ password });
      if (supaErr) {
        setError(supaErr.message);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/login?reset=success"), 1200);
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
      <header className="w-full max-w-7xl mx-auto px-6 sm:px-8 h-24 flex items-center">
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
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 soft-shadow border border-stone-100">
            {success ? (
              <div className="text-center space-y-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-3xl font-black">Password updated</h2>
                <p className="text-sm text-stone-500 font-medium">
                  Redirecting you to login…
                </p>
              </div>
            ) : (
              <>
                <div className="mb-8 text-center">
                  <h2 className="text-3xl font-black mb-2">
                    Set a new password
                  </h2>
                  <p className="text-sm text-stone-500 font-medium">
                    Choose a password of at least 8 characters.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="password"
                      className="text-[11px] font-black text-stone-400 uppercase tracking-widest px-1 block"
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 w-5 h-5" />
                      <input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading || !ready}
                        minLength={8}
                        className="w-full pl-12 pr-5 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-medium transition-all focus:outline-none focus:border-[#ff7e67] focus:ring-4 focus:ring-[#fff5f2]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="confirm"
                      className="text-[11px] font-black text-stone-400 uppercase tracking-widest px-1 block"
                    >
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 w-5 h-5" />
                      <input
                        id="confirm"
                        type="password"
                        placeholder="••••••••"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        disabled={loading || !ready}
                        minLength={8}
                        className="w-full pl-12 pr-5 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-medium transition-all focus:outline-none focus:border-[#ff7e67] focus:ring-4 focus:ring-[#fff5f2]"
                      />
                    </div>
                  </div>

                  {!ready && (
                    <div className="text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-2xl p-3 text-center">
                      Verifying reset link…
                    </div>
                  )}

                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl p-3">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !ready}
                    className="w-full py-5 bg-[#ff7e67] text-white rounded-2xl text-lg font-black shadow-xl shadow-[#ff7e67]/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:hover:scale-100"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Update password
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
