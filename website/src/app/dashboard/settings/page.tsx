"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StandardTag } from "@/types/database";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useI18n } from "@/i18n/client";
import { PrivacyDataSection } from "@/components/settings/PrivacyDataSection";
import { ClipProfilesTable } from "@/components/settings/ClipProfilesTable";
import { isPeriodMarker } from "@/lib/tags";

export default function SettingsPage() {
  const { t } = useI18n();
  const [standardTags, setStandardTags] = useState<StandardTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagNameDraft, setTagNameDraft] = useState("");
  const [mailboxEmailNotifications, setMailboxEmailNotifications] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadStandardTags();
    loadMailboxPreference();
  }, []);

  async function loadStandardTags() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from("standard_tags").select("*").eq("coach_id", user.id).order("created_at");
    setStandardTags(data ?? []);
  }

  async function loadMailboxPreference() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from("profiles").select("mailbox_email_notifications").eq("id", user.id).maybeSingle();
    if (data) setMailboxEmailNotifications(data.mailbox_email_notifications);
  }

  async function toggleMailboxEmailNotifications(enabled: boolean) {
    setMailboxEmailNotifications(enabled);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ mailbox_email_notifications: enabled }).eq("id", user.id);
  }

  async function addStandardTag(event: React.FormEvent) {
    event.preventDefault();
    if (!newTagName.trim()) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();

    await supabase.from("standard_tags").insert({ coach_id: user!.id, name: newTagName.trim() });
    setNewTagName("");
    loadStandardTags();
  }

  async function removeStandardTag(tagId: string) {
    await supabase.from("standard_tags").delete().eq("id", tagId);
    loadStandardTags();
  }

  async function renameStandardTag(tagId: string) {
    const name = tagNameDraft.trim();
    if (!name) return;
    await supabase.from("standard_tags").update({ name }).eq("id", tagId);
    setEditingTagId(null);
    await loadStandardTags();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <SectionHeader title={t("common.settings")} artworkSrc="/branding/settings.png" showHome={false} />

      <section className="mb-8">
        <h2 className="text-textBright font-semibold mb-2">{t("settings.appearance")}</h2>
        <p className="text-textMuted text-sm mb-3">{t("settings.appearanceHelp")}</p>
        <ThemeToggle />
      </section>

      <section className="mb-8">
        <h2 className="text-textBright font-semibold mb-2">{t("common.language")}</h2>
        <p className="text-textMuted text-sm mb-3">{t("settings.languageHelp")}</p>
        <LanguageSwitcher />
      </section>

      <section className="mb-8">
        <h2 className="text-textBright font-semibold mb-2">{t("settings.mailbox")}</h2>
        <p className="text-textMuted text-sm mb-3">{t("settings.mailboxHelp")}</p>
        <label className="flex items-center gap-3 text-textPrimary">
          <input type="checkbox" checked={mailboxEmailNotifications} onChange={(event) => void toggleMailboxEmailNotifications(event.target.checked)} />
          {t("settings.mailboxEmailLabel")}
        </label>
      </section>


      <section id="quick-tags">
        <h2 className="text-textBright font-semibold mb-2">{t("settings.quickTags")}</h2>
        <p className="text-textMuted text-sm mb-3">{t("settings.quickTagsHelp")}</p>

        <div className="flex flex-col gap-1 mb-4">
          {standardTags.filter((tag) => !isPeriodMarker(tag.name)).map((tag) => (
            <div key={tag.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
              {editingTagId === tag.id ? <input autoFocus value={tagNameDraft} onChange={(event) => setTagNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameStandardTag(tag.id); if (event.key === "Escape") setEditingTagId(null); }} className="min-w-0 flex-1 rounded border border-accent bg-input px-2 py-1 text-textPrimary outline-none" /> : <span className="text-textPrimary">{tag.name}</span>}
              {!tag.is_protected && (
                <div className="ml-3 flex gap-3">{editingTagId === tag.id ? <button type="button" onClick={() => void renameStandardTag(tag.id)} className="text-sm font-semibold text-accent">{t("common.save")}</button> : <button type="button" onClick={() => { setEditingTagId(tag.id); setTagNameDraft(tag.name); }} className="text-sm text-textMuted hover:text-accent">{t("common.edit")}</button>}<button type="button" onClick={() => removeStandardTag(tag.id)} className="text-sm text-textMuted hover:text-red-400">{t("common.remove")}</button></div>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={addStandardTag} className="flex gap-2">
          <input
            type="text"
            placeholder={t("settings.newQuickTag")}
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            className="flex-1 px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-accent text-page rounded-lg font-semibold hover:opacity-90">
            {t("settings.add")}
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-semibold text-textBright">{t("clipProfiles.title")}</h2>
        <p className="mb-3 text-sm text-textMuted">{t("settings.clipProfilesHelp")}</p>
        <ClipProfilesTable />
      </section>

      <PrivacyDataSection />

    </div>
  );
}
