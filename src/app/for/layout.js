import Navbar from "@/components/landing/navbar";
import Footer from "@/components/landing/footer";

export default function ForLayout({ children }) {
  return (
    <div className="landing-theme min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
