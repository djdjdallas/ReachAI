import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllSlugs, getPostBySlug, getAllPosts } from "@/lib/posts";
import CTABanner from "@/components/CTABanner";
import BlogCard from "@/components/BlogCard";
import JsonLd from "@/components/JsonLd";

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: `${post.frontmatter.title} — Clinchd Blog`,
    description: post.frontmatter.description,
    openGraph: {
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      url: `https://clinchd.io/blog/${slug}`,
      siteName: "Clinchd",
      type: "article",
      publishedTime: post.frontmatter.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.frontmatter.title,
      description: post.frontmatter.description,
    },
  };
}

function mdxComponents() {
  return {
    h1: (props) => <h1 className="text-3xl md:text-4xl font-black text-stone-900 mt-12 mb-4" {...props} />,
    h2: (props) => <h2 className="text-2xl md:text-3xl font-extrabold text-stone-900 mt-10 mb-4" {...props} />,
    h3: (props) => <h3 className="text-xl font-extrabold text-stone-900 mt-8 mb-3" {...props} />,
    p: (props) => <p className="text-stone-600 leading-relaxed mb-4" {...props} />,
    ul: (props) => <ul className="list-disc pl-6 mb-4 space-y-2 text-stone-600" {...props} />,
    ol: (props) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-stone-600" {...props} />,
    li: (props) => <li className="leading-relaxed" {...props} />,
    strong: (props) => <strong className="font-bold text-stone-900" {...props} />,
    blockquote: (props) => (
      <blockquote className="border-l-4 border-[#ff7e67] pl-6 py-2 my-6 italic text-stone-500 bg-[#fff5f2]/50 rounded-r-xl pr-6" {...props} />
    ),
    a: (props) => <a className="text-[#ff7e67] font-semibold hover:underline" {...props} />,
    table: (props) => (
      <div className="overflow-x-auto my-6">
        <table className="w-full border-collapse text-sm" {...props} />
      </div>
    ),
    th: (props) => <th className="text-left py-3 px-4 bg-stone-50 font-bold text-stone-900 border-b border-stone-200" {...props} />,
    td: (props) => <td className="py-3 px-4 text-stone-600 border-b border-stone-100" {...props} />,
    hr: () => <hr className="my-8 border-stone-200" />,
  };
}

export default async function BlogPost({ params }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { frontmatter, content } = post;
  const allPosts = getAllPosts();
  const relatedPosts = allPosts
    .filter((p) => p.slug !== slug)
    .slice(0, 3);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: frontmatter.title,
    description: frontmatter.description,
    datePublished: frontmatter.date,
    dateModified: frontmatter.date,
    author: {
      "@type": "Organization",
      name: "Clinchd",
      url: "https://clinchd.io",
    },
    publisher: {
      "@type": "Organization",
      name: "Clinchd",
      url: "https://clinchd.io",
    },
    mainEntityOfPage: `https://clinchd.io/blog/${slug}`,
  };

  return (
    <>
      <JsonLd data={articleSchema} />

      {/* Header */}
      <section className="pt-20 pb-8 md:pt-32 md:pb-12 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <Link
              href="/blog"
              className="text-sm font-bold text-[#ff7e67] hover:underline"
            >
              &larr; Back to Blog
            </Link>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center rounded-full bg-[#fff5f2] px-3 py-1 text-xs font-bold text-[#ff7e67]">
              {frontmatter.category}
            </span>
            <span className="text-xs text-stone-400 font-medium">
              {frontmatter.readTime}
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-stone-900 mb-4 leading-[1.1]">
            {frontmatter.title}
          </h1>
          <p className="text-lg text-stone-500 font-medium mb-6">
            {frontmatter.description}
          </p>
          <div className="flex items-center gap-4 text-sm text-stone-400 font-medium border-b border-stone-100 pb-8">
            <span>By Clinchd Team</span>
            <span>&middot;</span>
            <time>
              {new Date(frontmatter.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-8 bg-white">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 prose-stone">
          <MDXRemote source={content} components={mdxComponents()} />
        </article>
      </section>

      {/* CTA */}
      <section className="py-12 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <CTABanner
            headline="Ready to automate your Instagram DMs?"
            subheadline="Start your 7-day free trial. No credit card required. Set up in under 30 minutes."
            buttonText="Start Free Trial"
            buttonHref="/signup"
            variant="light"
          />
        </div>
      </section>

      {/* Related posts */}
      {relatedPosts.length > 0 && (
        <section className="py-16 bg-[#fafaf9]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-stone-900 mb-8">
              Related articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relatedPosts.map((p) => (
                <BlogCard key={p.slug} {...p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
