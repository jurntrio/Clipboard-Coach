"use client";

import { localeLabels, locales, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className={compact ? "inline-flex items-center gap-2" : "grid max-w-xs gap-1.5 text-sm text-textSecondary"}>
      {!compact && <span className="font-medium">{t("language.label")}</span>}
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        aria-label={t("language.label")}
        className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary"
      >
        {locales.map((item) => <option key={item} value={item}>{localeLabels[item]}</option>)}
      </select>
    </label>
  );
}

