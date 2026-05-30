import Link from "next/link";
import { ChevronRight, Newspaper, Plus } from "lucide-react";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── Inline server action ──────────────────────────────────────────────────────

async function createBlogPost(formData: FormData): Promise<void> {
  "use server";
  const user = await requireUser();
  if (!user.subAccountId) throw new Error("No sub-account context.");

  const CreateSchema = z.object({
    title: z.string().trim().min(2, "Title must be at least 2 characters"),
    slug: z
      .string()
      .trim()
      .min(2, "Slug must be at least 2 characters")
      .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
    category: z.string().trim().optional(),
  });

  const parsed = CreateSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    category: String(formData.get("category") ?? "") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Validation failed.");
  }

  const { title, slug, category } = parsed.data;

  await prisma.blogPost.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      title,
      slug,
      content: null,
      status: "draft",
      category: category ?? null,
    },
  });

  revalidatePath("/blog");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BlogPage() {
  const user = await requireUser();
  let posts: Awaited<ReturnType<typeof prisma.blogPost.findMany>> = [];
  let databaseUnavailable = false;

  try {
    posts = await prisma.blogPost.findMany({
      where: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    databaseUnavailable = true;
    console.error("Blog page query failed", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Blog</h1>
        <p className="mt-1 text-sm text-muted">Publish articles and content to your sites.</p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Posts list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Newspaper className="text-primary" size={17} />
              <h2 className="font-semibold">Posts</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {posts.length}
              </span>
            </div>
          </CardHeader>

          {posts.length === 0 && !databaseUnavailable ? (
            <CardBody>
              <div className="py-10 text-center">
                <Newspaper className="mx-auto mb-3 text-muted" size={32} />
                <p className="font-semibold">No posts yet</p>
                <p className="mt-1 text-sm text-muted">
                  Create your first blog post using the form on the right.
                </p>
              </div>
            </CardBody>
          ) : (
            <div className="divide-y divide-border">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-background/50 transition"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Newspaper size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{post.title}</span>
                      <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted">
                      <span>{post.category ?? "Uncategorized"}</span>
                      <span>{post.author ?? "—"}</span>
                      <span>
                        {post.publishedAt
                          ? post.publishedAt.toLocaleDateString()
                          : "Draft"}
                      </span>
                    </div>
                    {post.tags.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {post.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="muted" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                        {post.tags.length > 3 ? (
                          <span className="text-[10px] text-muted">
                            +{post.tags.length - 3} more
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <Link
                    href={`/sites/blog/${post.id}`}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                  >
                    Edit
                    <ChevronRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* New post form */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus size={16} className="text-primary" />
              <h2 className="font-semibold">New Post</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={createBlogPost} className="space-y-4">
              <Field label="Title" name="title" placeholder="My First Post" required />
              <Field
                label="Slug"
                name="slug"
                placeholder="my-first-post"
                required
              />
              <Field
                label="Category (optional)"
                name="category"
                placeholder="Marketing"
              />
              <SubmitButton
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                pendingText="Creating…"
              >
                Create Post
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
