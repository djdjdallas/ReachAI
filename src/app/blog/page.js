"use client";

import { useState, useEffect } from "react";
import BlogCard from "@/components/BlogCard";

const categories = ["All", "Automation", "Scripts & Templates", "Strategy", "Tools & Reviews"];

// Static post data — avoids needing server-side fs reads in client component
const allPosts = [
  {
    slug: "instagram-dm-strategy-for-coaches",
    title: "The Complete Instagram DM Strategy for Coaches in 2026",
    description: "A complete Instagram DM strategy for coaches in 2026 — from content triggers through booking. How to turn your Instagram into a consistent lead generation machine.",
    date: "2026-02-05",
    category: "Strategy",
    readTime: "11 min read",
  },
  {
    slug: "ai-instagram-dm-bot-for-coaches",
    title: "AI Instagram DM Bots for Coaches in 2026: What Works, What Doesn't, and What to Use",
    description: "An honest review of AI Instagram DM bots for coaches in 2026. What the technology can and can't do, which tools are worth it, and how to deploy AI in your DMs without losing authenticity.",
    date: "2026-02-10",
    category: "Tools & Reviews",
    readTime: "8 min read",
  },
  {
    slug: "instagram-dm-scripts-for-coaches",
    title: "10 Instagram DM Scripts for Coaches in 2026 (Copy & Paste Templates)",
    description: "Proven Instagram DM scripts for coaches to qualify leads, handle objections, and book discovery calls. Copy-paste templates for 2026.",
    date: "2026-02-01",
    category: "Scripts & Templates",
    readTime: "7 min read",
  },
  {
    slug: "how-to-book-more-discovery-calls-from-instagram",
    title: "How to Book More Discovery Calls From Instagram in 2026 (Without Spending All Day in DMs)",
    description: "Proven strategies for coaches to convert Instagram followers into booked discovery calls in 2026. Includes DM scripts, automation tips, and conversion benchmarks.",
    date: "2026-01-25",
    category: "Strategy",
    readTime: "9 min read",
  },
  {
    slug: "how-to-automate-instagram-dms-coaching-business",
    title: "How to Automate Your Instagram DMs for Your Coaching Business (2026 Guide)",
    description: "Step-by-step guide to automating Instagram DMs for coaches in 2026. Save 10+ hours per week while booking more discovery calls on autopilot.",
    date: "2026-01-20",
    category: "Automation",
    readTime: "10 min read",
  },
  {
    slug: "manychat-alternative-for-coaches",
    title: "The Best ManyChat Alternative for Coaches in 2026",
    description: "Tired of ManyChat's per-contact pricing and rigid flows? Here are the best alternatives for coaches who want to automate Instagram DMs and book more discovery calls in 2026.",
    date: "2026-01-15",
    category: "Tools & Reviews",
    readTime: "8 min read",
  },
];

export default function BlogIndex() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered =
    activeCategory === "All"
      ? allPosts
      : allPosts.filter((p) => p.category === activeCategory);

  // Featured = most recent
  const featured = allPosts[0];
  const rest = filtered.filter((p) => p.slug !== featured.slug);

  return (
    <>
      {/* Hero */}
      <section className="pt-20 pb-12 md:pt-32 md:pb-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-4">
            Instagram DM Strategy for Coaches
          </h1>
          <p className="text-lg text-stone-500 font-medium max-w-2xl mx-auto">
            Guides, scripts, and strategies to turn your Instagram DMs into a sales machine.
          </p>
        </div>
      </section>

      {/* Category pills */}
      <section className="pb-8 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  activeCategory === cat
                    ? "bg-[#ff7e67] text-white shadow-md shadow-[#ff7e67]/20"
                    : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured post */}
      {activeCategory === "All" && (
        <section className="pb-8 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-[#fff5f2] rounded-[2rem] border border-[#ff7e67]/10 p-8 md:p-12">
              <span className="inline-flex items-center rounded-full bg-[#ff7e67] px-3 py-1 text-xs font-bold text-white mb-4">
                Featured
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-stone-900 mb-3">
                <a href={`/blog/${featured.slug}`} className="hover:text-[#ff7e67] transition-colors">
                  {featured.title}
                </a>
              </h2>
              <p className="text-stone-500 font-medium mb-4 max-w-2xl">
                {featured.description}
              </p>
              <div className="flex items-center gap-4 text-sm text-stone-400 font-medium">
                <span>{featured.category}</span>
                <span>&middot;</span>
                <span>{featured.readTime}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Post grid */}
      <section className="py-12 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(activeCategory === "All" ? rest : filtered).map((post) => (
              <BlogCard key={post.slug} {...post} />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-stone-400 font-medium py-12">
              No posts in this category yet.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
