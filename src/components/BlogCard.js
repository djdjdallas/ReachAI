import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function BlogCard({ title, description, date, slug, category, readTime }) {
  return (
    <article className="bg-white rounded-2xl border border-stone-100 p-8 hover:shadow-lg hover:border-stone-200 transition-all group">
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center rounded-full bg-[#fff5f2] px-3 py-1 text-xs font-bold text-[#ff7e67]">
          {category}
        </span>
        <span className="text-xs text-stone-400 font-medium">{readTime}</span>
      </div>

      <h3 className="text-xl font-extrabold text-stone-900 mb-3 leading-tight group-hover:text-[#ff7e67] transition-colors">
        <Link href={`/blog/${slug}`}>{title}</Link>
      </h3>

      <p className="text-sm text-stone-500 leading-relaxed mb-6 line-clamp-3">
        {description}
      </p>

      <div className="flex items-center justify-between">
        <time className="text-xs text-stone-400 font-medium">
          {new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        <Link
          href={`/blog/${slug}`}
          className="inline-flex items-center gap-1 text-sm font-bold text-[#ff7e67] group-hover:gap-2 transition-all"
        >
          Read more
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}
