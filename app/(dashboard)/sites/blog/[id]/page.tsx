import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BlogEditor } from "./blog-editor";

export default async function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  let post = null;
  try {
    post = await prisma.blogPost.findFirst({
      where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
    });
  } catch {}

  if (!post) {
    return (
      <div className="space-y-4">
        <Link href="/sites?tab=blog" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
          <ArrowLeft size={14} /> Back to Blog
        </Link>
        <p className="text-muted">Post not found.</p>
      </div>
    );
  }

  return (
    <BlogEditor
      postId={post.id}
      initialTitle={post.title}
      initialContent={post.content ?? ""}
      initialExcerpt={post.excerpt ?? ""}
      initialStatus={post.status}
      initialCategory={post.category ?? ""}
      initialTags={post.tags}
      initialSeoTitle={post.seoTitle ?? ""}
      initialSeoDesc={post.seoDesc ?? ""}
      initialAuthor={post.author ?? ""}
      slug={post.slug}
      createdAt={post.createdAt.toISOString()}
      publishedAt={post.publishedAt?.toISOString() ?? null}
    />
  );
}
