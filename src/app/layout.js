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
    default: "Clinchd — AI-Assisted Instagram DMs for Coaches",
    template: "%s | Clinchd",
  },
  description:
    "Clinchd is a shared Instagram inbox with AI-assisted replies — a virtual setter that qualifies leads, handles objections, and books discovery calls while you stay in control.",
  metadataBase: new URL("https://www.clinchd.io"),
  openGraph: {
    title: "Clinchd — AI-Assisted Instagram DMs for Coaches",
    description:
      "A shared Instagram inbox with AI-assisted replies that qualify leads and book discovery calls. You stay in control.",
    url: "https://www.clinchd.io",
    siteName: "Clinchd",
    type: "website",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: "Clinchd — AI-assisted Instagram DMs for coaches",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clinchd — AI-Assisted Instagram DMs for Coaches",
    description:
      "A shared Instagram inbox with AI-assisted replies that qualify leads and book discovery calls.",
    images: ["/og"],
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Clinchd",
  url: "https://www.clinchd.io",
  description:
    "AI-assisted Instagram DM conversations for coaches and course creators. Qualify leads, handle objections, and book discovery calls — with the owner in control of every reply.",
  publisher: {
    "@type": "Organization",
    name: "Clinchd",
    url: "https://www.clinchd.io",
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
