import { z } from "zod";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.");

export const subAccountSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug,
  city: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional()
});

export const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional(),
  companyName: z.string().trim().max(120).optional(),
  source: z.string().trim().max(80).optional()
});

export const tagSchema = z.object({
  name: z.string().trim().min(1).max(48),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/)
});

export const customFieldSchema = z.object({
  name: z.string().trim().min(2).max(80),
  key: slug,
  type: z.enum(["TEXT", "NUMBER", "DATE", "SELECT", "BOOLEAN", "URL"]),
  required: z.coerce.boolean().default(false)
});
