import Link from "next/link";
import { ArrowLeft, BarChart2, CheckCircle, Globe, MousePointerClick, Plus, Settings, TrendingUp, Zap } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { addFunnelStep, updateFunnel, publishFunnel, unpublishFunnel } from "@/app/(dashboard)/sites/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StepReorder } from "./step-reorder";

type FunnelFull = Prisma.FunnelGetPayload<{
  include: {
    pages: { orderBy: { order: "asc" } };
    _count: { select: { submissions: true } };
    submissions: { orderBy: { createdAt: "desc" }; take: 5 };
  };
}>;

export default async function FunnelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  let funnel: FunnelFull | null = null;
  try {
    funnel = await prisma.funnel.findFirst({
      where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      include: {
        pages: { orderBy: { order: "asc" } },
        _count: { select: { submissions: true } },
        submissions: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
  } catch {}

  if (!funnel) {
    return (
      <div className="space-y-4">
        <Link href="/sites" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
          <ArrowLeft size={14} /> Back to Sites
        </Link>
        <p className="text-muted">Funnel not found.</p>
      </div>
    );
  }

  const totalVisits = funnel.pages.reduce((s, p) => s + p.visits, 0);
  const totalConversions = funnel.pages.reduce((s, p) => s + p.conversions, 0);
  const convRate = totalVisits > 0 ? ((totalConversions / totalVisits) * 100).toFixed(1) : "0.0";

  const PAGE_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    "opt-in":       { bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-200" },
    "sales":        { bg: "bg-violet-50",  text: "text-violet-700", border: "border-violet-200" },
    "upsell":       { bg: "bg-emerald-50", text: "text-emerald-700",border: "border-emerald-200" },
    "downsell":     { bg: "bg-orange-50",  text: "text-orange-700", border: "border-orange-200" },
    "confirmation": { bg: "bg-teal-50",    text: "text-teal-700",   border: "border-teal-200" },
    "checkout":     { bg: "bg-pink-50",    text: "text-pink-700",   border: "border-pink-200" },
    "custom":       { bg: "bg-gray-50",    text: "text-gray-700",   border: "border-gray-200" },
  };

  const PAGE_TYPES = ["opt-in", "sales", "upsell", "downsell", "confirmation", "checkout", "custom"];

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/sites" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
            <ArrowLeft size={14} /> Sites
          </Link>
          <span className="text-muted/40">/</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{funnel.name}</h1>
              <Badge variant={funnel.status === "published" ? "success" : "muted"}>{funnel.status}</Badge>
            </div>
            {funnel.domain && (
              <p className="text-xs text-muted flex items-center gap-1 mt-0.5"><Globe size={10} /> {funnel.domain}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {funnel.status === "published" ? (
            <form action={unpublishFunnel}>
              <input type="hidden" name="funnelId" value={funnel.id} />
              <SubmitButton className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background transition" pendingText="Unpublishing…">
                Unpublish
              </SubmitButton>
            </form>
          ) : (
            <form action={publishFunnel}>
              <input type="hidden" name="funnelId" value={funnel.id} />
              <SubmitButton className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 transition" pendingText="Publishing…">
                <Zap size={13} /> Publish
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total Steps" value={funnel.pages.length} icon={<CheckCircle size={15} className="text-primary" />} />
        <StatTile label="Unique Visits" value={totalVisits} icon={<MousePointerClick size={15} className="text-cyan-600" />} />
        <StatTile label="Conversions" value={totalConversions} icon={<TrendingUp size={15} className="text-emerald-600" />} />
        <StatTile label="Conv. Rate" value={`${convRate}%`} icon={<BarChart2 size={15} className="text-violet-600" />} isString />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Funnel Steps */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Funnel Steps</h2>
            <p className="text-xs text-muted">Drag to reorder</p>
          </div>

          {/* Reorderable step list */}
          <StepReorder
            funnelId={funnel.id}
            pages={funnel.pages.map((p) => ({
              id: p.id,
              name: p.name,
              type: p.type,
              pathSlug: p.pathSlug,
              visits: p.visits,
              conversions: p.conversions,
              order: p.order,
            }))}
          />

          {/* Add step form */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="text-primary" size={16} />
                <h3 className="font-semibold text-sm">Add Step</h3>
              </div>
            </CardHeader>
            <CardBody>
              <form action={addFunnelStep} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="funnelId" value={funnel.id} />
                <Field label="Step Name" name="name" placeholder="Opt-in Page" required />
                <Field label="URL Path" name="pathSlug" placeholder="opt-in" required />
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1.5">Step Type</label>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                    {PAGE_TYPES.map((t) => {
                      const color = PAGE_TYPE_COLORS[t] ?? { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
                      return (
                        <label key={t} className="relative cursor-pointer">
                          <input type="radio" name="type" value={t} defaultChecked={t === "sales"} className="peer sr-only" />
                          <div className={`rounded-lg border-2 px-2.5 py-1.5 text-center text-xs font-medium capitalize transition
                            peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary
                            border-border hover:border-border/80 ${color.text}`}>
                            {t}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <SubmitButton className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition" pendingText="Adding…">
                    Add Step
                  </SubmitButton>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Right panel: Settings + Recent leads */}
        <div className="space-y-4">
          {/* Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="text-muted" size={15} />
                <h3 className="font-semibold text-sm">Funnel Settings</h3>
              </div>
            </CardHeader>
            <CardBody>
              <form action={updateFunnel} className="space-y-3">
                <input type="hidden" name="funnelId" value={funnel.id} />
                <Field label="Name" name="name" defaultValue={funnel.name} required />
                <Field label="Custom Domain" name="domain" defaultValue={funnel.domain ?? ""} placeholder="funnel.yourdomain.com" />
                <Field label="Description" name="description" defaultValue={funnel.description ?? ""} placeholder="What this funnel does..." />
                <SubmitButton className="w-full rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-background transition" pendingText="Saving…">
                  Save Settings
                </SubmitButton>
              </form>
            </CardBody>
          </Card>

          {/* Recent Submissions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MousePointerClick className="text-muted" size={15} />
                  <h3 className="font-semibold text-sm">Recent Leads</h3>
                </div>
                <span className="text-xs text-muted">{funnel._count.submissions} total</span>
              </div>
            </CardHeader>
            <CardBody>
              {funnel.submissions.length > 0 ? (
                <div className="space-y-2">
                  {funnel.submissions.map((sub) => {
                    const data = sub.data as Record<string, string>;
                    const name = data.name || data.firstName || data.email || "Anonymous";
                    return (
                      <div key={sub.id} className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{name}</p>
                          {data.email && <p className="text-xs text-muted">{data.email}</p>}
                        </div>
                        <p className="text-[10px] text-muted whitespace-nowrap">
                          {new Date(sub.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted text-center py-4">No leads yet. Publish your funnel to start capturing leads.</p>
              )}
            </CardBody>
          </Card>

          {/* Domain & UTM */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="text-muted" size={15} />
                <h3 className="font-semibold text-sm">Domain & Sharing</h3>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted mb-1">Funnel URL</p>
                  <div className="rounded-md bg-background border border-border px-3 py-2 font-mono text-xs text-muted truncate">
                    {funnel.domain
                      ? `https://${funnel.domain}`
                      : `https://app.golowlevel.com/f/${funnel.id.slice(0, 8)}`}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted mb-1">SSL Certificate</p>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                    <CheckCircle size={12} /> Auto-provisioned
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted mb-1">UTM Tracking</p>
                  <p className="text-xs text-muted">UTM parameters are automatically captured with every submission.</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, icon, isString }: { label: string; value: number | string; icon: React.ReactNode; isString?: boolean }) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2 mb-1">{icon}</div>
        <div className="text-2xl font-bold">{isString ? value : value.toLocaleString()}</div>
        <div className="text-xs text-muted mt-0.5">{label}</div>
      </CardBody>
    </Card>
  );
}
