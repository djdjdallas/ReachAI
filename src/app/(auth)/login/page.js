"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  Mail,
  Lock,
  ArrowRight,
  Check,
  BarChart3,
  MessageSquareText,
  CalendarCheck,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import posthog from "posthog-js";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deletedNotice, setDeletedNotice] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("deleted") === "true") setDeletedNotice(true);
  }, []);

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      posthog.identify(email, { email });
      posthog.capture("user_logged_in", { method: "email" });
      router.push("/dashboard");
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
      {/* Header */}
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
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-stone-400 hidden sm:block">
            Don&apos;t have an account?
          </span>
          <Link
            href="/signup"
            className="px-5 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-bold hover:bg-stone-50 transition-all shadow-sm"
          >
            Create Account
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
          {/* Hero */}
          <div className="hidden lg:flex flex-col space-y-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-50 text-[#ff7e67] rounded-full text-xs font-black uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-[#ff7e67] rounded-full animate-pulse" />
                24/7 Sales Support
              </div>
              <h1 className="text-6xl font-black leading-[1.1] text-stone-900">
                Welcome back to <span className="text-[#ff7e67]">Clinchd</span>
              </h1>
              <p className="text-xl text-stone-500 font-medium leading-relaxed max-w-md">
                Log in to manage your AI sales agent and watch your high-ticket
                calls book themselves.
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-500 soft-shadow">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-lg text-stone-900">
                    Real-Time Analytics
                  </h4>
                  <p className="text-sm text-stone-500 leading-relaxed">
                    Monitor qualification rates and revenue generated in
                    real-time.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#ff7e67] soft-shadow">
                  <MessageSquareText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-lg text-stone-900">
                    Personalized Scripts
                  </h4>
                  <p className="text-sm text-stone-500 leading-relaxed">
                    Your unique voice, automated. Tweak your AI&apos;s
                    personality anytime.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-green-500 soft-shadow">
                  <CalendarCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-lg text-stone-900">
                    Calendly Integration
                  </h4>
                  <p className="text-sm text-stone-500 leading-relaxed">
                    Automatic booking for hot leads. No manual back-and-forth
                    needed.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  {["Felix", "Emma", "Jack"].map((seed) => (
                    <img
                      key={seed}
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
                      alt=""
                      className="w-10 h-10 rounded-full border-2 border-white bg-stone-100"
                    />
                  ))}
                </div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                  Trusted by <span className="text-stone-900">100+</span>{" "}
                  creators worldwide
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="w-full max-w-md mx-auto">
            <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 soft-shadow border border-stone-100">
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-black mb-2">Account Login</h2>
                <p className="text-sm text-stone-500 font-medium">
                  Enter your credentials to access your dashboard
                </p>
              </div>

              {deletedNotice && (
                <div className="mb-6 text-sm font-medium text-stone-700 bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-center">
                  Your account has been deleted.
                </div>
              )}

              <div className="space-y-4 mb-6">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full py-4 bg-white border border-stone-200 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-stone-50 transition-all shadow-sm"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </button>

                <div className="relative flex items-center justify-center py-2">
                  <div className="flex-grow border-t border-stone-100" />
                  <span className="mx-4 text-[10px] font-black text-stone-300 uppercase tracking-[0.2em]">
                    Or Email Login
                  </span>
                  <div className="flex-grow border-t border-stone-100" />
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label
                      htmlFor="password"
                      className="text-[11px] font-black text-stone-400 uppercase tracking-widest"
                    >
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 w-5 h-5" />
                    <input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full pl-12 pr-5 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-medium transition-all focus:outline-none focus:border-[#ff7e67] focus:ring-4 focus:ring-[#fff5f2]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 px-1">
                  <label className="relative flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <div className="w-5 h-5 bg-stone-100 border border-stone-200 rounded-md peer-checked:bg-[#ff7e67] peer-checked:border-[#ff7e67] transition-all flex items-center justify-center">
                      <Check className="text-white w-3 h-3 opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <span className="ml-3 text-sm font-medium text-stone-500">
                      Remember me
                    </span>
                  </label>
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
                      Login
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              {/* Mobile signup prompt */}
              <div className="mt-8 text-center lg:hidden">
                <p className="text-sm font-medium text-stone-400">
                  Don&apos;t have an account?
                  <Link
                    href="/signup"
                    className="text-[#ff7e67] font-black uppercase tracking-widest text-[11px] ml-2 hover:underline"
                  >
                    Sign Up Now
                  </Link>
                </p>
              </div>

              {/* Security badges */}
              <div className="mt-10 pt-8 border-t border-stone-100 flex justify-center gap-8 text-stone-400">
                <div className="flex flex-col items-center gap-1.5">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    Encrypted
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <Lock className="w-5 h-5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    Secure
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <UserCheck className="w-5 h-5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    Privacy
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-8 text-center text-xs font-bold text-stone-400 uppercase tracking-widest leading-relaxed px-4">
              Your data is protected with enterprise-grade AES-256 encryption
              &amp; official Meta Graph API protocols.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-stone-100">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">
            © {new Date().getFullYear()} Clinchd Inc.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/terms"
              className="text-xs font-bold text-stone-400 hover:text-stone-900 transition-colors uppercase tracking-widest"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-xs font-bold text-stone-400 hover:text-stone-900 transition-colors uppercase tracking-widest"
            >
              Privacy
            </Link>
            <Link
              href="/"
              className="text-xs font-bold text-stone-400 hover:text-stone-900 transition-colors uppercase tracking-widest"
            >
              Help Center
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
