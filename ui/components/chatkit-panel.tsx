"use client";

import React from "react";
import { useEffect, useState } from "react";

type ChatKitPanelProps = {
  initialThreadId?: string | null;
  onThreadChange?: (threadId: string | null) => void;
  onResponseEnd?: (threadId?: string | null) => void;
  onRunnerUpdate?: () => void;
  onRunnerEventDelta?: (events: any[]) => void;
  onRunnerBindThread?: (threadId: string) => void;
};

const CHATKIT_DOMAIN_KEY =
  process.env.NEXT_PUBLIC_CHATKIT_DOMAIN_KEY ?? "domain_pk_localhost_dev";

type LocalMessage = {
  role: "user" | "assistant";
  text: string;
};

export function ChatKitPanel({
  initialThreadId,
  onThreadChange,
  onResponseEnd,
  onRunnerUpdate,
  onRunnerEventDelta,
  onRunnerBindThread,
}: ChatKitPanelProps) {
  const [quickInput, setQuickInput] = useState("");
  const [quickError, setQuickError] = useState<string | null>(null);
  const [chatReady, setChatReady] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId ?? null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const res = await fetch("/chatkit/bootstrap");
        if (!res.ok) return;
        const data = await res.json();
        const tid = (data?.thread_id as string | undefined) ?? null;
        if (!active || !tid) return;
        setThreadId(tid);
        onThreadChange?.(tid);
        onRunnerBindThread?.(tid);
      } catch {
        // Keep UI usable even if bootstrap request fails.
      }
    };
    void bootstrap();
    return () => {
      active = false;
    };
  }, [onRunnerBindThread, onThreadChange]);

  const extractAssistantText = (sseText: string): { reply: string; nextThreadId: string | null; eventsDelta: any[] } => {
    let reply = "";
    let nextThreadId: string | null = null;
    let eventsDelta: any[] = [];

    for (const rawLine of sseText.split("\n")) {
      const line = rawLine.trim();
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (!payload) continue;
      try {
        const evt = JSON.parse(payload) as any;
        if (evt?.type === "thread.created" && evt?.thread?.id) {
          nextThreadId = evt.thread.id as string;
        }
        if (evt?.type === "client_effect" && evt?.name === "runner_bind_thread" && evt?.data?.thread_id) {
          nextThreadId = evt.data.thread_id as string;
        }
        if (
          evt?.type === "thread.item.updated" &&
          evt?.update?.type === "assistant_message.content_part.text_delta" &&
          typeof evt?.update?.delta === "string"
        ) {
          reply += evt.update.delta;
        }
        if (
          evt?.type === "thread.item.done" &&
          evt?.item?.type === "assistant_message" &&
          Array.isArray(evt?.item?.content)
        ) {
          const doneText = evt.item.content
            .map((part: any) => (part?.type === "output_text" ? part?.text : ""))
            .filter(Boolean)
            .join("");
          if (doneText) reply = doneText;
        }
        if (evt?.type === "client_effect" && evt?.name === "runner_event_delta") {
          eventsDelta = evt?.data?.events ?? [];
        }
      } catch {
        // Skip malformed event chunks.
      }
    }

    return {
      reply: reply.trim(),
      nextThreadId,
      eventsDelta,
    };
  };

  const sendQuickMessage = async () => {
    const message = quickInput.trim();
    if (!message) return;
    setQuickError(null);
    setIsSending(true);
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    try {
      const isNewThread = !threadId;
      const requestBody = isNewThread
        ? {
            metadata: { domainKey: CHATKIT_DOMAIN_KEY },
            type: "threads.create",
            params: {
              input: {
                content: [{ type: "input_text", text: message }],
                attachments: [],
                inference_options: {},
              },
            },
          }
        : {
            metadata: { domainKey: CHATKIT_DOMAIN_KEY },
            type: "threads.add_user_message",
            params: {
              thread_id: threadId,
              input: {
                content: [{ type: "input_text", text: message }],
                attachments: [],
                inference_options: {},
              },
            },
          };

      const res = await fetch("/chatkit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) {
        throw new Error(`Send failed (${res.status})`);
      }

      const sseText = await res.text();
      const parsed = extractAssistantText(sseText);
      const nextTid = parsed.nextThreadId ?? threadId;
      if (nextTid && nextTid !== threadId) {
        setThreadId(nextTid);
        onThreadChange?.(nextTid);
        onRunnerBindThread?.(nextTid);
      }

      if (parsed.eventsDelta.length > 0) {
        onRunnerEventDelta?.(parsed.eventsDelta);
      }
      onRunnerUpdate?.();
      onResponseEnd?.(nextTid);

      const assistantReply = parsed.reply || "I processed your request, but no assistant text was returned.";
      setMessages((prev) => [...prev, { role: "assistant", text: assistantReply }]);
      setQuickInput("");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Failed to send message";
      setQuickError(text);
      console.error("Direct send failed", err);
    } finally {
      setIsSending(false);
    }
  };

  const onQuickInputKeyDown: React.KeyboardEventHandler<HTMLInputElement> =
    async (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      await sendQuickMessage();
    };

  return (
    <div className="flex flex-col h-full flex-1 bg-white shadow-sm border border-gray-200 border-t-0 rounded-xl">
      <div className="bg-blue-600 text-white h-12 px-4 flex items-center rounded-t-xl">
        <h2 className="font-semibold text-sm sm:text-base lg:text-lg">
          Customer View
        </h2>
      </div>
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <p className="text-xs text-zinc-600 mb-2">
          Triage is the entrypoint. Send any request and it will hand off to Seat and Special Services, Booking, Flight Information, FAQ, or Refunds as needed.
        </p>
        <p className="text-[11px] text-zinc-500 mb-2">
          Chat status: {chatReady ? "ready (direct mode)" : "initializing"}
        </p>
        <div className="flex items-center gap-2">
          <input
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            onKeyDown={onQuickInputKeyDown}
            placeholder="Ask a question (fallback input)..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSending}
          />
          <button
            type="button"
            onClick={sendQuickMessage}
            disabled={isSending}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
        {quickError && (
          <p className="mt-2 text-xs text-red-600">{quickError}</p>
        )}
      </div>
      <div className="flex-1 overflow-auto p-3 bg-white">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">Send a message to start the conversation.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((m, idx) => (
              <div
                key={`${m.role}-${idx}`}
                className={`rounded-md px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-blue-50 border border-blue-100"
                    : "bg-zinc-50 border border-zinc-200"
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {m.role}
                </p>
                <p className="whitespace-pre-wrap text-zinc-800">{m.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
