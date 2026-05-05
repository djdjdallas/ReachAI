export default function sitemap() {
  const baseUrl = "https://www.clinchd.io";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/forgot-password`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Tier 1 pillar pages
    {
      url: `${baseUrl}/ai-dm-setter`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/ai-dm-setter-for-coaches`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/instagram-dm-automation-for-coaches`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/instagram-lead-qualification`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/qualify-leads-on-instagram`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/book-discovery-calls-from-instagram`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    // Tier 5 FAQ snippet pages
    {
      url: `${baseUrl}/faq/what-is-an-ai-dm-setter`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/faq/how-much-does-a-human-dm-setter-cost`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/faq/can-ai-book-discovery-calls-from-instagram`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/faq/how-fast-should-you-respond-to-instagram-dms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // Tier 2 alternative comparison pages
    {
      url: `${baseUrl}/compare/setsmart-alternative`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/compare/inro-alternative`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/compare/chatplace-alternative`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/compare/tailortalk-alternative`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/compare/best-ai-dm-tool-for-coaches-2026`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    // Comparison pages
    {
      url: `${baseUrl}/compare/vs-manychat`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/compare/vs-setsmart`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/compare/vs-gohighlevel`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/compare/vs-setter-ai`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/compare/vs-inro`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    // Niche landing pages
    {
      url: `${baseUrl}/for/fitness-coaches`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for/business-coaches`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for/life-coaches`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for/relationship-coaches`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for/health-coaches`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for/mindset-coaches`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for/dating-coaches`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for/nutrition-coaches`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for/career-coaches`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for/online-course-creators`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for/wellness-coaches`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for/spiritual-coaches`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for/financial-coaches`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    // Legal
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    // Blog posts
    {
      url: `${baseUrl}/blog/best-manychat-alternative-for-coaches-2026`,
      lastModified: new Date("2026-04-03"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog/what-is-an-ai-dm-setter`,
      lastModified: new Date("2026-04-03"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog/ai-dm-automation-instagram-coaches`,
      lastModified: new Date("2026-04-03"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/best-manychat-alternative-instagram-dm-automation`,
      lastModified: new Date("2026-04-03"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/instagram-dm-automation-brand-voice`,
      lastModified: new Date("2026-04-03"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/instagram-dm-automation-coaches-2026`,
      lastModified: new Date("2026-04-03"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/instagram-dm-automation-vs-manual`,
      lastModified: new Date("2026-04-03"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/instagram-dm-strategy-for-coaches`,
      lastModified: new Date("2026-02-05"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/ai-instagram-dm-bot-for-coaches`,
      lastModified: new Date("2026-02-10"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/instagram-dm-scripts-for-coaches`,
      lastModified: new Date("2026-02-01"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/how-to-book-more-discovery-calls-from-instagram`,
      lastModified: new Date("2026-01-25"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/how-to-automate-instagram-dms-coaching-business`,
      lastModified: new Date("2026-01-20"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/manychat-alternative-for-coaches`,
      lastModified: new Date("2026-01-15"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // Tier 3 problem-aware blog posts
    {
      url: `${baseUrl}/blog/instagram-dm-templates-for-coaches`,
      lastModified: new Date("2026-05-04"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/how-to-handle-objections-in-instagram-dms`,
      lastModified: new Date("2026-05-04"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/how-to-qualify-leads-on-instagram-dms`,
      lastModified: new Date("2026-05-04"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/what-to-say-when-someone-dms-how-much`,
      lastModified: new Date("2026-05-04"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/does-instagram-allow-dm-automation`,
      lastModified: new Date("2026-05-04"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/how-to-convert-instagram-followers-to-clients`,
      lastModified: new Date("2026-05-04"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
