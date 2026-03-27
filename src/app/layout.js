import localFont from "next/font/local";
import "./globals.css";
import JsonLd from "@/components/JsonLd";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata = {
  title: {
    default: "Clinchd — AI Instagram DM Automation for Coaches",
    template: "%s | Clinchd",
  },
  description:
    "Clinchd is the AI setter that qualifies leads, handles objections, and books discovery calls in your Instagram DMs — replacing your $5K/mo setter for just $97.",
  metadataBase: new URL("https://clinchd.io"),
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Clinchd",
  url: "https://clinchd.io",
  description:
    "AI-powered Instagram DM automation for coaches and course creators. Qualify leads, handle objections, and book discovery calls automatically.",
  publisher: {
    "@type": "Organization",
    name: "Clinchd",
    url: "https://clinchd.io",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <JsonLd data={websiteSchema} />
        {children}
      </body>
    </html>
  );
}
