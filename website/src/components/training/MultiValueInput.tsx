"use client";

import { useState } from "react";

export function MultiValueInput({ values, onChange, placeholder, suggestions = [] }: {
  values: string[]; onChange: (values: string[]) => void; placeholder: string; suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  function add(value = draft) {
    const clean = value.trim();
    if (!clean || values.some(item => item.toLocaleLowerCase() === clean.toLocaleLowerCase())) return;
    onChange([...values, clean]);
    setDraft("");
  }
  return <div className="mt-1 rounded-lg border border-border bg-input px-2 py-1.5 focus-within:border-accent">
    <div className="flex flex-wrap gap-1.5">
      {values.map(value => <span key={value} className="inline-flex items-center gap-1 rounded-full bg-accentDim px-2 py-1 text-xs font-semibold text-textPrimary">
        {value}
        <button type="button" aria-label={`${value} verwijderen`} onClick={() => onChange(values.filter(item => item !== value))} className="text-textMuted hover:text-red-400">×</button>
      </span>)}
      <input value={draft} onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(); }
          if (event.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => add()} list={suggestions.length ? `${placeholder.replace(/\W/g, "-")}-suggestions` : undefined}
        placeholder={values.length ? "Nog toevoegen…" : placeholder}
        className="min-w-28 flex-1 bg-transparent px-1 py-1 text-sm normal-case text-textBright outline-none" />
      {!!suggestions.length && <datalist id={`${placeholder.replace(/\W/g, "-")}-suggestions`}>
        {suggestions.filter(item => !values.includes(item)).map(item => <option key={item} value={item} />)}
      </datalist>}
    </div>
  </div>;
}
