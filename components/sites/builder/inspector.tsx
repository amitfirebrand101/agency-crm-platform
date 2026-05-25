"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  makeFeatureItem,
  makeFormField,
  type Block,
  type FeatureItem,
  type FormFieldConfig,
} from "@/lib/sites/schema";

// ─── Field primitives ────────────────────────────────────────────────────────

function isUnsafeUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith("#") || v.startsWith("/")) return false;
  try {
    const url = new URL(v);
    const p = url.protocol.toLowerCase();
    return !(p === "http:" || p === "https:" || p === "mailto:" || p === "tel:");
  } catch {
    return true;
  }
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none ring-primary/20 focus:ring-4"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none ring-primary/20 focus:ring-4"
      />
    </label>
  );
}

function UrlField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const unsafe = isUnsafeUrl(value);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "https://…"}
        className={`w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-4 ${
          unsafe ? "border-red-400 ring-red-200" : "border-border ring-primary/20"
        }`}
      />
      {unsafe ? (
        <span className="mt-1 block text-[11px] text-red-600">
          Use an http(s), mailto, tel, or root-relative URL. This value will be ignored when rendered.
        </span>
      ) : null}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 shrink-0 cursor-pointer rounded border border-border bg-background"
          aria-label={`${label} color picker`}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-mono outline-none ring-primary/20 focus:ring-4"
        />
      </div>
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none ring-primary/20 focus:ring-4"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 rounded-full transition ${value ? "bg-primary" : "bg-border"}`}
      >
        <span className={`absolute top-0.5 size-4 rounded-full bg-white transition ${value ? "left-4" : "left-0.5"}`} />
      </button>
    </label>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
        <ChevronDown size={15} className={`text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="flex flex-col gap-3 px-3 pb-4">{children}</div> : null}
    </div>
  );
}

// ─── Main inspector ──────────────────────────────────────────────────────────

export function BlockInspector({ block, onChange }: { block: Block | null; onChange: (updated: Block) => void }) {
  if (!block) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-sm text-muted">Select a block to edit its content and style.</p>
      </div>
    );
  }

  // Strongly-typed patch helper per block (the discriminated union keeps types safe).
  function patch<B extends Block>(b: B, changes: Partial<B>): B {
    return { ...b, ...changes };
  }

  switch (block.type) {
    case "hero":
      return (
        <>
          <Section title="Content">
            <TextField label="Eyebrow" value={block.eyebrow} onChange={(v) => onChange(patch(block, { eyebrow: v }))} />
            <TextField label="Heading" value={block.heading} onChange={(v) => onChange(patch(block, { heading: v }))} />
            <TextAreaField label="Body" value={block.body} onChange={(v) => onChange(patch(block, { body: v }))} />
          </Section>
          <Section title="Buttons">
            <TextField label="Primary label" value={block.primaryButtonLabel} onChange={(v) => onChange(patch(block, { primaryButtonLabel: v }))} />
            <UrlField label="Primary link" value={block.primaryButtonHref} onChange={(v) => onChange(patch(block, { primaryButtonHref: v }))} />
            <TextField label="Secondary label" value={block.secondaryButtonLabel} onChange={(v) => onChange(patch(block, { secondaryButtonLabel: v }))} />
            <UrlField label="Secondary link" value={block.secondaryButtonHref} onChange={(v) => onChange(patch(block, { secondaryButtonHref: v }))} />
          </Section>
          <Section title="Style" defaultOpen={false}>
            <UrlField label="Image URL" value={block.imageUrl} onChange={(v) => onChange(patch(block, { imageUrl: v }))} />
            <SelectField
              label="Alignment"
              value={block.alignment}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
              ]}
              onChange={(v) => onChange(patch(block, { alignment: v }))}
            />
          </Section>
        </>
      );

    case "text":
      return (
        <>
          <Section title="Content">
            <TextField label="Heading" value={block.heading} onChange={(v) => onChange(patch(block, { heading: v }))} />
            <TextAreaField label="Body" value={block.body} rows={5} onChange={(v) => onChange(patch(block, { body: v }))} />
          </Section>
          <Section title="Style" defaultOpen={false}>
            <SelectField
              label="Alignment"
              value={block.alignment}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
              onChange={(v) => onChange(patch(block, { alignment: v }))}
            />
          </Section>
        </>
      );

    case "image":
      return (
        <>
          <Section title="Content">
            <UrlField label="Image URL" value={block.imageUrl} onChange={(v) => onChange(patch(block, { imageUrl: v }))} />
            <TextField label="Alt text" value={block.alt} onChange={(v) => onChange(patch(block, { alt: v }))} />
            <TextField label="Caption" value={block.caption} onChange={(v) => onChange(patch(block, { caption: v }))} />
          </Section>
          <Section title="Style" defaultOpen={false}>
            <SelectField
              label="Aspect ratio"
              value={block.aspectRatio}
              options={[
                { value: "auto", label: "Auto" },
                { value: "square", label: "Square (1:1)" },
                { value: "video", label: "Video (16:9)" },
                { value: "wide", label: "Wide (21:9)" },
              ]}
              onChange={(v) => onChange(patch(block, { aspectRatio: v }))}
            />
          </Section>
        </>
      );

    case "button":
      return (
        <>
          <Section title="Content">
            <TextField label="Label" value={block.label} onChange={(v) => onChange(patch(block, { label: v }))} />
            <UrlField label="Link" value={block.href} onChange={(v) => onChange(patch(block, { href: v }))} />
          </Section>
          <Section title="Style" defaultOpen={false}>
            <SelectField
              label="Variant"
              value={block.variant}
              options={[
                { value: "primary", label: "Primary" },
                { value: "secondary", label: "Secondary" },
                { value: "outline", label: "Outline" },
              ]}
              onChange={(v) => onChange(patch(block, { variant: v }))}
            />
            <SelectField
              label="Alignment"
              value={block.alignment}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
              onChange={(v) => onChange(patch(block, { alignment: v }))}
            />
          </Section>
        </>
      );

    case "twoColumn":
      return (
        <>
          <Section title="Content">
            <TextField label="Left heading" value={block.leftHeading} onChange={(v) => onChange(patch(block, { leftHeading: v }))} />
            <TextAreaField label="Left body" value={block.leftBody} onChange={(v) => onChange(patch(block, { leftBody: v }))} />
            <TextField label="Right heading" value={block.rightHeading} onChange={(v) => onChange(patch(block, { rightHeading: v }))} />
            <TextAreaField label="Right body" value={block.rightBody} onChange={(v) => onChange(patch(block, { rightBody: v }))} />
          </Section>
          <Section title="Style" defaultOpen={false}>
            <UrlField label="Image URL" value={block.imageUrl} onChange={(v) => onChange(patch(block, { imageUrl: v }))} />
            <SelectField
              label="Column ratio"
              value={block.ratio}
              options={[
                { value: "1:1", label: "Equal (1:1)" },
                { value: "1:2", label: "Narrow / Wide (1:2)" },
                { value: "2:1", label: "Wide / Narrow (2:1)" },
              ]}
              onChange={(v) => onChange(patch(block, { ratio: v }))}
            />
            <SelectField
              label="Image side"
              value={block.imageSide}
              options={[
                { value: "left", label: "Left" },
                { value: "right", label: "Right" },
              ]}
              onChange={(v) => onChange(patch(block, { imageSide: v }))}
            />
          </Section>
        </>
      );

    case "featureGrid": {
      const fgBlock = block;
      const updateFeature = (id: string, changes: Partial<FeatureItem>) => {
        onChange(patch(fgBlock, { features: fgBlock.features.map((f) => (f.id === id ? { ...f, ...changes } : f)) }));
      };
      return (
        <>
          <Section title="Content">
            <TextField label="Heading" value={block.heading} onChange={(v) => onChange(patch(block, { heading: v }))} />
            <TextAreaField label="Subheading" value={block.subheading} onChange={(v) => onChange(patch(block, { subheading: v }))} />
          </Section>
          <Section title="Features">
            <div className="flex flex-col gap-3">
              {block.features.map((f, idx) => (
                <div key={f.id} className="rounded-md border border-border p-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted">Feature {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => onChange(patch(block, { features: block.features.filter((x) => x.id !== f.id) }))}
                      className="text-muted hover:text-red-600"
                      aria-label="Remove feature"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <TextField label="Title" value={f.title} onChange={(v) => updateFeature(f.id, { title: v })} />
                    <TextField label="Description" value={f.description} onChange={(v) => updateFeature(f.id, { description: v })} />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onChange(patch(block, { features: [...block.features, makeFeatureItem()] }))}
                className="flex items-center justify-center gap-1 rounded-md border border-dashed border-border py-2 text-xs font-medium text-muted hover:border-primary hover:text-primary"
              >
                <Plus size={13} /> Add feature
              </button>
            </div>
          </Section>
          <Section title="Style" defaultOpen={false}>
            <SelectField
              label="Columns"
              value={block.columns}
              options={[
                { value: "2", label: "2 columns" },
                { value: "3", label: "3 columns" },
                { value: "4", label: "4 columns" },
              ]}
              onChange={(v) => onChange(patch(block, { columns: v }))}
            />
          </Section>
        </>
      );
    }

    case "testimonial":
      return (
        <>
          <Section title="Content">
            <TextAreaField label="Quote" value={block.quote} rows={4} onChange={(v) => onChange(patch(block, { quote: v }))} />
            <TextField label="Author name" value={block.authorName} onChange={(v) => onChange(patch(block, { authorName: v }))} />
            <TextField label="Author title" value={block.authorTitle} onChange={(v) => onChange(patch(block, { authorTitle: v }))} />
          </Section>
          <Section title="Style" defaultOpen={false}>
            <UrlField label="Avatar URL" value={block.avatarUrl} onChange={(v) => onChange(patch(block, { avatarUrl: v }))} />
          </Section>
        </>
      );

    case "form": {
      const formBlock = block;
      const updateFormField = (id: string, changes: Partial<FormFieldConfig>) => {
        onChange(patch(formBlock, { fields: formBlock.fields.map((f) => (f.id === id ? { ...f, ...changes } : f)) }));
      };
      return (
        <>
          <Section title="Content">
            <TextField label="Heading" value={block.heading} onChange={(v) => onChange(patch(block, { heading: v }))} />
            <TextAreaField label="Description" value={block.description} onChange={(v) => onChange(patch(block, { description: v }))} />
          </Section>
          <Section title="Fields">
            <div className="flex flex-col gap-3">
              {block.fields.map((f, idx) => (
                <div key={f.id} className="rounded-md border border-border p-2.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted">Field {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => onChange(patch(block, { fields: block.fields.filter((x) => x.id !== f.id) }))}
                      className="text-muted hover:text-red-600"
                      aria-label="Remove field"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <TextField label="Label" value={f.label} onChange={(v) => updateFormField(f.id, { label: v })} />
                    <TextField label="Name" value={f.name} onChange={(v) => updateFormField(f.id, { name: v })} />
                    <TextField label="Placeholder" value={f.placeholder} onChange={(v) => updateFormField(f.id, { placeholder: v })} />
                    <SelectField
                      label="Type"
                      value={f.fieldType}
                      options={[
                        { value: "text", label: "Text" },
                        { value: "email", label: "Email" },
                        { value: "tel", label: "Phone" },
                        { value: "textarea", label: "Textarea" },
                      ]}
                      onChange={(v) => updateFormField(f.id, { fieldType: v })}
                    />
                    <ToggleField label="Required" value={f.required} onChange={(v) => updateFormField(f.id, { required: v })} />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onChange(patch(block, { fields: [...block.fields, makeFormField()] }))}
                className="flex items-center justify-center gap-1 rounded-md border border-dashed border-border py-2 text-xs font-medium text-muted hover:border-primary hover:text-primary"
              >
                <Plus size={13} /> Add field
              </button>
            </div>
          </Section>
          <Section title="Settings" defaultOpen={false}>
            <TextField label="Submit label" value={block.submitLabel} onChange={(v) => onChange(patch(block, { submitLabel: v }))} />
            <TextField label="Success message" value={block.successMessage} onChange={(v) => onChange(patch(block, { successMessage: v }))} />
          </Section>
        </>
      );
    }

    case "spacer":
      return (
        <Section title="Settings">
          <SelectField
            label="Height"
            value={block.height}
            options={[
              { value: "sm", label: "Small" },
              { value: "md", label: "Medium" },
              { value: "lg", label: "Large" },
              { value: "xl", label: "Extra large" },
            ]}
            onChange={(v) => onChange(patch(block, { height: v }))}
          />
        </Section>
      );

    case "divider":
      return (
        <Section title="Style">
          <SelectField
            label="Style"
            value={block.style}
            options={[
              { value: "solid", label: "Solid" },
              { value: "dashed", label: "Dashed" },
              { value: "dotted", label: "Dotted" },
            ]}
            onChange={(v) => onChange(patch(block, { style: v }))}
          />
        </Section>
      );

    case "footer":
      return (
        <Section title="Content">
          <TextField label="Company name" value={block.companyName} onChange={(v) => onChange(patch(block, { companyName: v }))} />
          <TextField label="Tagline" value={block.tagline} onChange={(v) => onChange(patch(block, { tagline: v }))} />
          <TextField label="Copyright" value={block.copyright} onChange={(v) => onChange(patch(block, { copyright: v }))} />
        </Section>
      );

    default:
      return null;
  }
}

export { ColorField, SelectField, TextField };
