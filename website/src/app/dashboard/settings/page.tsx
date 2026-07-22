"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StandardTag } from "@/types/database";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function SettingsPage() {
  const [standardTags, setStandardTags] = useState<StandardTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagNameDraft, setTagNameDraft] = useState("");
  const supabase = createClient();

  useEffect(() => {
    loadStandardTags();
  }, []);

  async function loadStandardTags() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from("standard_tags").select("*").eq("coach_id", user.id).order("created_at");
    setStandardTags(data ?? []);
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
      <SectionHeader title="Settings" artworkSrc="/branding/settings.png" />

      <section className="mb-8">
        <h2 className="text-textBright font-semibold mb-2">Appearance</h2>
        <p className="text-textMuted text-sm mb-3">Choose how Clipboard Coach Studio looks on this device.</p>
        <ThemeToggle />
      </section>

      <section className="mb-8">
        <h2 className="text-textBright font-semibold mb-2">Language</h2>
        <p className="text-textMuted text-sm mb-3">More languages are coming later.</p>
        <select
          value="en"
          disabled
          className="px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm mx-auto"
        >
          <option value="en">English</option>
        </select>
      </section>

      <section>
        <h2 className="text-textBright font-semibold mb-2">Quick tags</h2>
        <p className="text-textMuted text-sm mb-3">These show up as one-tap buttons in the video viewer.</p>

        <div className="flex flex-col gap-1 mb-4">
          {standardTags.map((tag) => (
            <div key={tag.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
              {editingTagId === tag.id ? <input autoFocus value={tagNameDraft} onChange={(event) => setTagNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameStandardTag(tag.id); if (event.key === "Escape") setEditingTagId(null); }} className="min-w-0 flex-1 rounded border border-accent bg-input px-2 py-1 text-textPrimary outline-none" /> : <span className="text-textPrimary">{tag.name}</span>}
              {!tag.is_protected && (
                <div className="ml-3 flex gap-3">{editingTagId === tag.id ? <button type="button" onClick={() => void renameStandardTag(tag.id)} className="text-sm font-semibold text-accent">Save</button> : <button type="button" onClick={() => { setEditingTagId(tag.id); setTagNameDraft(tag.name); }} className="text-sm text-textMuted hover:text-accent">Edit</button>}<button type="button" onClick={() => removeStandardTag(tag.id)} className="text-sm text-textMuted hover:text-red-400">Remove</button></div>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={addStandardTag} className="flex gap-2">
          <input
            type="text"
            placeholder="New quick tag"
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            className="flex-1 px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-accent text-page rounded-lg font-semibold hover:opacity-90">
            Add
          </button>
        </form>
      </section>
    </div>
  );
}
