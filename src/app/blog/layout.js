import Navbar from "@/components/landing/navbar";
import Footer from "@/components/landing/footer";

export const metadata = {
  title: "Instagram DM Strategy for Coaches — Clinchd Blog",
  description:
    "Guides and strategies for coaches to automate Instagram DMs, book more discovery calls, and turn followers into clients.",
  openGraph: {
    title: "Instagram DM Strategy for Coaches — Clinchd Blog",
    description:
      "Guides and strategies for coaches to automate Instagram DMs, book more discovery calls, and turn followers into clients.",
    url: "https://www.clinchd.io/blog",
    siteName: "Clinchd",
    type: "website",
  },
};

export default function BlogLayout({ children }) {
  return (
    <div className="landing-theme min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
