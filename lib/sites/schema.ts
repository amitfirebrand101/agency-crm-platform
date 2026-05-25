import { z } from "zod";

// ─── Shared primitives ──────────────────────────────────────────────────────

const Alignment = z.enum(["left", "center", "right"]);
const AspectRatio = z.enum(["auto", "square", "video", "wide"]);
const ButtonVariant = z.enum(["primary", "secondary", "outline"]);
const ColumnRatio = z.enum(["1:1", "1:2", "2:1"]);

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `blk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// ─── Block schemas ──────────────────────────────────────────────────────────

export const HeroBlockSchema = z.object({
  id: z.string(),
  type: z.literal("hero"),
  eyebrow: z.string(),
  heading: z.string(),
  body: z.string(),
  primaryButtonLabel: z.string(),
  primaryButtonHref: z.string(),
  secondaryButtonLabel: z.string(),
  secondaryButtonHref: z.string(),
  imageUrl: z.string(),
  alignment: z.enum(["left", "center"]),
});

export const TextBlockSchema = z.object({
  id: z.string(),
  type: z.literal("text"),
  heading: z.string(),
  body: z.string(),
  alignment: Alignment,
});

export const ImageBlockSchema = z.object({
  id: z.string(),
  type: z.literal("image"),
  imageUrl: z.string(),
  alt: z.string(),
  caption: z.string(),
  aspectRatio: AspectRatio,
});

export const ButtonBlockSchema = z.object({
  id: z.string(),
  type: z.literal("button"),
  label: z.string(),
  href: z.string(),
  variant: ButtonVariant,
  alignment: Alignment,
});

export const TwoColumnBlockSchema = z.object({
  id: z.string(),
  type: z.literal("twoColumn"),
  ratio: ColumnRatio,
  leftHeading: z.string(),
  leftBody: z.string(),
  rightHeading: z.string(),
  rightBody: z.string(),
  imageUrl: z.string(),
  imageSide: z.enum(["left", "right"]),
});

export const FeatureItemSchema = z.object({
  id: z.string(),
  icon: z.string(),
  title: z.string(),
  description: z.string(),
});

export const FeatureGridBlockSchema = z.object({
  id: z.string(),
  type: z.literal("featureGrid"),
  heading: z.string(),
  subheading: z.string(),
  columns: z.enum(["2", "3", "4"]),
  features: z.array(FeatureItemSchema),
});

export const TestimonialBlockSchema = z.object({
  id: z.string(),
  type: z.literal("testimonial"),
  quote: z.string(),
  authorName: z.string(),
  authorTitle: z.string(),
  avatarUrl: z.string(),
});

export const FormFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  name: z.string(),
  fieldType: z.enum(["text", "email", "tel", "textarea"]),
  placeholder: z.string(),
  required: z.boolean(),
});

export const FormBlockSchema = z.object({
  id: z.string(),
  type: z.literal("form"),
  heading: z.string(),
  description: z.string(),
  submitLabel: z.string(),
  successMessage: z.string(),
  fields: z.array(FormFieldSchema),
});

export const SpacerBlockSchema = z.object({
  id: z.string(),
  type: z.literal("spacer"),
  height: z.enum(["sm", "md", "lg", "xl"]),
});

export const DividerBlockSchema = z.object({
  id: z.string(),
  type: z.literal("divider"),
  style: z.enum(["solid", "dashed", "dotted"]),
});

export const FooterBlockSchema = z.object({
  id: z.string(),
  type: z.literal("footer"),
  companyName: z.string(),
  tagline: z.string(),
  copyright: z.string(),
});

// ─── Discriminated union ─────────────────────────────────────────────────────

export const BlockSchema = z.discriminatedUnion("type", [
  HeroBlockSchema,
  TextBlockSchema,
  ImageBlockSchema,
  ButtonBlockSchema,
  TwoColumnBlockSchema,
  FeatureGridBlockSchema,
  TestimonialBlockSchema,
  FormBlockSchema,
  SpacerBlockSchema,
  DividerBlockSchema,
  FooterBlockSchema,
]);

export type Block = z.infer<typeof BlockSchema>;
export type BlockType = Block["type"];
export type FeatureItem = z.infer<typeof FeatureItemSchema>;
export type FormFieldConfig = z.infer<typeof FormFieldSchema>;

// ─── Theme + page ────────────────────────────────────────────────────────────

export const ThemeSchema = z.object({
  fontFamily: z.string(),
  primaryColor: z.string(),
  backgroundColor: z.string(),
  textColor: z.string(),
  borderRadius: z.enum(["none", "sm", "md", "lg"]),
});

export type Theme = z.infer<typeof ThemeSchema>;

export const PageSchemaZ = z.object({
  version: z.literal(1),
  theme: ThemeSchema,
  blocks: z.array(BlockSchema),
});

export type PageSchema = z.infer<typeof PageSchemaZ>;

export function validatePageSchema(data: unknown): PageSchema {
  const result = PageSchemaZ.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid page schema: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  return result.data;
}

export const DEFAULT_THEME: Theme = {
  fontFamily: "Inter, system-ui, sans-serif",
  primaryColor: "#4f46e5",
  backgroundColor: "#ffffff",
  textColor: "#0f172a",
  borderRadius: "md",
};

export const DEFAULT_PAGE_SCHEMA: PageSchema = {
  version: 1,
  theme: DEFAULT_THEME,
  blocks: [],
};

// ─── Block catalog ──────────────────────────────────────────────────────────

export type BlockCategory = "Layout" | "Content" | "Media" | "Interactive";

export const BLOCK_CATALOG: {
  type: BlockType;
  label: string;
  description: string;
  icon: string;
  category: BlockCategory;
  defaultProps: Omit<Block, "id" | "type">;
}[] = [
  {
    type: "hero",
    label: "Hero",
    description: "Large headline with call-to-action buttons.",
    icon: "Megaphone",
    category: "Content",
    defaultProps: {
      eyebrow: "Welcome",
      heading: "Build something people love",
      body: "A short supporting sentence that explains your value proposition clearly.",
      primaryButtonLabel: "Get started",
      primaryButtonHref: "https://example.com",
      secondaryButtonLabel: "Learn more",
      secondaryButtonHref: "https://example.com",
      imageUrl: "",
      alignment: "center",
    } satisfies Omit<z.infer<typeof HeroBlockSchema>, "id" | "type">,
  },
  {
    type: "text",
    label: "Text",
    description: "A heading and paragraph of body copy.",
    icon: "Type",
    category: "Content",
    defaultProps: {
      heading: "Section heading",
      body: "Write your paragraph here. Use this block for general content and storytelling.",
      alignment: "left",
    } satisfies Omit<z.infer<typeof TextBlockSchema>, "id" | "type">,
  },
  {
    type: "image",
    label: "Image",
    description: "A single responsive image with optional caption.",
    icon: "Image",
    category: "Media",
    defaultProps: {
      imageUrl: "",
      alt: "Descriptive alt text",
      caption: "",
      aspectRatio: "video",
    } satisfies Omit<z.infer<typeof ImageBlockSchema>, "id" | "type">,
  },
  {
    type: "button",
    label: "Button",
    description: "A single call-to-action button.",
    icon: "MousePointerClick",
    category: "Interactive",
    defaultProps: {
      label: "Click me",
      href: "https://example.com",
      variant: "primary",
      alignment: "center",
    } satisfies Omit<z.infer<typeof ButtonBlockSchema>, "id" | "type">,
  },
  {
    type: "twoColumn",
    label: "Two Column",
    description: "Side-by-side text and image columns.",
    icon: "Columns2",
    category: "Layout",
    defaultProps: {
      ratio: "1:1",
      leftHeading: "Left column",
      leftBody: "Describe a benefit or feature here.",
      rightHeading: "Right column",
      rightBody: "Describe another benefit or feature here.",
      imageUrl: "",
      imageSide: "right",
    } satisfies Omit<z.infer<typeof TwoColumnBlockSchema>, "id" | "type">,
  },
  {
    type: "featureGrid",
    label: "Feature Grid",
    description: "A grid of feature cards with icons.",
    icon: "Grid3x3",
    category: "Content",
    defaultProps: {
      heading: "Everything you need",
      subheading: "A short description of your feature set.",
      columns: "3",
      features: [
        { id: "f1", icon: "Zap", title: "Fast", description: "Blazing fast performance out of the box." },
        { id: "f2", icon: "Shield", title: "Secure", description: "Enterprise-grade security built in." },
        { id: "f3", icon: "Sparkles", title: "Simple", description: "An intuitive experience for everyone." },
      ],
    } satisfies Omit<z.infer<typeof FeatureGridBlockSchema>, "id" | "type">,
  },
  {
    type: "testimonial",
    label: "Testimonial",
    description: "A customer quote with attribution.",
    icon: "Quote",
    category: "Content",
    defaultProps: {
      quote: "This product completely transformed how our team works.",
      authorName: "Jane Doe",
      authorTitle: "CEO, Acme Inc.",
      avatarUrl: "",
    } satisfies Omit<z.infer<typeof TestimonialBlockSchema>, "id" | "type">,
  },
  {
    type: "form",
    label: "Form",
    description: "A lead capture form with custom fields.",
    icon: "FormInput",
    category: "Interactive",
    defaultProps: {
      heading: "Get in touch",
      description: "Fill out the form and we will get back to you shortly.",
      submitLabel: "Submit",
      successMessage: "Thanks! We will be in touch soon.",
      fields: [
        { id: "name", label: "Name", name: "name", fieldType: "text", placeholder: "Your name", required: true },
        { id: "email", label: "Email", name: "email", fieldType: "email", placeholder: "you@example.com", required: true },
      ],
    } satisfies Omit<z.infer<typeof FormBlockSchema>, "id" | "type">,
  },
  {
    type: "spacer",
    label: "Spacer",
    description: "Adds vertical whitespace between blocks.",
    icon: "MoveVertical",
    category: "Layout",
    defaultProps: {
      height: "md",
    } satisfies Omit<z.infer<typeof SpacerBlockSchema>, "id" | "type">,
  },
  {
    type: "divider",
    label: "Divider",
    description: "A horizontal rule separating sections.",
    icon: "Minus",
    category: "Layout",
    defaultProps: {
      style: "solid",
    } satisfies Omit<z.infer<typeof DividerBlockSchema>, "id" | "type">,
  },
  {
    type: "footer",
    label: "Footer",
    description: "A simple footer with company info.",
    icon: "PanelBottom",
    category: "Layout",
    defaultProps: {
      companyName: "Your Company",
      tagline: "Building the future, one page at a time.",
      copyright: `© ${new Date().getFullYear()} Your Company. All rights reserved.`,
    } satisfies Omit<z.infer<typeof FooterBlockSchema>, "id" | "type">,
  },
];

export function makeBlock(type: BlockType): Block {
  const entry = BLOCK_CATALOG.find((b) => b.type === type);
  if (!entry) {
    throw new Error(`Unknown block type: ${type}`);
  }
  // Deep-clone default props and give nested array items fresh ids.
  const props = structuredCloneSafe(entry.defaultProps);
  if ("features" in props && Array.isArray(props.features)) {
    props.features = props.features.map((f) => ({ ...f, id: uid() }));
  }
  if ("fields" in props && Array.isArray(props.fields)) {
    props.fields = props.fields.map((f) => ({ ...f, id: uid() }));
  }
  return { id: uid(), type, ...props } as Block;
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function makeFeatureItem(): FeatureItem {
  return { id: uid(), icon: "Sparkles", title: "New feature", description: "Describe this feature." };
}

export function makeFormField(): FormFieldConfig {
  return { id: uid(), label: "New field", name: "field", fieldType: "text", placeholder: "", required: false };
}
