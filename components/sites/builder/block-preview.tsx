"use client";

import type { Block, Theme } from "@/lib/sites/schema";

const RADIUS_MAP: Record<Theme["borderRadius"], string> = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "16px",
};

function alignClass(align: "left" | "center" | "right"): string {
  if (align === "center") return "items-center text-center";
  if (align === "right") return "items-end text-right";
  return "items-start text-left";
}

/**
 * Renders a simplified but recognisable preview of a block using its real
 * content. Used inside the editor canvas (not the published page).
 */
export function BlockPreview({ block, theme }: { block: Block; theme: Theme }) {
  const radius = RADIUS_MAP[theme.borderRadius];

  switch (block.type) {
    case "hero":
      return (
        <div className={`flex flex-col gap-2 px-6 py-8 ${alignClass(block.alignment)}`}>
          {block.eyebrow ? (
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.primaryColor }}>
              {block.eyebrow}
            </span>
          ) : null}
          <h2 className="text-2xl font-bold leading-tight">{block.heading || "Hero heading"}</h2>
          {block.body ? <p className="max-w-xl text-sm text-muted">{block.body}</p> : null}
          <div className={`mt-1 flex gap-2 ${block.alignment === "center" ? "justify-center" : ""}`}>
            {block.primaryButtonLabel ? (
              <span className="rounded px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: theme.primaryColor, borderRadius: radius }}>
                {block.primaryButtonLabel}
              </span>
            ) : null}
            {block.secondaryButtonLabel ? (
              <span className="rounded border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: theme.primaryColor, color: theme.primaryColor, borderRadius: radius }}>
                {block.secondaryButtonLabel}
              </span>
            ) : null}
          </div>
        </div>
      );

    case "text":
      return (
        <div className={`flex flex-col gap-1.5 px-6 py-5 ${alignClass(block.alignment)}`}>
          {block.heading ? <h3 className="text-lg font-bold">{block.heading}</h3> : null}
          <p className="max-w-2xl whitespace-pre-line text-sm text-muted">{block.body || "Paragraph text…"}</p>
        </div>
      );

    case "image":
      return (
        <div className="px-6 py-5">
          {block.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.imageUrl} alt={block.alt} className="max-h-48 w-full object-cover" style={{ borderRadius: radius }} />
          ) : (
            <div className="flex h-32 items-center justify-center bg-black/5 text-xs text-muted" style={{ borderRadius: radius }}>
              Image placeholder
            </div>
          )}
          {block.caption ? <p className="mt-1 text-center text-xs text-muted">{block.caption}</p> : null}
        </div>
      );

    case "button":
      return (
        <div className={`flex px-6 py-5 ${block.alignment === "center" ? "justify-center" : block.alignment === "right" ? "justify-end" : "justify-start"}`}>
          <span
            className="rounded px-4 py-2 text-xs font-semibold"
            style={
              block.variant === "primary"
                ? { backgroundColor: theme.primaryColor, color: "#fff", borderRadius: radius }
                : block.variant === "outline"
                  ? { border: `1px solid ${theme.primaryColor}`, color: theme.primaryColor, borderRadius: radius }
                  : { backgroundColor: "rgba(0,0,0,0.06)", borderRadius: radius }
            }
          >
            {block.label || "Button"}
          </span>
        </div>
      );

    case "twoColumn": {
      const cols = block.ratio === "1:2" ? "grid-cols-[1fr_2fr]" : block.ratio === "2:1" ? "grid-cols-[2fr_1fr]" : "grid-cols-2";
      const text = (
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-bold">{block.leftHeading || "Heading"}</h4>
          <p className="text-xs text-muted">{block.leftBody}</p>
        </div>
      );
      const media = (
        <div className="flex min-h-20 items-center justify-center bg-black/5 text-xs text-muted" style={{ borderRadius: radius }}>
          {block.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.imageUrl} alt="" className="max-h-28 w-full object-cover" style={{ borderRadius: radius }} />
          ) : (
            "Image"
          )}
        </div>
      );
      return (
        <div className={`grid gap-4 px-6 py-5 ${cols}`}>
          {block.imageSide === "left" ? (
            <>
              {media}
              {text}
            </>
          ) : (
            <>
              {text}
              {media}
            </>
          )}
        </div>
      );
    }

    case "featureGrid": {
      const cols = block.columns === "2" ? "grid-cols-2" : block.columns === "4" ? "grid-cols-4" : "grid-cols-3";
      return (
        <div className="px-6 py-5">
          <div className="text-center">
            <h3 className="text-lg font-bold">{block.heading}</h3>
            {block.subheading ? <p className="text-xs text-muted">{block.subheading}</p> : null}
          </div>
          <div className={`mt-3 grid gap-2 ${cols}`}>
            {block.features.map((f) => (
              <div key={f.id} className="rounded border border-border p-2">
                <p className="text-xs font-semibold">{f.title}</p>
                <p className="text-[11px] text-muted">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "testimonial":
      return (
        <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
          <p className="max-w-xl text-base font-medium">&ldquo;{block.quote}&rdquo;</p>
          <p className="text-xs text-muted">
            <span className="font-semibold text-foreground">{block.authorName}</span>
            {block.authorTitle ? ` · ${block.authorTitle}` : ""}
          </p>
        </div>
      );

    case "form":
      return (
        <div className="mx-auto max-w-md px-6 py-5">
          <div className="text-center">
            <h3 className="text-lg font-bold">{block.heading}</h3>
            {block.description ? <p className="text-xs text-muted">{block.description}</p> : null}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {block.fields.map((field) => (
              <div key={field.id} className="flex flex-col gap-1">
                <span className="text-[11px] font-medium">{field.label}{field.required ? " *" : ""}</span>
                <div className="h-7 rounded border border-border bg-background px-2 text-xs leading-7 text-muted" style={{ borderRadius: radius }}>
                  {field.placeholder || field.fieldType}
                </div>
              </div>
            ))}
            <span className="mt-1 rounded px-3 py-1.5 text-center text-xs font-semibold text-white" style={{ backgroundColor: theme.primaryColor, borderRadius: radius }}>
              {block.submitLabel}
            </span>
          </div>
        </div>
      );

    case "spacer": {
      const h = block.height === "sm" ? "h-4" : block.height === "lg" ? "h-16" : block.height === "xl" ? "h-24" : "h-10";
      return (
        <div className={`flex ${h} items-center justify-center`}>
          <span className="text-[10px] uppercase tracking-wide text-muted/60">Spacer · {block.height}</span>
        </div>
      );
    }

    case "divider":
      return (
        <div className="px-6 py-4">
          <hr className="border-t" style={{ borderTopStyle: block.style, borderColor: "rgba(0,0,0,0.2)" }} />
        </div>
      );

    case "footer":
      return (
        <div className="border-t border-border px-6 py-5 text-center">
          <p className="text-sm font-semibold">{block.companyName}</p>
          {block.tagline ? <p className="text-xs text-muted">{block.tagline}</p> : null}
          {block.copyright ? <p className="mt-1 text-[11px] text-muted/70">{block.copyright}</p> : null}
        </div>
      );

    default:
      return null;
  }
}
