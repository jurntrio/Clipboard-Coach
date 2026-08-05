export type TrainingStatistic = { playerId: string; playerName: string; teamId: string; teamName: string; confirmedTrainings: number; missedTrainings: number };

export function TrainingStatistics({ rows }: { rows: TrainingStatistic[] }) {
  const visible = [...rows].sort((a, b) => b.missedTrainings - a.missedTrainings || a.playerName.localeCompare(b.playerName));
  return <>
    <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-borderSubtle bg-cardDeep px-4 py-3"><h2 className="font-bold text-textBright">Aanwezigheidslijst</h2><p className="text-sm text-textMuted">Gebaseerd op bevestigde, afgelopen trainingen.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-borderSubtle text-xs uppercase text-textMuted"><tr><th className="px-4 py-3">Speler</th><th className="px-4 py-3 text-right">Trainingen</th><th className="px-4 py-3 text-right">Gemist</th><th className="px-4 py-3 text-right">Aanwezig</th><th className="px-4 py-3 text-right">Aanwezigheid</th></tr></thead><tbody className="divide-y divide-borderSubtle">{visible.map(row => { const present = row.confirmedTrainings - row.missedTrainings; const percentage = row.confirmedTrainings ? Math.round(present / row.confirmedTrainings * 100) : 0; return <tr key={row.playerId}><td className="px-4 py-3 font-semibold text-textBright">{row.playerName}</td><td className="px-4 py-3 text-right text-textPrimary">{row.confirmedTrainings}</td><td className="px-4 py-3 text-right font-semibold text-red-400">{row.missedTrainings}</td><td className="px-4 py-3 text-right text-textPrimary">{present}</td><td className="px-4 py-3 text-right font-bold text-accent">{percentage}%</td></tr>; })}</tbody></table></div>
      {!visible.length && <p className="p-5 text-sm text-textMuted">Nog geen spelers of bevestigde trainingen voor deze ploeg.</p>}
    </section>
  </>;
}
