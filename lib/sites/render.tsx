import type { CSSProperties, ReactNode } from "react";
import type {
  Block,
  PageSchema,
  Theme,
} from "@/lib/sites/schema";

// ─── URL safety ──────────────────────────────────────────────────────────────

/**
 * Returns a safe href, or undefined if the URL is unsafe.
 * Rejects javascript:, data:, vbscript:, and other non http(s)/mailto/tel schemes.
 */
export function safeHref(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value) return undefined;

  // Allow site-internal anchors and root-relative links.
  if (value.startsWith("#") || value.startsWith("/")) return value;

  try {
    const url = new URL(value);
    const protocol = url.protocol.toLowerCase();
    if (protocol === "http:" || protocol === "https:" || protocol === "mailto:" || protocol === "tel:") {
      return url.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns a safe image URL (http/https only), or undefined.
 * Rejects data:, javascript:, and relative paths (which could be ambiguous on
 * a public domain). Root-relative paths are allowed.
 */
export function safeImageUrl(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    const protocol = url.protocol.toLowerCase();
    if (protocol === "http:" || protocol === "https:") return url.toString();
    return undefined;
  } catch {
    return undefined;
  }
}

// ─── Theme helpers ───────────────────────────────────────────────────────────

const RADIUS_MAP: Record<Theme["borderRadius"], string> = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "16px",
};

function themeStyle(theme: Theme): CSSProperties {
  return {
    fontFamily: theme.fontFamily,
    backgroundColor: theme.backgroundColor,
    color: theme.textColor,
  };
}

function alignClass(align: "left" | "center" | "right"): string {
  if (align === "center") return "text-center items-center";
  if (align === "right") return "text-right items-end";
  return "text-left items-start";
}

// ─── Individual block renderers ──────────────────────────────────────────────

