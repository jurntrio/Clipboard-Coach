"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MessageList } from "@/components/mailbox/MessageList";
import { ThreadView } from "@/components/mailbox/ThreadView";
import { ComposeDialog } from "@/components/mailbox/ComposeDialog";
import type { MailboxSendTargets, MailboxThread } from "@/components/mailbox/types";
import { useI18n } from "@/i18n/client";
import { useSearchParams } from "next/navigation";

export default function InboxPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const requestedThreadId = searchParams.get("thread");
  const [threads, setThreads] = useState<MailboxThread[]>([]);
  const [sendTargets, setSendTargets] = useState<MailboxSendTargets>({ teamGroups: [] });
  const [currentUserId, setCurrentUserId] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, [requestedThreadId]);

  async function load() {
    const response = await fetch("/api/mailbox");
    if (!response.ok) { setLoading(false); return; }
    const data = await response.json() as { currentUserId: string; sendTargets: MailboxSendTargets; threads: MailboxThread[] };
    setCurrentUserId(data.currentUserId);
    setSendTargets(data.sendTargets);
    setThreads(data.threads);
    setLoading(false);
    setSelectedThreadId((current) => {
      if (current && data.threads.some((thread) => thread.threadId === current)) return current;
      if (requestedThreadId && data.threads.some((thread) => thread.threadId === requestedThreadId)) return requestedThreadId;
      return data.threads[0]?.threadId ?? null;
    });
  }

  async function selectThread(threadId: string) {
    setSelectedThreadId(threadId);
    const thread = threads.find((item) => item.threadId === threadId);
    if (thread && thread.unreadCount > 0) {
      await fetch(`/api/mailbox/${threadId}/read`, { method: "PATCH" });
      void load();
    }
  }

  const selectedThread = threads.find((thread) => thread.threadId === selectedThreadId) ?? null;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <SectionHeader title={t("mailbox.title")} artworkSrc="/branding/inbox.svg" showHome={false} />

      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => setComposeOpen(true)} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page hover:opacity-90">{t("mailbox.newMessage")}</button>
      </div>

      {loading ? (
        <p className="text-textMuted">{t("mailbox.loading")}</p>
      ) : (
        <div className="grid gap-4 rounded-2xl border border-border bg-cardAlt md:grid-cols-[320px_1fr]">
          <div className="max-h-[70vh] overflow-y-auto border-b border-border md:border-b-0 md:border-r">
            <MessageList threads={threads} selectedThreadId={selectedThreadId} onSelect={(threadId) => void selectThread(threadId)} />
          </div>
          <div className="min-h-[50vh]">
            {selectedThread
              ? <ThreadView
                  thread={selectedThread}
                  currentUserId={currentUserId}
                  onReplySent={() => void load()}
                  onDeleted={() => { setSelectedThreadId(null); void load(); }}
                />
              : <p className="p-5 text-textMuted">{t("mailbox.noThreadSelected")}</p>}
          </div>
        </div>
      )}

      {composeOpen && (
        <ComposeDialog
          sendTargets={sendTargets}
          currentUserId={currentUserId}
          onClose={() => setComposeOpen(false)}
          onSent={() => { setComposeOpen(false); void load(); }}
        />
      )}
    </div>
  );
}
