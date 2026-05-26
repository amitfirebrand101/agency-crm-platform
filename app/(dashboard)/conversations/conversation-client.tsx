"use client";

import { useState, useTransition } from "react";
import { Send, Download, Search, ChevronDown, MessageSquareQuote } from "lucide-react";
import type { setConversationPriority } from "./conversation-actions";

// ── Priority selector ──────────────────────────────────────────────────────────

type PrioritySelectorProps = {
  conversationId: string;
  priority: string;
  action: typeof setConversationPriority;
};

export function PrioritySelector({ conversationId, priority, action }: PrioritySelectorProps) {
  const [current, setCurrent] = useState(priority);
  const [, startTransition] = useTransition();

  function handleChange(value: string) {
    setCurrent(value);
    const fd = new FormData();
    fd.set("conversationId", conversationId);
    fd.set("priority", value);
    startTransition(() => action(fd));
  }

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      className={`rounded px-2 py-1 text-xs font-semibold border ${
        current === "urgent"
          ? "border-red-300 bg-red-50 text-red-700"
          : current === "high"
          ? "border-amber-300 bg-amber-50 text-amber-700"
          : "border-border bg-background text-muted"
      }`}
    >
      <option value="normal">Normal</option>
      <option value="high">High</option>
      <option value="urgent">Urgent</option>
    </select>
  );
}

// ── Message thread + compose ───────────────────────────────────────────────────

type Message = {
  id: string;
  body: string;
  direction: string;
  createdAt: string;
};

type CannedResponse = {
  id: string;
  name: string;
  body: string;
};

type ConversationClientProps = {
  conversation: {
    id: string;
    messages: Message[];
  };
  cannedResponses: CannedResponse[];
  sendMessageAction: (formData: FormData) => Promise<void>;
};

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-yellow-200 px-0.5 text-yellow-900">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function ConversationClient({ conversation, cannedResponses, sendMessageAction }: ConversationClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [body, setBody] = useState("");
  const [showCanned, setShowCanned] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filteredMessages = searchQuery.trim()
    ? conversation.messages.filter((m) => m.body.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversation.messages;

  function handleExport() {
    const lines = conversation.messages.map(
      (m) =>
        `[${new Date(m.createdAt).toLocaleString()}] ${m.direction === "outbound" ? "You" : "Contact"}: ${m.body}`
    );
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${conversation.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim() || isPending) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await sendMessageAction(fd);
      setBody("");
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Thread toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-4 py-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" size={12} />
          <input
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs outline-none ring-primary/20 focus:ring-2"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in thread…"
            type="search"
            value={searchQuery}
          />
        </div>
        {searchQuery.trim() && (
          <span className="text-xs text-muted">
            {filteredMessages.length} result{filteredMessages.length !== 1 ? "s" : ""}
          </span>
        )}
        <button
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
          onClick={handleExport}
          type="button"
        >
          <Download size={12} />
          Export
        </button>
      </div>

      {/* Message thread */}
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {filteredMessages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            {searchQuery.trim() ? `No messages match "${searchQuery}"` : "No messages yet. Send the first one below."}
          </p>
        ) : (
          filteredMessages.map((m) => (
            <div
              className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
              key={m.id}
            >
              <div
                className={`max-w-[72%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.direction === "outbound"
                    ? "rounded-br-sm bg-primary text-white"
                    : m.direction === "inbound"
                    ? "rounded-bl-sm border border-border bg-background"
                    : "rounded border border-amber-200 bg-amber-50 text-xs italic text-amber-900"
                }`}
              >
                <p className="whitespace-pre-wrap break-words leading-relaxed">
                  {highlight(m.body, searchQuery)}
                </p>
                <p
                  className={`mt-1 text-[10px] ${
                    m.direction === "outbound" ? "text-white/60" : "text-muted"
                  }`}
                >
                  {new Date(m.createdAt).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Compose */}
      <div className="shrink-0 border-t border-border bg-panel px-4 py-3">
        <form className="flex flex-col gap-2" onSubmit={handleSend}>
          <input name="conversationId" type="hidden" value={conversation.id} />
          <input name="direction" type="hidden" value="outbound" />
          <textarea
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
            name="body"
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Type a message… (⌘↵ to send)"
            rows={3}
            value={body}
          />

          <div className="flex items-center gap-2">
            {cannedResponses.length > 0 && (
              <div className="relative">
                <button
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                  onClick={() => setShowCanned((v) => !v)}
                  type="button"
                >
                  <MessageSquareQuote size={12} />
                  Templates
                  <ChevronDown size={10} />
                </button>
                {showCanned && (
                  <div className="absolute bottom-full left-0 z-10 mb-1 max-h-52 w-64 overflow-y-auto rounded-lg border border-border bg-panel shadow-lg">
                    {cannedResponses.map((cr) => (
                      <button
                        className="w-full px-3 py-2.5 text-left transition hover:bg-background"
                        key={cr.id}
                        onClick={() => {
                          setBody(cr.body);
                          setShowCanned(false);
                        }}
                        type="button"
                      >
                        <p className="text-xs font-semibold text-foreground">{cr.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">{cr.body}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
              disabled={isPending || !body.trim()}
              type="submit"
            >
              <Send size={14} />
              {isPending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