function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-5xl px-5 ${className ?? ""}`}>{children}</div>;
}

function HeroBlock({ block, theme }: { block: Extract<Block, { type: "hero" }>; theme: Theme }) {
  const radius = RADIUS_MAP[theme.borderRadius];
  const img = safeImageUrl(block.imageUrl);
  const primaryHref = safeHref(block.primaryButtonHref);
  const secondaryHref = safeHref(block.secondaryButtonHref);
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className={`flex flex-col gap-6 ${alignClass(block.alignment)}`}>
          {block.eyebrow ? (
            <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: theme.primaryColor }}>
              {block.eyebrow}
            </span>
          ) : null}
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">{block.heading}</h1>
          {block.body ? <p className="max-w-2xl text-base opacity-80 sm:text-lg">{block.body}</p> : null}
          <div className={`flex flex-wrap gap-3 ${block.alignment === "center" ? "justify-center" : "justify-start"}`}>
            {block.primaryButtonLabel && primaryHref ? (
              <a
                href={primaryHref}
                className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: theme.primaryColor, borderRadius: radius }}
              >
                {block.primaryButtonLabel}
              </a>
            ) : null}
            {block.secondaryButtonLabel && secondaryHref ? (
              <a
                href={secondaryHref}
                className="inline-flex items-center border px-5 py-2.5 text-sm font-semibold"
                style={{ borderColor: theme.primaryColor, color: theme.primaryColor, borderRadius: radius }}
              >
                {block.secondaryButtonLabel}
              </a>
            ) : null}
          </div>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={block.heading}
              className="mt-6 w-full max-w-3xl object-cover"
              style={{ borderRadius: radius }}
            />
          ) : null}
        </div>
      </Container>
    </section>
  );
}

function TextBlock({ block }: { block: Extract<Block, { type: "text" }> }) {
  return (
    <section className="py-10">
      <Container>
        <div className={`flex flex-col gap-3 ${alignClass(block.alignment)}`}>
          {block.heading ? <h2 className="text-2xl font-bold sm:text-3xl">{block.heading}</h2> : null}
          {block.body
            ? block.body.split("\n").map((line, i) => (
                <p key={i} className="max-w-3xl text-base leading-relaxed opacity-80">
                  {line}
                </p>
              ))
            : null}
        </div>
      </Container>
    </section>
  );
}

function ImageBlock({ block, theme }: { block: Extract<Block, { type: "image" }>; theme: Theme }) {
  const img = safeImageUrl(block.imageUrl);
  const radius = RADIUS_MAP[theme.borderRadius];
  const ratioClass =
    block.aspectRatio === "square"
      ? "aspect-square"
      : block.aspectRatio === "video"
        ? "aspect-video"
        : block.aspectRatio === "wide"
          ? "aspect-[21/9]"
          : "";
  return (
    <section className="py-10">
      <Container>
        <figure className="flex flex-col gap-2">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={block.alt}
              className={`w-full object-cover ${ratioClass}`}
              style={{ borderRadius: radius }}
            />
          ) : (
            <div
              className={`flex w-full items-center justify-center bg-black/5 text-sm opacity-50 ${ratioClass || "py-20"}`}
              style={{ borderRadius: radius }}
            >
              No image
            </div>
          )}
          {block.caption ? <figcaption className="text-center text-sm opacity-60">{block.caption}</figcaption> : null}
        </figure>
      </Container>
    </section>
  );
}

function ButtonBlock({ block, theme }: { block: Extract<Block, { type: "button" }>; theme: Theme }) {
  const href = safeHref(block.href);
  const radius = RADIUS_MAP[theme.borderRadius];
  if (!href) return null;
  const base = "inline-flex items-center px-5 py-2.5 text-sm font-semibold";
  const style: CSSProperties =
    block.variant === "primary"
      ? { backgroundColor: theme.primaryColor, color: "#ffffff", borderRadius: radius }
      : block.variant === "secondary"
        ? { backgroundColor: "rgba(0,0,0,0.06)", color: theme.textColor, borderRadius: radius }
        : { border: `1px solid ${theme.primaryColor}`, color: theme.primaryColor, borderRadius: radius };
  return (
    <section className="py-6">
      <Container>
        <div className={`flex ${alignClass(block.alignment)} ${block.alignment === "center" ? "justify-center" : block.alignment === "right" ? "justify-end" : "justify-start"}`}>
          <a href={href} className={base} style={style}>
            {block.label}
          </a>
        </div>
      </Container>
    </section>
  );
}

function TwoColumnBlock({ block, theme }: { block: Extract<Block, { type: "twoColumn" }>; theme: Theme }) {
  const radius = RADIUS_MAP[theme.borderRadius];
  const img = safeImageUrl(block.imageUrl);
  const gridCols =
    block.ratio === "1:2" ? "md:grid-cols-[1fr_2fr]" : block.ratio === "2:1" ? "md:grid-cols-[2fr_1fr]" : "md:grid-cols-2";

  const textColumn = (
    <div className="flex flex-col gap-4">
      <div>
        {block.leftHeading ? <h3 className="text-xl font-bold">{block.leftHeading}</h3> : null}
        {block.leftBody ? <p className="mt-2 text-base leading-relaxed opacity-80">{block.leftBody}</p> : null}
      </div>
      {block.rightHeading || block.rightBody ? (
        <div>
          {block.rightHeading ? <h3 className="text-xl font-bold">{block.rightHeading}</h3> : null}
          {block.rightBody ? <p className="mt-2 text-base leading-relaxed opacity-80">{block.rightBody}</p> : null}
        </div>
      ) : null}
    </div>
  );

  const mediaColumn = img ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={img} alt={block.leftHeading || "Image"} className="h-full w-full object-cover" style={{ borderRadius: radius }} />
  ) : (
    <div className="flex min-h-40 items-center justify-center bg-black/5 text-sm opacity-50" style={{ borderRadius: radius }}>
      No image
    </div>
  );

  return (
    <section className="py-12">
      <Container>
        <div className={`grid grid-cols-1 items-center gap-8 ${gridCols}`}>
          {block.imageSide === "left" ? (
            <>
              {mediaColumn}
              {textColumn}
            </>
          ) : (
            <>
              {textColumn}
              {mediaColumn}
            </>
          )}
        </div>
      </Container>
    </section>
  );
}

function FeatureGridBlock({ block, theme }: { block: Extract<Block, { type: "featureGrid" }>; theme: Theme }) {
  const cols = block.columns === "2" ? "sm:grid-cols-2" : block.columns === "4" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  const radius = RADIUS_MAP[theme.borderRadius];
  return (
    <section className="py-14">
      <Container>
        <div className="flex flex-col items-center gap-2 text-center">
          {block.heading ? <h2 className="text-2xl font-bold sm:text-3xl">{block.heading}</h2> : null}
          {block.subheading ? <p className="max-w-2xl text-base opacity-70">{block.subheading}</p> : null}
        </div>
        <div className={`mt-10 grid grid-cols-1 gap-6 ${cols}`}>
          {block.features.map((f) => (
            <div key={f.id} className="flex flex-col gap-2 border border-black/10 p-5" style={{ borderRadius: radius }}>
              <div
                className="flex size-9 items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: theme.primaryColor, borderRadius: radius }}
                aria-hidden
              >
                {f.title.slice(0, 1).toUpperCase()}
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="text-sm opacity-70">{f.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function TestimonialBlock({ block, theme }: { block: Extract<Block, { type: "testimonial" }>; theme: Theme }) {
  const avatar = safeImageUrl(block.avatarUrl);
  return (
    <section className="py-14">
      <Container>
        <figure className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          <blockquote className="text-xl font-medium leading-relaxed sm:text-2xl">&ldquo;{block.quote}&rdquo;</blockquote>
          <figcaption className="flex items-center gap-3">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt={block.authorName} className="size-10 rounded-full object-cover" />
            ) : (
              <span
                className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: theme.primaryColor }}
                aria-hidden
              >
                {block.authorName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-left">
              <span className="block text-sm font-semibold">{block.authorName}</span>
              <span className="block text-sm opacity-60">{block.authorTitle}</span>
            </span>
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}

function FormBlock({ block, theme }: { block: Extract<Block, { type: "form" }>; theme: Theme }) {
  const radius = RADIUS_MAP[theme.borderRadius];
  return (
    <section className="py-14">
      <Container className="max-w-xl">
        <div className="flex flex-col gap-2 text-center">
          {block.heading ? <h2 className="text-2xl font-bold">{block.heading}</h2> : null}
          {block.description ? <p className="text-base opacity-70">{block.description}</p> : null}
        </div>
        <form className="mt-6 flex flex-col gap-4" method="post" action="#">
          {block.fields.map((field) => (
            <label key={field.id} className="flex flex-col gap-1 text-left text-sm font-medium">
              {field.label}
              {field.required ? <span className="sr-only"> (required)</span> : null}
              {field.fieldType === "textarea" ? (
                <textarea
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={4}
                  className="border border-black/15 px-3 py-2 text-sm outline-none"
                  style={{ borderRadius: radius }}
                />
              ) : (
                <input
                  type={field.fieldType}
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  className="border border-black/15 px-3 py-2 text-sm outline-none"
                  style={{ borderRadius: radius }}
                />
              )}
            </label>
          ))}
          <button
            type="submit"
            className="mt-2 inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: theme.primaryColor, borderRadius: radius }}
          >
            {block.submitLabel}
          </button>
        </form>
      </Container>
    </section>
  );
}

function SpacerBlock({ block }: { block: Extract<Block, { type: "spacer" }> }) {
  const height = block.height === "sm" ? "h-6" : block.height === "lg" ? "h-24" : block.height === "xl" ? "h-40" : "h-12";
  return <div className={height} aria-hidden />;
}

function DividerBlock({ block }: { block: Extract<Block, { type: "divider" }> }) {
  return (
    <div className="py-6">
      <Container>
        <hr className="border-t" style={{ borderTopStyle: block.style, borderColor: "rgba(0,0,0,0.15)" }} />
      </Container>
    </div>
  );
}

function FooterBlock({ block }: { block: Extract<Block, { type: "footer" }> }) {
  return (
    <footer className="border-t border-black/10 py-10">
      <Container>
        <div className="flex flex-col gap-1 text-center">
          {block.companyName ? <p className="text-base font-semibold">{block.companyName}</p> : null}
          {block.tagline ? <p className="text-sm opacity-70">{block.tagline}</p> : null}
          {block.copyright ? <p className="mt-2 text-xs opacity-50">{block.copyright}</p> : null}
        </div>
      </Container>
    </footer>
  );
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

function RenderBlock({ block, theme }: { block: Block; theme: Theme }) {
  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} theme={theme} />;
    case "text":
      return <TextBlock block={block} />;
    case "image":
      return <ImageBlock block={block} theme={theme} />;
    case "button":
      return <ButtonBlock block={block} theme={theme} />;
    case "twoColumn":
      return <TwoColumnBlock block={block} theme={theme} />;
    case "featureGrid":
      return <FeatureGridBlock block={block} theme={theme} />;
    case "testimonial":
      return <TestimonialBlock block={block} theme={theme} />;
    case "form":
      return <FormBlock block={block} theme={theme} />;
    case "spacer":
      return <SpacerBlock block={block} />;
    case "divider":
      return <DividerBlock block={block} />;
    case "footer":
      return <FooterBlock block={block} />;
    default:
      // Unknown block types are intentionally not rendered.
      return null;
  }
}

export function SiteRenderer({ schema, className }: { schema: PageSchema; className?: string }) {
  return (
    <div className={className} style={themeStyle(schema.theme)}>
      {schema.blocks.map((block) => (
        <RenderBlock key={block.id} block={block} theme={schema.theme} />
      ))}
    </div>
  );
}
