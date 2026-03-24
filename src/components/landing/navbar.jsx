"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, ChevronDown, Menu, X } from "lucide-react";

const compareLinks = [
  { href: "/compare/vs-manychat", label: "vs ManyChat" },
  { href: "/compare/vs-gohighlevel", label: "vs GoHighLevel" },
  { href: "/compare/vs-setter-ai", label: "vs Setter AI" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#ff7e67] rounded-xl flex items-center justify-center shadow-lg shadow-[#ff7e67]/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-stone-900">Clinchd</span>
          </Link>

          <div className="hidden md:flex items-center gap-10 text-[15px] font-medium text-stone-500">
            <a href="/#how-it-works" className="hover:text-[#ff7e67] transition-colors">How it Works</a>
            <a href="/#pricing" className="hover:text-[#ff7e67] transition-colors">Pricing</a>

            {/* Compare dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setCompareOpen(true)}
              onMouseLeave={() => setCompareOpen(false)}
            >
              <button className="flex items-center gap-1 hover:text-[#ff7e67] transition-colors">
                Compare
                <ChevronDown className={`w-4 h-4 transition-transform ${compareOpen ? "rotate-180" : ""}`} />
              </button>
              {compareOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2">
                  <div className="bg-white rounded-2xl border border-stone-100 shadow-xl p-2 min-w-[200px]">
                    {compareLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block px-4 py-2.5 text-sm font-semibold text-stone-600 hover:text-[#ff7e67] hover:bg-[#fff5f2] rounded-xl transition-colors"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link href="/blog" className="hover:text-[#ff7e67] transition-colors">Blog</Link>
            <a href="#testimonials" className="hover:text-[#ff7e67] transition-colors">Testimonials</a>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="hidden sm:block text-[15px] font-semibold text-stone-900 hover:text-[#ff7e67] transition-colors"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="hidden sm:block bg-stone-900 text-white px-6 py-3 rounded-full text-sm font-bold hover:bg-[#ff7e67] hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              Start Free Trial
            </Link>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-stone-900"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-stone-100 px-4 py-6 space-y-1">
          <a href="/#how-it-works" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-semibold text-stone-700 hover:text-[#ff7e67] hover:bg-[#fff5f2] rounded-xl transition-colors">How it Works</a>
          <a href="/#pricing" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-semibold text-stone-700 hover:text-[#ff7e67] hover:bg-[#fff5f2] rounded-xl transition-colors">Pricing</a>
          <div className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-stone-400">Compare</div>
          {compareLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block px-6 py-2.5 text-sm font-semibold text-stone-600 hover:text-[#ff7e67] hover:bg-[#fff5f2] rounded-xl transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/blog" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-semibold text-stone-700 hover:text-[#ff7e67] hover:bg-[#fff5f2] rounded-xl transition-colors">Blog</Link>
          <a href="#testimonials" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-semibold text-stone-700 hover:text-[#ff7e67] hover:bg-[#fff5f2] rounded-xl transition-colors">Testimonials</a>
          <div className="pt-4 space-y-3 px-4">
            <Link href="/login" className="block text-center py-3 text-sm font-bold text-stone-900 border border-stone-200 rounded-full hover:border-stone-900 transition-colors">Login</Link>
            <Link href="/signup" className="block text-center py-3 text-sm font-bold text-white bg-[#ff7e67] rounded-full shadow-lg shadow-[#ff7e67]/20">Start Free Trial</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
