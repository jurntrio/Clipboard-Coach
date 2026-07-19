"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PlayerRow = { firstName: string; lastName: string; email: string };

export function CreateTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [players, setPlayers] = useState<PlayerRow[]>([{ firstName: "", lastName: "", email: "" }]);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  function updatePlayerRow(index: number, field: keyof PlayerRow, value: string) {
    setPlayers((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addPlayerRow() {
    setPlayers((current) => [...current, { firstName: "", lastName: "", email: "" }]);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    const { data: team, error } = await supabase
      .from("teams")
      .insert({ coach_id: user!.id, name: name.trim() })
      .select()
      .single();

    if (!error && team) {
      const rows = players
        .filter((row) => row.firstName.trim() && row.lastName.trim())
        .map((row) => ({
          team_id: team.id,
          first_name: row.firstName.trim(),
          last_name: row.lastName.trim(),
          email: row.email.trim() || null
        }));

      if (rows.length > 0) {
        await supabase.from("players").insert(rows);
      }
    }

    setSaving(false);
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[calc(100vh-32px)] overflow-auto bg-cardAlt border border-border rounded-xl p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-textBright font-semibold">Create Team</h2>
            <p className="text-textMuted text-sm">Create a team and its players together.</p>
          </div>
          <button type="button" onClick={onClose} className="text-textMuted hover:text-textPrimary text-sm">
            Close
          </button>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-textMuted text-xs uppercase tracking-wide">Team name</span>
            <input
              type="text"
              placeholder="Team name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="px-3 py-2 bg-input text-textPrimary rounded-lg border border-border"
              autoFocus
              required
            />
          </label>

          <div className="flex flex-col gap-2">
            {players.map((row, index) => (
              <div key={index} className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="First name"
                  value={row.firstName}
                  onChange={(event) => updatePlayerRow(index, "firstName", event.target.value)}
                  aria-label={`First name player ${index + 1}`}
                  className="px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm"
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={row.lastName}
                  onChange={(event) => updatePlayerRow(index, "lastName", event.target.value)}
                  aria-label={`Last name player ${index + 1}`}
                  className="px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={row.email}
                  onChange={(event) => updatePlayerRow(index, "email", event.target.value)}
                  aria-label={`Email player ${index + 1}`}
                  className="px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addPlayerRow}
            className="self-start px-3 py-1.5 rounded-lg border border-borderButton text-textSecondary text-sm hover:border-accent hover:text-accent"
          >
            + Add player
          </button>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-textSecondary hover:bg-cardHover">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent text-page rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
