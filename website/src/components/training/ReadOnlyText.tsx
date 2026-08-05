export function ReadOnlyText({ label, value }: { label: string; value?: string }) {
  return <section>
    <h4 className="text-xs font-black uppercase tracking-wide text-textMuted">{label}</h4>
    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-textPrimary">{value?.trim() || "Niet opgegeven"}</p>
  </section>;
}
