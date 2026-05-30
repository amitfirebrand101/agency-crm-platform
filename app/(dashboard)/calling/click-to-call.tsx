"use client";

import { useState, useEffect, useRef, useTransition } from "react";

type CallStatus = "idle" | "connecting" | "in-call" | "ended" | "error";

interface VoiceTokenResponse {
  token: string;
  identity: string;
  expiresIn: number;
}

export function ClickToCall({ voiceReady }: { voiceReady: boolean }) {
  if (!voiceReady) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Voice not configured</p>
        <p className="text-sm text-muted">
          To enable browser-based calling, add the following environment variables:
        </p>
        <ul className="space-y-1 text-sm font-mono text-muted">
          <li>TWILIO_API_KEY</li>
          <li>TWILIO_API_SECRET</li>
          <li>TWILIO_TWIML_APP_SID</li>
        </ul>
        <p className="text-xs text-muted">
          Create an API Key and TwiML App in your{" "}
          <a
            className="text-primary underline"
            href="https://console.twilio.com"
            rel="noreferrer"
            target="_blank"
          >
            Twilio Console
          </a>
          .
        </p>
      </div>
    );
  }

  return <DialPad />;
}

function DialPad() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [, startTransition] = useTransition();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function initDevice() {
      try {
        const res = await fetch("/api/calling/token");
        if (!res.ok) throw new Error("Failed to fetch voice token.");
        const data: VoiceTokenResponse = await res.json();

        const { Device } = await import("@twilio/voice-sdk");
        const device = new Device(data.token, { logLevel: 1 });

        device.on("incoming", (call: { accept: () => void }) => {
          callRef.current = call;
          setStatus("in-call");
          call.accept();
        });

        device.on("error", (err: Error) => {
          setErrorMessage(err.message ?? "Device error.");
          setStatus("error");
        });

        await device.register();

        if (!cancelled) {
          deviceRef.current = device;
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to initialise voice device.";
          if (msg.includes("microphone") || msg.includes("permission")) {
            setErrorMessage("Microphone permission denied. Please allow microphone access and reload.");
          } else {
            setErrorMessage(msg);
          }
          setStatus("error");
        }
      }
    }

    startTransition(() => { void initDevice(); });

    return () => {
      cancelled = true;
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCall() {
    if (!deviceRef.current || !phoneNumber.trim()) return;
    setStatus("connecting");
    setErrorMessage(null);
    try {
      const call = await deviceRef.current.connect({
        params: { To: phoneNumber.trim() },
      });
      callRef.current = call;
      call.on("accept", () => setStatus("in-call"));
      call.on("disconnect", () => setStatus("ended"));
      call.on("error", (err: Error) => {
        setErrorMessage(err.message ?? "Call error.");
        setStatus("error");
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to place call.");
      setStatus("error");
    }
  }

  function handleHangUp() {
    callRef.current?.disconnect();
    callRef.current = null;
    setStatus("ended");
  }

  const statusLabel: Record<CallStatus, string> = {
    idle: "Ready",
    connecting: "Connecting…",
    "in-call": "In call",
    ended: "Call ended",
    error: "Error",
  };

  const statusColor: Record<CallStatus, string> = {
    idle: "text-muted",
    connecting: "text-amber-600",
    "in-call": "text-green-600",
    ended: "text-muted",
    error: "text-red-600",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${statusColor[status]}`}>
          {statusLabel[status]}
        </span>
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <input
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
        disabled={status === "connecting" || status === "in-call"}
        onChange={(e) => setPhoneNumber(e.target.value)}
        placeholder="+15550123456"
        type="tel"
        value={phoneNumber}
      />

      <div className="flex gap-2">
        <button
          className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={!phoneNumber.trim() || status === "connecting" || status === "in-call" || !deviceRef.current}
          onClick={() => void handleCall()}
          type="button"
        >
          Call
        </button>
        <button
          className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={status !== "in-call" && status !== "connecting"}
          onClick={handleHangUp}
          type="button"
        >
          Hang up
        </button>
      </div>

      <p className="text-xs text-muted">
        Calls are placed using Twilio Voice SDK directly from your browser. Microphone access is
        required.
      </p>
    </div>
  );
}
