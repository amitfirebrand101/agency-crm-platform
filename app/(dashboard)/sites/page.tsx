import Link from "next/link";
import { BarChart2, BookOpen, ChevronRight, FileText, Globe, LayoutTemplate, MessageSquare, MousePointerClick, Plus, TrendingUp, Zap } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createFunnel, createForm, createSurvey, createBlogPost, deleteFunnel, deleteForm, deleteSurvey, deleteBlogPost } from "@/app/(dashboard)/sites/actions";
import { createSite } from "@/app/(dashboard)/sites/[siteId]/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type FunnelWithCounts = Prisma.FunnelGetPayload<{
  include: {
    _count: { select: { pages: true; submissions: true } };
    pages: { orderBy: { order: "asc" }; take: 3 };
  };
}>;

type FormWithCount = Prisma.SiteFormGetPayload<{
  include: { _count: { select: { submissions: true } } };
}>;

type SurveyWithCount = Prisma.SurveyGetPayload<{
  include: { _count: { select: { responses: true } } };
}>;

type SiteWithCount = Prisma.SiteGetPayload<{
  include: { _count: { select: { pages: true } } };
}>;

const TABS = [
  { key: "funnels",  label: "Funnels",  icon: LayoutTemplate },
  { key: "websites", label: "Websites", icon: Globe },
  { key: "forms",    label: "Forms",    icon: FileText },
  { key: "surveys",  label: "Surveys",  icon: BarChart2 },
  { key: "blog",     label: "Blog",     icon: BookOpen },
  { key: "chat",     label: "Chat Widget", icon: MessageSquare },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function SitesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const tab = (params.tab ?? "funnels") as TabKey;

  const user = await requireUser();
  let databaseUnavailable = false;

  let funnels: FunnelWithCounts[] = [];
  let websites: SiteWithCount[] = [];
  let forms: FormWithCount[] = [];
  let surveys: SurveyWithCount[] = [];
  let blogPosts: Prisma.BlogPostGetPayload<object>[] = [];

  try {
    const where = { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined };

    [funnels, websites, forms, surveys, blogPosts] = await Promise.all([
      prisma.funnel.findMany({
        where: { ...where, type: "funnel" },
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { pages: true, submissions: true } },
          pages: { orderBy: { order: "asc" }, take: 3 },
        },
      }),
      prisma.site.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { pages: true } },
        },
      }),
      prisma.siteForm.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { submissions: true } } },
      }),
      prisma.survey.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { responses: true } } },
      }),
      prisma.blogPost.findMany({ where, orderBy: { createdAt: "desc" } }),
    ]);
  } catch (err) {
    databaseUnavailable = true;
    console.error("Sites page query failed", err);
  }

  const totalSubmissions = funnels.reduce((s, f) => s + f._count.submissions, 0);

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4">
        <div>
          <h1 className="text-2xl font-semibold">Sites</h1>
          <p className="mt-0.5 text-sm text-muted">Funnels, websites, forms, surveys and blog management.</p>
        </div>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-border pb-px -mx-1 px-1 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={`/sites?tab=${key}`}
            className={`flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
              tab === key
                ? "border-b-2 border-primary text-primary -mb-px bg-primary/5"
                : "text-muted hover:text-foreground hover:bg-background/50"
            }`}
          >
            <Icon size={14} />
            {label}
          </Link>
        ))}
      </div>

      <div className="pt-5 space-y-5">
        {tab === "funnels" && (
          <FunnelsTab funnels={funnels} totalSubmissions={totalSubmissions} />
        )}
        {tab === "websites" && (
          <WebsitesTab websites={websites} />
        )}
        {tab === "forms" && (
          <FormsTab forms={forms} />
        )}
        {tab === "surveys" && (
          <SurveysTab surveys={surveys} />
        )}
        {tab === "blog" && (
          <BlogTab posts={blogPosts} />
        )}
        {tab === "chat" && (
          <ChatWidgetTab />
        )}
      </div>
    </div>
  );
}

// ─── Funnels Tab ──────────────────────────────────────────────────────────────

