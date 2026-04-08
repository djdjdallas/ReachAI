"use client";

import {
  Zap,
  Instagram,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Database,
  CheckCircle2,
  XCircle,
  MessageSquareText,
  ArrowRight,
} from "lucide-react";

export default function Step1Connect({ instagramConnected, onSkip }) {
  return (
    <div className="flex-1 flex flex-col items-center pt-12 pb-24 px-4">
      <div className="w-full max-w-5xl space-y-12">
        <div className="grid lg:grid-cols-12 gap-12">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-10">
            <div className="space-y-4">
              <h1 className="text-5xl font-extrabold text-stone-900 leading-[1.1]">
                Connect Your{" "}
                <span className="text-[#ff7e67]">Instagram</span> Account
              </h1>
              <p className="text-xl text-stone-500 font-medium leading-relaxed">
                Clinchd uses the official Meta Graph API to securely handle your
                DMs. Setup takes less than 60 seconds and no passwords are
                shared.
              </p>
            </div>

            <div className="bg-white rounded-[2.5rem] p-10 soft-shadow border border-stone-100 space-y-8">
              <div className="space-y-6">
                <div className="flex items-start gap-5">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                    <Instagram className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900">
                      1. Log in to Instagram
                    </h4>
                    <p className="text-sm text-stone-500">
                      Connect via the secure Meta portal.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-5">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                    <Instagram className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900">
                      2. Select Business Profile
                    </h4>
                    <p className="text-sm text-stone-500">
                      Choose the handle you want Clinchd to manage.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-5">
                  <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900">
                      3. Grant DM Permissions
                    </h4>
                    <p className="text-sm text-stone-500">
                      Allow Clinchd to read and reply to messages.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <a
                  href="/api/auth/instagram"
                  className="w-full py-5 bg-[#ff7e67] text-white rounded-[1.25rem] text-xl font-black shadow-2xl shadow-[#ff7e67]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                  </svg>
                  Connect with Meta
                </a>
                <p className="text-center mt-4 text-xs font-bold text-stone-400 uppercase tracking-widest">
                  Redirects to Meta secure login
                </p>
              </div>
            </div>

            {/* Transparency Checklist */}
            <div className="bg-stone-100/50 rounded-3xl p-8 border border-stone-200/50">
              <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest mb-6">
                Transparency Checklist
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-xs font-bold text-green-600 uppercase tracking-tight">
                    Clinchd Can:
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-stone-600 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Read incoming DMs
                    </li>
                    <li className="flex items-center gap-2 text-sm text-stone-600 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Send replies in your voice
                    </li>
                    <li className="flex items-center gap-2 text-sm text-stone-600 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      View follower counts
                    </li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-bold text-red-500 uppercase tracking-tight">
                    Clinchd Cannot:
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-stone-600 font-medium">
                      <XCircle className="w-4 h-4 text-red-400" />
                      See your password
                    </li>
                    <li className="flex items-center gap-2 text-sm text-stone-600 font-medium">
                      <XCircle className="w-4 h-4 text-red-400" />
                      Post to your grid
                    </li>
                    <li className="flex items-center gap-2 text-sm text-stone-600 font-medium">
                      <XCircle className="w-4 h-4 text-red-400" />
                      Access payment info
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Skip button */}
            <button
              onClick={onSkip}
              className="text-sm font-bold text-stone-400 hover:text-stone-900 transition-colors flex items-center gap-2"
            >
              Skip for now
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-white rounded-[2rem] p-8 soft-shadow border border-stone-100 space-y-8">
              <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold">Official Meta Partner</p>
                  <p className="text-xs text-stone-500 font-medium">
                    Verified Graph API Connection
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-green-500 shadow-sm">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold">No Passwords Stored</p>
                  <p className="text-xs text-stone-500 font-medium">
                    Clinchd never sees your login data
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-[#ff7e67] shadow-sm">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold">Encrypted Data</p>
                  <p className="text-xs text-stone-500 font-medium">
                    256-bit AES end-to-end security
                  </p>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=A" alt="" className="w-8 h-8 rounded-full border-2 border-white bg-stone-100" />
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=B" alt="" className="w-8 h-8 rounded-full border-2 border-white bg-stone-100" />
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=C" alt="" className="w-8 h-8 rounded-full border-2 border-white bg-stone-100" />
                  </div>
                  <span className="text-xs font-bold text-stone-500">
                    Trusted by 100+ creators
                  </span>
                </div>

                <div className="p-6 bg-[#fff5f2] rounded-3xl border border-[#ff7e67]/10 relative">
                  <p className="text-sm text-stone-700 italic leading-relaxed mb-4">
                    &ldquo;Setup was seamless. I was nervous about permissions,
                    but seeing the official Meta login put me at ease. Best
                    decision for my biz.&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white" />
                    <div className="text-xs">
                      <p className="font-black">Sarah Julian</p>
                      <p className="text-stone-400 font-bold">
                        Sales Coach, 12k Followers
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 text-center">
              <h4 className="text-[11px] font-black text-stone-400 uppercase tracking-widest mb-4">
                Need Help?
              </h4>
              <button className="text-sm font-bold text-stone-500 hover:text-[#ff7e67] transition-colors flex items-center gap-2 mx-auto">
                <MessageSquareText className="w-4 h-4" />
                Chat with a human
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
