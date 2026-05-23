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
  source: z.string().trim().max(80).optional(),
  status: z.enum(["LEAD", "CUSTOMER", "INACTIVE"]).optional()
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

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(10000),
  direction: z.enum(["inbound", "outbound", "internal"])
});

export const appointmentSchema = z.object({
  calendarId: z.string().uuid(),
  contactId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(1).max(200),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1)
});

export const agencySchema = z.object({
  name: z.string().trim().min(2).max(100),
  timezone: z.string().trim().max(64).optional(),
  currency: z.string().trim().length(3).optional(),
  country: z.string().trim().length(2).optional()
});
