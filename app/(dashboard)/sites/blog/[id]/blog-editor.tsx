"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Eye, Globe, Save, Search, Tag, X } from "lucide-react";
import { saveBlogPost } from "@/app/(dashboard)/sites/actions";

type EditorTab = "write" | "seo" | "preview";

export function BlogEditor({
  postId,
  initialTitle,
  initialContent,
  initialExcerpt,
  initialStatus,
  initialCategory,
  initialTags,
  initialSeoTitle,
  initialSeoDesc,
  initialAuthor,
  slug,
  createdAt,
  publishedAt,
}: {
  postId: string;
  initialTitle: string;
  initialContent: string;
  initialExcerpt: string;
  initialStatus: string;
  initialCategory: string;
  initialTags: string[];
  initialSeoTitle: string;
  initialSeoDesc: string;
  initialAuthor: string;
  slug: string;
  createdAt: string;
  publishedAt: string | null;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [excerpt, setExcerpt] = useState(initialExcerpt);
  const [status, setStatus] = useState(initialStatus);
  const [category, setCategory] = useState(initialCategory);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [seoTitle, setSeoTitle] = useState(initialSeoTitle || initialTitle);
  const [seoDesc, setSeoDesc] = useState(initialSeoDesc);
  const [author, setAuthor] = useState(initialAuthor);
  const [tab, setTab] = useState<EditorTab>("write");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(newStatus?: string) {
    setSaving(true);
    await saveBlogPost(postId, {
      title,
      content,
      excerpt,
      status: newStatus ?? status,
      category,
      tags,
      seoTitle,
      seoDesc,
    });
    if (newStatus) setStatus(newStatus);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  const seoTitleLen = seoTitle.length;
  const seoDescLen = seoDesc.length;

  return (
    <div className="-mx-5 -my-6 lg:-mx-8 flex flex-col" style={{ height: "calc(100vh - 61px)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 border-b border-border bg-white px-5 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/sites?tab=blog" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
            <ArrowLeft size={14} /> Blog
          </Link>
          <span className="text-muted/40">/</span>
          <span className="max-w-xs truncate text-sm font-semibold">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["write", "seo", "preview"] as EditorTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition capitalize ${tab === t ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}
              >
                {t === "preview" && <Eye size={11} />}
                {t === "seo" && <Search size={11} />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {status === "published" ? (
              <button
                onClick={() => handleSave("draft")}
                disabled={saving}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-background transition"
              >
                Unpublish
              </button>
            ) : (
              <button
                onClick={() => handleSave("published")}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
              >
                <Globe size={12} /> Publish
              </button>
            )}
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${saved ? "bg-emerald-600 text-white" : "bg-primary text-white hover:bg-primary/90"}`}
            >
              {saved ? <><Check size={13} /> Saved</> : saving ? "Saving..." : <><Save size={13} /> Save</>}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main editor */}
        <div className="flex-1 overflow-y-auto bg-white">
          {tab === "write" && (
            <div className="mx-auto max-w-3xl px-8 py-8 space-y-4">
              {/* Cover image upload area */}
              <div className="rounded-xl border-2 border-dashed border-border bg-gray-50 p-6 text-center text-sm text-muted hover:border-primary transition cursor-pointer">
                <p className="font-medium">Click to add cover image</p>
                <p className="text-xs mt-0.5">Recommended: 1200×630px</p>
              </div>

              {/* Title */}
              <textarea
                className="w-full resize-none border-none text-3xl font-bold placeholder-muted/40 outline-none"
                placeholder="Post title..."
                rows={2}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div className="text-xs text-muted">
                {author && <span>By {author}</span>}
                {category && <span> · {category}</span>}
                <span> · {new Date(createdAt).toLocaleDateString()}</span>
                {status === "published" && publishedAt && <span> · Published {new Date(publishedAt).toLocaleDateString()}</span>}
              </div>

              <hr className="border-border" />

              {/* Content editor */}
              <textarea
                className="min-h-96 w-full resize-none border-none text-sm leading-relaxed placeholder-muted/40 outline-none"
                placeholder="Start writing your post...

You can use markdown:
# Heading 1
## Heading 2
**Bold**, *italic*, `code`
- Bullet lists
1. Numbered lists
> Blockquotes"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          )}

          {tab === "seo" && (
            <div className="mx-auto max-w-2xl px-8 py-8 space-y-6">
              <div>
                <h2 className="font-semibold mb-4">SEO Settings</h2>

                {/* Google preview */}
                <div className="rounded-xl border border-border p-4 mb-6 bg-white space-y-1">
                  <p className="text-[10px] font-medium text-muted/60 uppercase tracking-wide mb-2">Search Preview</p>
                  <p className="text-blue-600 text-sm font-medium leading-snug">{seoTitle || title}</p>
                  <p className="text-green-700 text-xs">yourdomain.com/blog/{slug}</p>
                  <p className="text-muted text-xs line-clamp-2">{seoDesc || excerpt || "No meta description set."}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">SEO Title</label>
                    <input className="w-full rounded-md border border-border px-3 py-2 text-sm" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={title} />
                    <div className={`mt-1 text-right text-[10px] ${seoTitleLen > 60 ? "text-red-500" : "text-muted"}`}>{seoTitleLen} / 60</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Meta Description</label>
                    <textarea className="w-full rounded-md border border-border px-3 py-2 text-sm resize-none" rows={3} value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} placeholder="Compelling description for search results..." />
                    <div className={`mt-1 text-right text-[10px] ${seoDescLen > 160 ? "text-red-500" : "text-muted"}`}>{seoDescLen} / 160</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">URL Slug</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">yourdomain.com/blog/</span>
                      <span className="rounded-md border border-border px-3 py-2 text-sm font-mono text-muted">{slug}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Excerpt</label>
                    <textarea className="w-full rounded-md border border-border px-3 py-2 text-sm resize-none" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Short summary for post listings..." />
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "preview" && (
            <div className="mx-auto max-w-3xl px-8 py-8 space-y-4">
              <h1 className="text-3xl font-bold">{title || "Untitled Post"}</h1>
              <div className="text-sm text-muted">
                {author && <span>By {author}</span>}
                {category && <span> · {category}</span>}
                <span> · {new Date(createdAt).toLocaleDateString()}</span>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => <span key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{t}</span>)}
                </div>
              )}
              <hr className="border-border" />
              {content ? (
                <div className="prose prose-sm max-w-none text-foreground">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{content}</pre>
                </div>
              ) : (
                <p className="text-muted italic text-sm">No content yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-64 shrink-0 overflow-y-auto border-l border-border bg-[#f8f9fa] p-4 space-y-5">
          {/* Status */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted/60 mb-2">Status</label>
            <select
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          {/* Author */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted/60 mb-2">Author</label>
            <input className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted/60 mb-2">Category</label>
            <input className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Marketing" />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted/60 mb-2">Tags</label>
            <div className="flex gap-1.5 mb-2">
              <input
                className="flex-1 rounded-md border border-border bg-white px-2 py-1.5 text-xs"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Add tag..."
              />
              <button onClick={addTag} className="rounded-md bg-primary/10 px-2 text-primary text-xs font-medium hover:bg-primary/20 transition">Add</button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-0.5 rounded-full bg-white border border-border px-2 py-0.5 text-[10px] font-medium">
                    <Tag size={8} /> {t}
                    <button onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="ml-0.5 text-muted/60 hover:text-red-500 transition"><X size={9} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
