import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-white py-24 border-t border-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-16 mb-20">
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-8">
              <Image src="/logo.png" alt="Clinchd logo" width={36} height={36} className="w-9 h-9" />
              <span className="text-xl font-extrabold tracking-tight text-stone-900">
                Clinchd
              </span>
            </div>
            <p className="text-stone-400 text-lg font-medium max-w-xs leading-relaxed">
              The AI setter for coaches who sell high-ticket offers on Instagram.
            </p>
          </div>
          <div>
            <h5 className="font-black mb-8 uppercase tracking-widest text-[11px] text-stone-900">
              Product
            </h5>
            <ul className="space-y-5 text-[15px] font-bold text-stone-400">
              <li>
                <a href="/#features" className="hover:text-[#ff7e67] transition-colors">Features</a>
              </li>
              <li>
                <a href="/#pricing" className="hover:text-[#ff7e67] transition-colors">Pricing</a>
              </li>
              <li>
                <Link href="/signup" className="hover:text-[#ff7e67] transition-colors">Free Trial</Link>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="font-black mb-8 uppercase tracking-widest text-[11px] text-stone-900">
              Compare
            </h5>
            <ul className="space-y-5 text-[15px] font-bold text-stone-400">
              <li>
                <Link href="/compare/vs-manychat" className="hover:text-[#ff7e67] transition-colors">vs ManyChat</Link>
              </li>
              <li>
                <Link href="/compare/vs-inro" className="hover:text-[#ff7e67] transition-colors">vs Inro</Link>
              </li>
              <li>
                <Link href="/compare/vs-gohighlevel" className="hover:text-[#ff7e67] transition-colors">vs GoHighLevel</Link>
              </li>
              <li>
                <Link href="/compare/vs-setter-ai" className="hover:text-[#ff7e67] transition-colors">vs Setter AI</Link>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="font-black mb-8 uppercase tracking-widest text-[11px] text-stone-900">
              Resources
            </h5>
            <ul className="space-y-5 text-[15px] font-bold text-stone-400">
              <li>
                <Link href="/blog" className="hover:text-[#ff7e67] transition-colors">Blog</Link>
              </li>
              <li>
                <Link href="/blog/instagram-dm-scripts-for-coaches" className="hover:text-[#ff7e67] transition-colors">DM Scripts</Link>
              </li>
              <li>
                <a href="/#faq" className="hover:text-[#ff7e67] transition-colors">FAQ</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="pt-12 border-t border-stone-100 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6">
            <p className="text-stone-300 text-[13px] font-bold">
              &copy; {new Date().getFullYear()} Clinchd. Built for coaches.
            </p>
            <Link href="/privacy" className="text-stone-300 text-[13px] font-bold hover:text-[#ff7e67] transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-stone-300 text-[13px] font-bold hover:text-[#ff7e67] transition-colors">
              Terms
            </Link>
          </div>
          <div className="flex items-center gap-8 text-stone-300">
            <a href="#" className="hover:text-[#ff7e67] text-xl transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="#" className="hover:text-[#ff7e67] text-xl transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
