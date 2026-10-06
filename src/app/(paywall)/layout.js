import Image from "next/image";
import Link from "next/link";
import { maybeSendSignupAlert } from "@/lib/alerts/signup-alert";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";
import SignOutLink from "./SignOutLink";

export const dynamic = "force-dynamic";

// Focused shell for plan selection: no sidebar, no dashboard header. Every
// new signup lands here before Checkout (card-required trial), as does
// anyone whose access has ended. Only sign-out and support are offered.
export default async function PaywallLayout({ children }) {
  // New signups pass through here first, so the founder alert fires here.
  await maybeSendSignupAlert();

  return (
    <div className="min-h-screen flex flex-col bg-[#fafaf9] text-stone-900">
      <header className="w-full max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Clinchd logo" width={28} height={28} />
          <span className="font-black text-lg tracking-tight">Clinchd</span>
        </Link>
        <SignOutLink />
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 pb-16">{children}</main>
      <footer className="w-full py-8 text-center text-sm text-stone-500">
        Questions? Email{" "}
        <a href={SUPPORT_MAILTO} className="font-bold text-stone-800 underline">
          {SUPPORT_EMAIL}
        </a>
        . I reply within 24 hours.
      </footer>
    </div>
  );
}
