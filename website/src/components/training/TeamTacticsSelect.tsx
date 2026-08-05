import { TEAM_TACTIC_GROUPS } from "@/components/training/constants";

export function TeamTacticsSelect({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  }
  return <details className="relative mt-1">
    <summary className="flex min-h-[38px] cursor-pointer list-none items-center justify-between rounded-lg border border-border bg-input px-3 py-2 text-sm normal-case text-textBright">
      <span className="truncate">{values.length ? `${values.length} principe${values.length === 1 ? "" : "s"} geselecteerd` : "Kies TeamTactics…"}</span>
      <span className="ml-2 text-accent">▾</span>
    </summary>
    <div className="absolute left-0 z-50 mt-1 max-h-[430px] w-[min(620px,90vw)] overflow-y-auto rounded-xl border border-border bg-cardAlt p-3 normal-case shadow-2xl">
      <p className="mb-3 text-xs text-textMuted">Teamtactische (sub)principes · 4 modules jaarplan topsport</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {TEAM_TACTIC_GROUPS.map(group => <fieldset key={group.label} className="rounded-lg border border-borderSubtle bg-card p-3">
          <legend className="px-1 text-xs font-black text-accent">{group.label}</legend>
          <div className="mt-1 space-y-2">
            {group.options.map(option => <label key={option} className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-textPrimary">
              <input type="checkbox" checked={values.includes(option)} onChange={() => toggle(option)} className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
              <span>{option}</span>
            </label>)}
          </div>
        </fieldset>)}
      </div>
    </div>
  </details>;
}
