import { CalendarDays, Plus, Share2, Trash2 } from "lucide-react";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSocialPost, deleteSocialPost } from "./actions";

const createSocialPostAction = createSocialPost as (formData: FormData) => Promise<void>;
const deleteSocialPostAction = deleteSocialPost as (formData: FormData) => Promise<void>;

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
};

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

export default async function SocialPlannerPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let posts: Awaited<ReturnType<typeof prisma.socialPost.findMany>> = [];

  try {
    posts = await prisma.socialPost.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { scheduledAt: "desc" },
    });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Social planner page database query failed", error);
  }

  const draftCount = posts.filter((p) => p.status === "draft").length;
  const scheduledCount = posts.filter((p) => p.status === "scheduled").length;
  const publishedCount = posts.filter((p) => p.status === "published").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Social Planner</h1>
        <p className="mt-1 text-sm text-muted">
          Schedule and publish content across Facebook, Instagram, Twitter/X, and LinkedIn.
        </p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}

      {posts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-lg border border-border bg-panel p-4 shadow-soft">
            <div className="text-sm text-muted">Draft</div>
            <div className="mt-1 text-2xl font-semibold">{draftCount}</div>
          </article>
          <article className="rounded-lg border border-border bg-panel p-4 shadow-soft">
            <div className="text-sm text-muted">Scheduled</div>
            <div className="mt-1 text-2xl font-semibold">{scheduledCount}</div>
          </article>
          <article className="rounded-lg border border-border bg-panel p-4 shadow-soft">
            <div className="text-sm text-muted">Published</div>
            <div className="mt-1 text-2xl font-semibold">{publishedCount}</div>
          </article>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Share2 className="text-primary" size={18} />
              <h2 className="font-semibold">Posts</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {posts.length}
              </span>
            </div>
          </CardHeader>
          <CardBody>
            {posts.length > 0 ? (
              <div className="divide-y divide-border">
                {posts.map((post) => (
                  <div className="flex items-start justify-between gap-4 py-3" key={post.id}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{truncate(post.content, 120)}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {post.platforms.map((platform) => (
                          <Badge key={platform} variant="info">
                            {PLATFORM_LABELS[platform] ?? platform}
                          </Badge>
                        ))}
                        <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
                        {post.scheduledAt ? (
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <CalendarDays size={11} />
                            {new Date(post.scheduledAt).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <form action={deleteSocialPostAction} className="shrink-0">
                      <input type="hidden" name="id" value={post.id} />
                      <SubmitButton
                        className="rounded p-1 text-muted hover:bg-background hover:text-danger"
                        pendingText="…"
                        title="Delete post"
                      >
                        <Trash2 size={14} />
                      </SubmitButton>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Share2 className="mx-auto mb-4 text-muted" size={32} />
                <p className="font-medium">No posts yet</p>
                <p className="mt-1 text-sm text-muted">
                  Create your first post to start building your social content calendar.
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="text-primary" size={18} />
                <h2 className="font-semibold">New Post</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={createSocialPostAction} className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Content
                  </span>
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    name="content"
                    placeholder="What would you like to share?"
                    required
                    rows={5}
                  />
                </label>

                <fieldset>
                  <legend className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Platforms
                  </legend>
                  <div className="space-y-1.5">
                    {[
                      { value: "facebook", label: "Facebook" },
                      { value: "instagram", label: "Instagram" },
                      { value: "twitter", label: "Twitter/X" },
                      { value: "linkedin", label: "LinkedIn" },
                    ].map(({ value, label }) => (
                      <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          className="rounded border-border"
                          name="platforms"
                          type="checkbox"
                          value={value}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Schedule for (optional)
                  </span>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    name="scheduledAt"
                    type="datetime-local"
                  />
                </label>

                <SubmitButton
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"
                  pendingText="Creating…"
                >
                  Create post
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
