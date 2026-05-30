/**
 * Generates a Twilio Voice SDK access token for the authenticated user.
 * GET /api/calling/token
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { voiceConfigured, generateVoiceToken } from "@/lib/twilio";

export async function GET() {
  const user = await requireUser();

  if (!voiceConfigured()) {
    return NextResponse.json(
      { error: "Voice not configured" },
      { status: 404 }
    );
  }

  try {
    const token = generateVoiceToken(user.id);
    return NextResponse.json({
      token,
      identity: user.id,
      expiresIn: 3600,
    });
  } catch (err) {
    console.error("[calling/token] Failed to generate voice token:", err);
    return NextResponse.json(
      { error: "Failed to generate voice token" },
      { status: 500 }
    );
  }
}
