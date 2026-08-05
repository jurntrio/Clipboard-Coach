export function Meta({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`${wide ? "mt-3 block sm:col-span-2" : "block"} text-xs font-bold uppercase tracking-wide text-textMuted`}>{label}{children}</label>;
}
