/**
 * Google Calendar API helper module.
 *
 * Zero external dependencies — uses native fetch only.
 * Token storage is encrypted via lib/crypto.ts (AES-256-GCM).
 *
 * Base URL: https://www.googleapis.com/calendar/v3
 * Token refresh endpoint: https://oauth2.googleapis.com/token
 */

import { prisma } from "@/lib/prisma";
import { encryptObject, decryptObject, type EncryptedBlob } from "@/lib/crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GoogleTokenBlob = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // Unix ms
  email: string;
  calendarId: string; // "primary" by default
};

export type GoogleCalendarEvent = {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: Array<{ email: string }>;
};

export type GoogleCreatedEvent = GoogleCalendarEvent & {
  id: string;
  htmlLink?: string;
  status?: string;
};

export type BusySlot = {
  start: string;
  end: string;
};

const GCal = "https://www.googleapis.com/calendar/v3";

// ─────────────────────────────────────────────────────────────────────────────
// Token helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Reads the stored UserOAuthToken for a user and returns the decrypted blob, or null. */
export async function getUserToken(userId: string): Promise<GoogleTokenBlob | null> {
  const record = await prisma.userOAuthToken.findUnique({
    where: { userId_provider: { userId, provider: "google_calendar" } },
  });
  if (!record) return null;

  try {
    const blob = decryptObject<GoogleTokenBlob>({
      encryptedData: record.encryptedData,
      iv: record.iv,
      authTag: record.authTag,
    });
    return blob;
  } catch (err) {
    console.error("[google-calendar] Failed to decrypt token for user", userId, err);
    return null;
  }
}

/**
 * Returns a valid access token for the given user.
 * If the token expires within 5 minutes, it is refreshed automatically.
 * Returns null if the user has no connected Google account or refresh fails.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const tokenBlob = await getUserToken(userId);
  if (!tokenBlob) return null;

  const fiveMinMs = 5 * 60 * 1000;
  const needsRefresh = tokenBlob.expiresAt - Date.now() < fiveMinMs;

  if (!needsRefresh) {
    return tokenBlob.accessToken;
  }

  if (!tokenBlob.refreshToken) {
    console.error("[google-calendar] Token expired and no refresh token available for user", userId);
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[google-calendar] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured");
    return null;
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenBlob.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[google-calendar] Token refresh failed", res.status, body);
      return null;
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    const newBlob: GoogleTokenBlob = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokenBlob.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
      email: tokenBlob.email,
      calendarId: tokenBlob.calendarId,
    };

    const encrypted = encryptObject(newBlob);
    await prisma.userOAuthToken.update({
      where: { userId_provider: { userId, provider: "google_calendar" } },
      data: {
        encryptedData: encrypted.encryptedData,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        expiresAt: new Date(newBlob.expiresAt),
      },
    });

    return newBlob.accessToken;
  } catch (err) {
    console.error("[google-calendar] Exception during token refresh", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar API helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Creates a new event on the user's primary calendar. Returns the created event (with id). */
export async function createCalendarEvent(
  accessToken: string,
  event: GoogleCalendarEvent
): Promise<GoogleCreatedEvent> {
  const res = await fetch(`${GCal}/calendars/primary/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[google-calendar] createCalendarEvent failed: ${res.status} ${body}`);
  }

  return res.json() as Promise<GoogleCreatedEvent>;
}

/** Updates an existing event by PATCH. Returns the updated event. */
export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  event: Partial<GoogleCalendarEvent>
): Promise<GoogleCreatedEvent> {
  const res = await fetch(`${GCal}/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[google-calendar] updateCalendarEvent failed: ${res.status} ${body}`);
  }

  return res.json() as Promise<GoogleCreatedEvent>;
}

/** Deletes an event by ID. No-ops silently if the event is already gone (404). */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(`${GCal}/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const body = await res.text();
    throw new Error(`[google-calendar] deleteCalendarEvent failed: ${res.status} ${body}`);
  }
}

/**
 * Returns busy windows for a calendar within the given time range.
 * Uses the Google Calendar FreeBusy API.
 */
export async function listBusySlots(
  accessToken: string,
  calendarId: string,
  timeMin: string, // ISO 8601
  timeMax: string  // ISO 8601
): Promise<BusySlot[]> {
  const res = await fetch(`${GCal}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: calendarId }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[google-calendar] listBusySlots failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
  };

  return data.calendars?.[calendarId]?.busy ?? [];
}
