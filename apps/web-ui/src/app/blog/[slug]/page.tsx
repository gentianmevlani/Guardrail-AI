import CodeBlock from "@/components/mdx/CodeBlock";
import { getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/blog";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Linkedin,
  Share2,
  Tag,
  Twitter,
  User,
} from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import { notFound } from "next/navigation";

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: BlogPostPageProps) {
  const post = await getPostBySlug(params.slug);

  if (!post) {
    return {
      title: "Post not found",
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      images: post.heroImage ? [post.heroImage] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: post.heroImage ? [post.heroImage] : [],
    },
  };
}

const mdxComponents = {
  code: ({ children, ...props }: any) => {
    // Extract code from children if it's a string
    const code = typeof children === "string" ? children : "";
    return <CodeBlock code={code} {...props} />;
  },
};

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = await getPostBySlug(params.slug);
  const relatedPosts = post ? await getRelatedPosts(post) : [];

  if (!post) {
    notFound();
  }

  const shareUrl = `https://getguardrail.io/blog/${post.slug}`;
  const shareText = `${post.title} - ${post.excerpt}`;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/blog"
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Blog</span>
            </Link>
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Guardrail
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {post.heroImage && (
        <section className="relative h-64 md:h-96 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-10" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.heroImage}
            alt={post.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 z-20 px-4 sm:px-6 lg:px-8 py-8">
            <div className="container mx-auto max-w-4xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-sm">
                  {post.category}
                </span>
                <span className="text-white/40">•</span>
                <span className="text-white/60 text-sm">{post.readTime}</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
                {post.title}
              </h1>
              <p className="text-lg text-white/80 max-w-2xl">{post.excerpt}</p>
            </div>
          </div>
        </section>
      )}

      {/* Article Content */}
      <article className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="container mx-auto max-w-4xl">
          {/* Article Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/60 mb-8 pb-8 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <time dateTime={post.date}>
                {new Date(post.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{post.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{post.readTime}</span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-8">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog?tag=${tag}`}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-full text-sm transition-colors flex items-center gap-1"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </Link>
            ))}
          </div>

          {/* Article Body */}
          <div className="prose prose-invert prose-lg max-w-none">
            <MDXRemote source={post.content} components={mdxComponents} />
          </div>

          {/* Share Buttons */}
          <div className="mt-12 pt-8 border-t border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Share this post
            </h3>
            <div className="flex flex-wrap gap-3">
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg hover:bg-sky-500/30 transition-colors"
              >
                <Twitter className="w-4 h-4" />
                Twitter
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors"
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </a>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white/70 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </a>
            </div>
          </div>
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 py-16 border-t border-gray-800">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold text-white mb-8">
              Related Posts
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.slug}
                  href={`/blog/${relatedPost.slug}`}
                  className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs">
                      {relatedPost.category}
                    </span>
                    <span className="text-xs text-white/40">•</span>
                    <span className="text-xs text-white/60">
                      {relatedPost.readTime}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                    {relatedPost.title}
                  </h3>
                  <p className="text-white/70 text-sm line-clamp-3">
                    {relatedPost.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Author Bio */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 border-t border-gray-800">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {post.author}
                </h3>
                <p className="text-white/70 mb-4">
                  {post.author === "Guardrail Team" &&
                    "The Guardrail Team is building the future of AI-powered development with safety guardrails. We're passionate about helping teams ship faster while maintaining code quality and security."}
                  {post.author === "Engineering Team" &&
                    "Our engineering team brings deep expertise in security, AI, and developer tools. We're focused on solving the real-world challenges of AI-generated code in production."}
                  {post.author === "Product Team" &&
                    "The product team works closely with developers to understand their needs and build tools that make AI-powered development safer and more productive."}
                  {post.author === "DevOps Team" &&
                    "Our DevOps team specializes in CI/CD, deployment automation, and infrastructure. We help teams integrate Guardrail seamlessly into their existing workflows."}
                  {post.author === "Security Team" &&
                    "The security team brings years of experience in application security, compliance, and vulnerability assessment. We're dedicated to making AI-generated code secure."}
                  {post.author === "Developer Relations" &&
                    "Our developer relations team connects with the community, creates educational content, and helps developers get the most out of Guardrail's features."}
                </p>
                <div className="flex items-center gap-4">
                  <Link
                    href="/blog"
                    className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    View all posts
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-4 sm:px-6 lg:px-8 py-8">
        <div className="container mx-auto max-w-7xl text-center text-white/50 text-sm">
          © {new Date().getFullYear()} Guardrail. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
