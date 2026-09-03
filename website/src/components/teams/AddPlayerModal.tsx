"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";

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
  const { t } = useI18n();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    setError("");

    const { error: insertError } = await supabase.from("players").insert({
      team_id: teamId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || null,
      date_of_birth: dateOfBirth || null,
      phone_numbers: phoneNumbers.split(",").map((phone) => phone.trim()).filter(Boolean),
      role
    });

    setSaving(false);
    if (insertError) { setError(insertError.message || t("team.addFailed")); return; }
    onAdded();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-cardAlt border border-border rounded-xl p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-textBright font-semibold">{t("team.addPerson", { role: t(role === "staff" ? "team.staff" : "team.player") })}</h2>
            <p className="text-textMuted text-sm">{teamName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-textMuted hover:text-textPrimary text-sm">
            {t("common.close")}
          </button>
        </div>
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder={t("team.firstName")}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm"
            autoFocus
            required
          />
          <input
            type="text"
            placeholder={t("team.lastName")}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm"
            required
          />
          <input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} aria-label={t("team.dateOfBirth")} className="px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm" />
          <input
            type="email"
            placeholder={t("auth.email")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm"
          />
          <input type="text" placeholder={t("team.phonePlaceholder")} value={phoneNumbers} onChange={(event) => setPhoneNumbers(event.target.value)} className="col-span-2 px-3 py-2 bg-input text-textPrimary rounded-lg border border-border text-sm" />
          {error && <p role="alert" className="col-span-2 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">{error}</p>}
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-textSecondary hover:bg-cardHover">
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent text-page rounded-lg font-semibold hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? t("team.adding") : t("settings.add")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
