"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StandardTag } from "@/types/database";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function SettingsPage() {
  const [standardTags, setStandardTags] = useState<StandardTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
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
              <span className="text-textPrimary">{tag.name}</span>
              {!tag.is_protected && (
                <button onClick={() => removeStandardTag(tag.id)} className="text-textMuted hover:text-red-400 text-sm">
                  Remove
                </button>
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
