"use client";

import { useState } from "react";
import type { MailboxThread } from "./types";
import { useI18n } from "@/i18n/client";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("nl-BE", {
    weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

export function ThreadView({ thread, currentUserId, onReplySent, onForward, onDeleted }: {
  thread: MailboxThread;
  currentUserId: string;
  onReplySent: () => void;
  onForward: (subject: string, body: string) => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [reply, setReply] = useState("");
  const [replyMode, setReplyMode] = useState<"reply" | "replyAll" | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const lastMessage = thread.messages[thread.messages.length - 1];
  const systemMessage = !lastMessage?.senderId;

  async function sendReply() {
    if (!reply.trim() || !replyMode) return;
    setSending(true);
    setError("");
    const response = await fetch("/api/mailbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: thread.threadId, body: reply.trim(), replyMode })
    });
    setSending(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? t("mailbox.sendFailed"));
      return;
    }
    setReply("");
    setReplyMode(null);
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

  function forward() {
    if (!lastMessage) return;
    onForward(
      thread.subject.startsWith("Fwd:") ? thread.subject : `Fwd: ${thread.subject}`,
      `\n\n---------- Doorgestuurd bericht ----------\nVan: ${lastMessage.senderName}\nVerzonden: ${formatDate(lastMessage.createdAt)}\nOnderwerp: ${thread.subject}\n\n${lastMessage.body}`
    );
  }

  const actionClass = "rounded-lg border border-borderButton bg-button px-3 py-2 text-sm font-semibold text-textPrimary hover:border-accent hover:bg-cardHover disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-xl font-bold text-textBright">{thread.subject}</h2>
        {lastMessage && <p className="mt-1 text-xs text-textMuted">{formatDate(lastMessage.createdAt)}</p>}
        <div className="mt-4 flex flex-wrap gap-2" aria-label={t("mailbox.actions")}>
          <button type="button" disabled={systemMessage} onClick={() => setReplyMode("reply")} className={actionClass}>↩ {t("mailbox.reply")}</button>
          <button type="button" disabled={systemMessage} onClick={() => setReplyMode("replyAll")} className={actionClass}>↩↩ {t("mailbox.replyAll")}</button>
          <button type="button" onClick={forward} className={actionClass}>→ {t("mailbox.forward")}</button>
          <button type="button" onClick={() => setConfirmDelete(true)} className={`${actionClass} text-red-400`}>⌫ {t("mailbox.delete")}</button>
        </div>
        {systemMessage && <p className="mt-3 text-xs text-textMuted">{t("mailbox.systemNoReply")}</p>}
      </header>

      <div className="flex-1 overflow-y-auto bg-cardDeep">
        {thread.messages.map((message) => (
          <article key={message.id} className="border-b border-border px-5 py-5 last:border-b-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm"><span className="text-textMuted">{t("mailbox.from")}: </span><strong className="text-textPrimary">{message.senderName}</strong>{message.senderId === currentUserId && <span className="ml-2 text-xs text-accent">· jij</span>}</p>
                {message.senderId === currentUserId && message.recipients.length > 0 && <p className="mt-1 text-xs text-textMuted">{t("mailbox.recipients")}: {message.recipients.map((recipient) => recipient.name).join(", ")}</p>}
              </div>
              <time className="text-xs text-textMuted">{formatDate(message.createdAt)}</time>
            </div>
            <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-textPrimary">{message.body}</div>
          </article>
        ))}
      </div>

      {replyMode && !systemMessage && <div className="border-t border-border bg-cardAlt p-4">
        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="text-sm font-semibold text-textSecondary">{replyMode === "replyAll" ? t("mailbox.replyAll") : t("mailbox.reply")}</label>
          <button type="button" onClick={() => { setReplyMode(null); setReply(""); }} className="text-xs text-textMuted hover:text-textPrimary">{t("mailbox.cancel")}</button>
        </div>
        <textarea autoFocus value={reply} onChange={(event) => setReply(event.target.value)} rows={5} className="w-full rounded-xl border border-border bg-input px-3 py-2 text-textPrimary" placeholder={t("mailbox.replyPlaceholder")} />
        <div className="mt-2 flex justify-end"><button type="button" onClick={() => void sendReply()} disabled={sending || !reply.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page disabled:opacity-50">{sending ? "..." : t("mailbox.send")}</button></div>
      </div>}

      <ConfirmDialog open={confirmDelete} title={t("mailbox.deleteTitle")} message={t("mailbox.deleteMessage")} confirmLabel={t("mailbox.delete")} busy={deleting} onCancel={() => setConfirmDelete(false)} onConfirm={() => void deleteThread()} />
    </div>
  );
}
