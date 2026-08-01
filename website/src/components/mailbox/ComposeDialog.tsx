"use client";

import { useMemo, useState } from "react";
import type { MailboxSendTargets, MailboxTarget } from "./types";
import { targetKey } from "./types";
import { useI18n } from "@/i18n/client";

const inputClass = "mt-1 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-textPrimary";

export function ComposeDialog({ sendTargets, currentUserId, onClose, onSent }: {
  sendTargets: MailboxSendTargets;
  currentUserId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t } = useI18n();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<Map<string, MailboxTarget>>(new Map());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const targets = useMemo(() => Array.from(selected.values()), [selected]);

  function toggle(target: MailboxTarget) {
    setSelected((current) => {
      const next = new Map(current);
      const key = targetKey(target);
      if (next.has(key)) next.delete(key);
      else next.set(key, target);
      return next;
    });
  }

  async function submit() {
    if (!subject.trim() || !body.trim() || !targets.length) {
      setError(t("mailbox.missingFields"));
      return;
    }
    setSending(true);
    setError("");
    const response = await fetch("/api/mailbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subject.trim(), body: body.trim(), targets })
    });
    setSending(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? t("mailbox.sendFailed"));
      return;
    }
    onSent();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <section
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-accent/40 bg-cardAlt shadow-2xl shadow-black/60"
        role="dialog" aria-modal="true" aria-labelledby="compose-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border bg-cardDeep px-5 py-4">
          <h2 id="compose-dialog-title" className="text-xl font-bold text-textBright">{t("mailbox.composeTitle")}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <label className="block text-sm font-semibold text-textSecondary">
            {t("mailbox.subject")}
            <input type="text" value={subject} onChange={(event) => setSubject(event.target.value)} className={inputClass} placeholder={t("mailbox.subjectPlaceholder")} />
          </label>

          <label className="mt-4 block text-sm font-semibold text-textSecondary">
            {t("mailbox.body")}
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} className={inputClass} placeholder={t("mailbox.bodyPlaceholder")} />
          </label>

          <p className="mt-2 text-xs text-textMuted">{t("mailbox.emailNotice")}</p>

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-textSecondary">{t("mailbox.recipients")}</h3>
            {!sendTargets.teamGroups.length && <p className="mt-2 text-sm text-textMuted">{t("mailbox.noTeams")}</p>}
            <div className="mt-2 space-y-4">
              {sendTargets.teamGroups.map((group) => (
                <div key={group.clubTeamId} className="rounded-xl border border-border bg-cardDeep p-3">
                  <p className="font-semibold text-textBright">{group.teamName}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={selected.has(targetKey({ type: "team_staff", clubTeamId: group.clubTeamId }))}
                        onChange={() => toggle({ type: "team_staff", clubTeamId: group.clubTeamId })} disabled={!group.staff.length} />
                      {t("mailbox.staffOf", { team: group.teamName })} ({group.staff.length})
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={selected.has(targetKey({ type: "team_contacts", clubTeamId: group.clubTeamId }))}
                        onChange={() => toggle({ type: "team_contacts", clubTeamId: group.clubTeamId })} disabled={!group.contacts.length} />
                      {t("mailbox.contactsOf", { team: group.teamName })} ({group.contacts.length})
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[...group.staff, ...group.contacts].filter((person) => person.profileId !== currentUserId).map((person) => (
                      <label key={person.profileId} className="flex items-center gap-1 rounded-full border border-borderButton bg-button px-2.5 py-1 text-xs text-textSecondary">
                        <input type="checkbox" checked={selected.has(targetKey({ type: "user", profileId: person.profileId }))}
                          onChange={() => toggle({ type: "user", profileId: person.profileId })} />
                        {person.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-border bg-cardDeep px-5 py-4">
          <button type="button" onClick={onClose} disabled={sending} className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary hover:border-accent disabled:opacity-50">{t("mailbox.cancel")}</button>
          <button type="button" onClick={() => void submit()} disabled={sending} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page hover:opacity-90 disabled:opacity-50">{sending ? t("mailbox.sending") : t("mailbox.send")}</button>
        </div>
      </section>
    </div>
  );
}
