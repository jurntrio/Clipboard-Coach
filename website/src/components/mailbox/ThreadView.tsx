"use client";

import { useState } from "react";
import type { MailboxThread } from "./types";
import { useI18n } from "@/i18n/client";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ThreadView({ thread, currentUserId, onReplySent, onDeleted }: {
  thread: MailboxThread;
  currentUserId: string;
  onReplySent: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function deleteThread() {
    setDeleting(true);
    setError("");
    const response = await fetch(`/api/mailbox/${thread.threadId}`, { method: "DELETE" });
    setDeleting(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? t("mailbox.deleteFailed"));
      setConfirmDelete(false);
      return;
    }
    setConfirmDelete(false);
    onDeleted();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="text-lg font-bold text-textBright">{thread.subject}</h2>
        <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg border border-red-500/50 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10">
          {t("mailbox.delete")}
        </button>
      </div>
      <div className="flex-1 divide-y divide-border overflow-y-auto">
        {thread.messages.map((message) => (
          <article key={message.id} className={`p-5 ${message.senderId === currentUserId ? "bg-accentDim/40" : "bg-cardDeep"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-textMuted">
              <span><span className="mr-1">{t("mailbox.from")}:</span><strong className="text-textPrimary">{message.senderName}</strong>{message.senderId === currentUserId && <span className="ml-2 text-accent">· jij</span>}</span>
              <span>{formatDate(message.createdAt)}</span>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-textPrimary">{message.body}</p>
            {message.senderId === currentUserId && message.recipients.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-2 text-xs text-textMuted">
                <span>{t("mailbox.recipients")}:</span>
                {message.recipients.map((recipient, index) => (
                  <span key={recipient.profileId} className={recipient.readAt ? "not-italic" : "italic"} title={recipient.readAt ? t("mailbox.read") : t("mailbox.unread")}>
                    {recipient.name}{recipient.readAt ? ` ${t("mailbox.readMark")}` : ""}{index < message.recipients.length - 1 ? "," : ""}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="border-t border-border p-4">
        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
        <label className="mb-2 block text-sm font-semibold text-textSecondary">{t("mailbox.reply")}</label>
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
      <ConfirmDialog
        open={confirmDelete}
        title={t("mailbox.deleteTitle")}
        message={t("mailbox.deleteMessage")}
        confirmLabel={t("mailbox.delete")}
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void deleteThread()}
      />
    </div>
  );
}