function FunnelsTab({ funnels, totalSubmissions }: { funnels: FunnelWithCounts[]; totalSubmissions: number }) {
  const live = funnels.filter((f) => f.status === "published").length;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        {funnels.length > 0 && (
          <div className="grid grid-cols-3 gap-3 md:w-96">
            <StatCard label="Total Funnels" value={funnels.length} icon={<LayoutTemplate size={16} className="text-primary" />} />
            <StatCard label="Live" value={live} icon={<Zap size={16} className="text-emerald-600" />} color="text-emerald-600" />
            <StatCard label="Submissions" value={totalSubmissions} icon={<MousePointerClick size={16} className="text-violet-600" />} color="text-violet-600" />
          </div>
        )}

        {funnels.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {funnels.map((f) => <FunnelCard key={f.id} funnel={f} />)}
          </div>
        ) : (
          <EmptyState
            icon={<LayoutTemplate size={32} />}
            title="No funnels yet"
            desc="Create your first funnel to start capturing leads and driving conversions."
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="text-primary" size={17} />
            <h2 className="font-semibold">New Funnel</h2>
          </div>
        </CardHeader>
        <CardBody>
          <form action={createFunnel} className="space-y-3">
            <input type="hidden" name="type" value="funnel" />
            <Field label="Funnel Name" name="name" placeholder="Lead capture funnel" required />
            <Field label="Custom Domain" name="domain" placeholder="funnel.yourdomain.com" />
            <Field label="Description" name="description" placeholder="Optional description..." />
            <SubmitButton className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition" pendingText="Creating…">
              Create Funnel
            </SubmitButton>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

function FunnelCard({ funnel }: { funnel: FunnelWithCounts }) {
  const PAGE_TYPE_COLORS: Record<string, string> = {
    "opt-in": "bg-blue-100 text-blue-700",
    "sales": "bg-violet-100 text-violet-700",
    "upsell": "bg-emerald-100 text-emerald-700",
    "downsell": "bg-orange-100 text-orange-700",
    "confirmation": "bg-teal-100 text-teal-700",
    "checkout": "bg-pink-100 text-pink-700",
    "custom": "bg-gray-100 text-gray-700",
  };

  return (
    <Card className="flex flex-col transition hover:border-primary">
      <CardBody className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <LayoutTemplate className="text-primary" size={17} />
          </div>
          <Badge variant={funnel.status === "published" ? "success" : "muted"}>{funnel.status}</Badge>
        </div>

        <div>
          <h3 className="font-semibold leading-snug">{funnel.name}</h3>
          {funnel.domain ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <Globe size={10} /> {funnel.domain}
            </p>
          ) : null}
          {funnel.description ? <p className="mt-1 text-xs text-muted line-clamp-2">{funnel.description}</p> : null}
        </div>

        {/* Step pills */}
        {funnel.pages.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {funnel.pages.map((p, i) => (
              <span key={p.id} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${PAGE_TYPE_COLORS[p.type] ?? "bg-gray-100 text-gray-700"}`}>
                <span className="opacity-60">{i + 1}.</span> {p.name}
              </span>
            ))}
            {funnel._count.pages > 3 && (
              <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] text-muted">+{funnel._count.pages - 3} more</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted">No steps yet</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-3 text-xs text-muted">
            <span><span className="font-semibold text-foreground">{funnel._count.pages}</span> steps</span>
            <span><span className="font-semibold text-foreground">{funnel._count.submissions}</span> leads</span>
          </div>
          <div className="flex items-center gap-1.5">
            <form action={deleteFunnel}>
              <input type="hidden" name="funnelId" value={funnel.id} />
              <SubmitButton className="rounded px-2 py-1 text-[11px] text-muted hover:bg-red-50 hover:text-red-600 transition" pendingText="Deleting…">
                Delete
              </SubmitButton>
            </form>
            <Link
              href={`/sites/funnels/${funnel.id}`}
              className="flex items-center gap-0.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition"
            >
              Edit <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Websites Tab ─────────────────────────────────────────────────────────────

function WebsitesTab({ websites }: { websites: SiteWithCount[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        {websites.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {websites.map((w) => (
              <Card key={w.id} className="flex flex-col transition hover:border-primary">
                <CardBody className="flex flex-1 flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-cyan-100">
                      <Globe className="text-cyan-700" size={17} />
                    </div>
                    <Badge variant={w.status === "published" ? "success" : "muted"}>{w.status}</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold">{w.name}</h3>
                    {w.domain ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><Globe size={10} /> {w.domain}</p>
                    ) : null}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-border">
                    <span className="text-xs text-muted"><span className="font-semibold text-foreground">{w._count.pages}</span> page{w._count.pages !== 1 ? "s" : ""}</span>
                    <Link href={`/sites/${w.id}`} className="flex items-center gap-0.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition">
                      Manage <ChevronRight size={12} />
                    </Link>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Globe size={32} />} title="No websites yet" desc="Create a multi-page website and design each page with the drag-and-drop builder." />
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="text-primary" size={17} />
            <h2 className="font-semibold">New Website</h2>
          </div>
        </CardHeader>
        <CardBody>
          <form action={createSite} className="space-y-3">
            <Field label="Website Name" name="name" placeholder="Company website" required />
            <Field label="Custom Domain" name="domain" placeholder="www.yourdomain.com" />
            <SubmitButton className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition" pendingText="Creating…">
              Create Website
            </SubmitButton>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Forms Tab ────────────────────────────────────────────────────────────────

function FormsTab({ forms }: { forms: FormWithCount[] }) {
  const totalSubs = forms.reduce((s, f) => s + f._count.submissions, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        {forms.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:w-64">
            <StatCard label="Total Forms" value={forms.length} icon={<FileText size={16} className="text-primary" />} />
            <StatCard label="Submissions" value={totalSubs} icon={<TrendingUp size={16} className="text-emerald-600" />} color="text-emerald-600" />
          </div>
        )}

        {forms.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="text-primary" size={16} />
                <h2 className="font-semibold">All Forms</h2>
              </div>
            </CardHeader>
            <div className="divide-y divide-border">
              {forms.map((f) => {
                const fields = Array.isArray(f.fields) ? f.fields.length : 0;
                return (
                  <div key={f.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-background/50 transition">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="text-primary" size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted mt-0.5">{fields} field{fields !== 1 ? "s" : ""} · {f._count.submissions} submission{f._count.submissions !== 1 ? "s" : ""}</p>
                    </div>
                    <Badge variant={f.status === "active" ? "success" : "muted"}>{f.status}</Badge>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <form action={deleteForm}>
                        <input type="hidden" name="formId" value={f.id} />
                        <SubmitButton className="rounded px-2 py-1 text-[11px] text-muted hover:bg-red-50 hover:text-red-600 transition" pendingText="Deleting…">Delete</SubmitButton>
                      </form>
                      <Link href={`/sites/forms/${f.id}`} className="flex items-center gap-0.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition">
                        Edit <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <EmptyState icon={<FileText size={32} />} title="No forms yet" desc="Build embeddable forms to capture leads, registrations, and feedback." />
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="text-primary" size={17} />
            <h2 className="font-semibold">New Form</h2>
          </div>
        </CardHeader>
        <CardBody>
          <form action={createForm} className="space-y-3">
            <Field label="Form Name" name="name" placeholder="Contact Us" required />
            <SubmitButton className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition" pendingText="Creating…">
              Create Form
            </SubmitButton>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Surveys Tab ──────────────────────────────────────────────────────────────

function SurveysTab({ surveys }: { surveys: SurveyWithCount[] }) {
  const totalResp = surveys.reduce((s, sv) => s + sv._count.responses, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        {surveys.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:w-64">
            <StatCard label="Total Surveys" value={surveys.length} icon={<BarChart2 size={16} className="text-primary" />} />
            <StatCard label="Responses" value={totalResp} icon={<TrendingUp size={16} className="text-emerald-600" />} color="text-emerald-600" />
          </div>
        )}

        {surveys.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart2 className="text-primary" size={16} />
                <h2 className="font-semibold">All Surveys</h2>
              </div>
            </CardHeader>
            <div className="divide-y divide-border">
              {surveys.map((sv) => {
                const qs = Array.isArray(sv.questions) ? sv.questions.length : 0;
                return (
                  <div key={sv.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-background/50 transition">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                      <BarChart2 className="text-violet-700" size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{sv.name}</p>
                      <p className="text-xs text-muted mt-0.5">{qs} question{qs !== 1 ? "s" : ""} · {sv._count.responses} response{sv._count.responses !== 1 ? "s" : ""}</p>
                    </div>
                    <Badge variant={sv.status === "active" ? "success" : "muted"}>{sv.status}</Badge>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <form action={deleteSurvey}>
                        <input type="hidden" name="surveyId" value={sv.id} />
                        <SubmitButton className="rounded px-2 py-1 text-[11px] text-muted hover:bg-red-50 hover:text-red-600 transition" pendingText="Deleting…">Delete</SubmitButton>
                      </form>
                      <Link href={`/sites/surveys/${sv.id}`} className="flex items-center gap-0.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition">
                        Edit <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <EmptyState icon={<BarChart2 size={32} />} title="No surveys yet" desc="Create multi-step surveys with logic jumps and NPS scoring." />
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="text-primary" size={17} />
            <h2 className="font-semibold">New Survey</h2>
          </div>
        </CardHeader>
        <CardBody>
          <form action={createSurvey} className="space-y-3">
            <Field label="Survey Name" name="name" placeholder="Customer satisfaction" required />
            <SubmitButton className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition" pendingText="Creating…">
              Create Survey
            </SubmitButton>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Blog Tab ─────────────────────────────────────────────────────────────────

function BlogTab({ posts }: { posts: Prisma.BlogPostGetPayload<object>[] }) {
  const published = posts.filter((p) => p.status === "published").length;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        {posts.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:w-64">
            <StatCard label="Total Posts" value={posts.length} icon={<BookOpen size={16} className="text-primary" />} />
            <StatCard label="Published" value={published} icon={<Zap size={16} className="text-emerald-600" />} color="text-emerald-600" />
          </div>
        )}

        {posts.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="text-primary" size={16} />
                <h2 className="font-semibold">All Posts</h2>
              </div>
            </CardHeader>
            <div className="divide-y divide-border">
              {posts.map((post) => (
                <div key={post.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-background/50 transition">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                    <BookOpen className="text-amber-700" size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{post.title}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {post.author ? `By ${post.author}` : "No author"}{post.category ? ` · ${post.category}` : ""}
                      {" · "}Created {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={post.status === "published" ? "success" : "muted"}>{post.status}</Badge>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <form action={deleteBlogPost}>
                      <input type="hidden" name="postId" value={post.id} />
                      <SubmitButton className="rounded px-2 py-1 text-[11px] text-muted hover:bg-red-50 hover:text-red-600 transition" pendingText="Deleting…">Delete</SubmitButton>
                    </form>
                    <Link href={`/sites/blog/${post.id}`} className="flex items-center gap-0.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition">
                      Edit <ChevronRight size={12} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <EmptyState icon={<BookOpen size={32} />} title="No blog posts yet" desc="Write SEO-optimized posts, set categories, tags, and featured images." />
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="text-primary" size={17} />
            <h2 className="font-semibold">New Post</h2>
          </div>
        </CardHeader>
        <CardBody>
          <form action={createBlogPost} className="space-y-3">
            <Field label="Title" name="title" placeholder="How to grow your business" required />
            <Field label="Slug" name="slug" placeholder="how-to-grow-your-business" required />
            <Field label="Author" name="author" placeholder="Jane Smith" />
            <Field label="Category" name="category" placeholder="Marketing" />
            <SubmitButton className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition" pendingText="Creating…">
              Create Post
            </SubmitButton>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Chat Widget Tab ──────────────────────────────────────────────────────────

function ChatWidgetTab() {
  return (
    <div className="rounded-lg border border-dashed border-border p-16 text-center">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-primary/10">
        <MessageSquare className="text-primary" size={24} />
      </div>
      <p className="font-semibold text-lg">Chat Widget — Coming Soon</p>
      <p className="mt-2 text-sm text-muted max-w-sm mx-auto">
        Embed a live chat widget on any website or funnel page. Configuration and embed code will be available here once the feature is ready.
      </p>
    </div>
  );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color = "text-foreground" }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 mb-1">{icon}</div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-muted mt-0.5">{label}</div>
      </CardBody>
    </Card>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center">
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-muted/20 text-muted">
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted max-w-xs mx-auto">{desc}</p>
    </div>
  );
}
