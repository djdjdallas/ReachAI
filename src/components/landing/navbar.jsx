import Link from "next/link";
import { Zap } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#ff7e67] rounded-xl flex items-center justify-center shadow-lg shadow-[#ff7e67]/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-stone-900">ReachAI</span>
          </Link>

          <div className="hidden md:flex items-center gap-10 text-[15px] font-medium text-stone-500">
            <a href="#how-it-works" className="hover:text-[#ff7e67] transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-[#ff7e67] transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-[#ff7e67] transition-colors">Testimonials</a>
            <a href="#faq" className="hover:text-[#ff7e67] transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="hidden sm:block text-[15px] font-semibold text-stone-900 hover:text-[#ff7e67] transition-colors"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="bg-stone-900 text-white px-6 py-3 rounded-full text-sm font-bold hover:bg-[#ff7e67] hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              Start Trial
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
