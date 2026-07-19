"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AddPlayerModal({
  teamId,
  teamName,
  role,
  onClose,
  onAdded
}: {
  teamId: string;
  teamName: string;
  role: "player" | "staff";
  onClose: () => void;
  onAdded: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);

    await supabase.from("players").insert({
      team_id: teamId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || null,
      role
    });

    setSaving(false);
    onAdded();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-cardAlt border border-border rounded-xl p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-textBright font-semibold">Add {role === "staff" ? "Staff" : "Player"}</h2>
            <p className="text-textMuted text-sm">{teamName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-textMuted hover:text-textPrimary text-sm">
            Close
          </button>
        </div>
        <form onSubmit={handleAdd} className="grid grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm"
            autoFocus
            required
          />
          <input
            type="text"
            placeholder="Last name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm"
          />
          <div className="col-span-3 flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-textSecondary hover:bg-cardHover">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent text-page rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
