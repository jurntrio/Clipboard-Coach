"use client";

import type { MailboxThread } from "./types";
import { useI18n } from "@/i18n/client";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function MessageList({ threads, selectedThreadId, onSelect }: {
  threads: MailboxThread[];
  selectedThreadId: string | null;
  onSelect: (threadId: string) => void;
}) {
  const { t } = useI18n();
  if (!threads.length) return <p className="p-4 text-sm text-textMuted">{t("mailbox.noThreads")}</p>;
  return (
    <ul className="divide-y divide-border">
      {threads.map((thread) => {
        const lastMessage = thread.messages[thread.messages.length - 1];
        return (
          <li key={thread.threadId}>
            <button
              type="button"
              onClick={() => onSelect(thread.threadId)}
              className={`block w-full px-4 py-3 text-left hover:bg-cardHover ${selectedThreadId === thread.threadId ? "bg-cardHover" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`truncate ${thread.unreadCount ? "font-bold text-textBright" : "font-semibold text-textPrimary"}`}>{thread.subject}</span>
                {thread.unreadCount > 0 && <span className="flex-shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-page">{thread.unreadCount}</span>}
              </div>
              <p className="mt-0.5 truncate text-sm text-textMuted">{lastMessage?.senderName}: {lastMessage?.body}</p>
              <p className="mt-0.5 text-xs text-textMuted">{lastMessage && formatDate(lastMessage.createdAt)}</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
