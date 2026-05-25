import nodemailer from "nodemailer";

export function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  if (!emailConfigured()) throw new Error("SMTP not configured.");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  });
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<string> {
  const transport = getTransport();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
  const info = await transport.sendMail({ from, ...opts });
  return (info.messageId as string) ?? "";
}

export async function sendAppointmentConfirmation(opts: {
  to: string;
  contactName: string;
  calendarName: string;
  startsAt: Date;
  timezone: string;
  location?: string;
  conferenceUrl?: string;
  cancelUrl?: string;
  rescheduleUrl?: string;
}) {
  const dateStr = opts.startsAt.toLocaleString("en-US", {
    timeZone: opts.timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const locationLine = opts.conferenceUrl
    ? `<p><strong>Join:</strong> <a href="${opts.conferenceUrl}">${opts.conferenceUrl}</a></p>`
    : opts.location
    ? `<p><strong>Location:</strong> ${opts.location}</p>`
    : "";

  const manageLine = [
    opts.rescheduleUrl
      ? `<a href="${opts.rescheduleUrl}" style="margin-right:12px">Reschedule</a>`
      : "",
    opts.cancelUrl ? `<a href="${opts.cancelUrl}">Cancel</a>` : "",
  ]
    .filter(Boolean)
    .join("");

  const html = `
    <h2>Appointment Confirmed</h2>
    <p>Hi ${opts.contactName},</p>
    <p>Your appointment with <strong>${opts.calendarName}</strong> has been confirmed.</p>
    <p><strong>Date &amp; Time:</strong> ${dateStr} (${opts.timezone})</p>
    ${locationLine}
    ${manageLine ? `<p style="margin-top:16px">${manageLine}</p>` : ""}
  `;

  await sendEmail({
    to: opts.to,
    subject: `Appointment Confirmed — ${opts.calendarName}`,
    html,
  });
}

export async function sendAppointmentReminder(opts: {
  to: string;
  contactName: string;
  calendarName: string;
  startsAt: Date;
  timezone: string;
  location?: string;
  conferenceUrl?: string;
  cancelUrl?: string;
}) {
  const dateStr = opts.startsAt.toLocaleString("en-US", {
    timeZone: opts.timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const locationLine = opts.conferenceUrl
    ? `<p><strong>Join:</strong> <a href="${opts.conferenceUrl}">${opts.conferenceUrl}</a></p>`
    : opts.location
    ? `<p><strong>Location:</strong> ${opts.location}</p>`
    : "";

  await sendEmail({
    to: opts.to,
    subject: `Reminder: ${opts.calendarName} appointment coming up`,
    html: `
      <h2>Upcoming Appointment Reminder</h2>
      <p>Hi ${opts.contactName},</p>
      <p>This is a reminder for your appointment with <strong>${opts.calendarName}</strong>.</p>
      <p><strong>Date &amp; Time:</strong> ${dateStr} (${opts.timezone})</p>
      ${locationLine}
      ${opts.cancelUrl ? `<p><a href="${opts.cancelUrl}">Cancel appointment</a></p>` : ""}
    `,
  });
}
