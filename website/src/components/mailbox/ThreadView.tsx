"use client";

import { useState } from "react";
import type { MailboxThread } from "./types";
import { useI18n } from "@/i18n/client";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ThreadView({ thread, currentUserId, onReplySent }: {
  thread: MailboxThread;
  currentUserId: string;
  onReplySent: () => void;
}) {
  const { t } = useI18n();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    setError("");
    const response = await fetch("/api/mailbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: thread.threadId, body: reply.trim() })
    });
    setSending(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? t("mailbox.sendFailed"));
      return;
    }
    setReply("");
    onReplySent();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-lg font-bold text-textBright">{thread.subject}</h2>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {thread.messages.map((message) => (
          <div key={message.id} className={`max-w-lg rounded-xl border border-border p-3 ${message.senderId === currentUserId ? "ml-auto bg-accentDim" : "bg-cardDeep"}`}>
            <div className="flex items-center justify-between gap-3 text-xs text-textMuted">
              <span className="font-semibold text-textSecondary">{message.senderName}</span>
              <span>{formatDate(message.createdAt)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-textPrimary">{message.body}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-4">
        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={2}
            className="flex-1 rounded-xl border border-border bg-input px-3 py-2 text-textPrimary"
            placeholder={t("mailbox.replyPlaceholder")}
          />
          <button type="button" onClick={() => void sendReply()} disabled={sending || !reply.trim()} className="self-end rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page hover:opacity-90 disabled:opacity-50">
            {sending ? "..." : t("mailbox.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
