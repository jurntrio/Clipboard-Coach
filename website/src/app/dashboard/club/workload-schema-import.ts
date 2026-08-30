import { readSheet } from "read-excel-file/browser";
import type { WorkloadPhaseKind, WorkloadResumePolicy, WorkloadTrainingMode } from "@/lib/training-workload";

type ImportModality = { id: string; code: string; name: string };
type ImportCategory = { id: string; code: string; club_workload_modalities: ImportModality[] };
export type ImportSystem = { id: string; name: string; club_workload_categories?: ImportCategory[] };
export type ImportedBlock = { categoryId: string; modalityId: string; matchFormat: string; durationValue: string; durationUnit: "minutes" | "seconds" | "meters"; repetitions: string; sets: string; restBetweenRepetitionsSeconds: string; restBetweenSetsSeconds: string; parameters: { yoyoTest: boolean; targetTime: string; speedKmh: string }; note: string };
export type ImportedPhase = { id: string; phaseKind: WorkloadPhaseKind; durationWeeks: number; trainingsPerWeek: number; trainingMode: WorkloadTrainingMode; resumePolicy: WorkloadResumePolicy; sessions: { weekNumber: number; sessionNumber: number; warmup: string; note: string; blocks: ImportedBlock[] }[] };

export async function importSvsWorkloadWorkbook(file: File, system: ImportSystem) {
  const rows = await readSheet(file, "SVS Import");
  if (rows.length < 2) throw new Error("Het tabblad ‘SVS Import’ bevat geen trainingen.");
  const headers = new Map(rows[0].map((value, index) => [String(value ?? "").trim(), index]));
  for (const required of ["Schema", "Fase", "Faseweek", "Training/week", "Uithoudingsvorm", "Explosiviteit / snelheid", "Opwarming", "Kracht"]) if (!headers.has(required)) throw new Error(`De verplichte kolom ‘${required}’ ontbreekt.`);
  const value = (row: unknown[], header: string) => row[headers.get(header)!];
  const text = (row: unknown[], header: string) => String(value(row, header) ?? "").trim();
  const number = (row: unknown[], header: string) => Number(value(row, header)) || 0;
  const dataRows = rows.slice(1).filter(row => text(row, "Fase") && number(row, "Faseweek") > 0 && number(row, "Training/week") > 0);
  if (!dataRows.length) throw new Error("Geen geldige trainingsrijen gevonden.");
  const categories = system.club_workload_categories ?? [];
  const category = (code: string) => categories.find(item => item.code === code);
  const modality = (code: string, name: string) => {
    const options = category(code)?.club_workload_modalities ?? [];
    const wanted = normalize(name);
    return options.find(item => normalize(item.code) === wanted || normalize(item.name) === wanted)?.id
      ?? options.find(item => wanted.includes(normalize(item.name)) || normalize(item.name).includes(wanted))?.id ?? "";
  };
  const phaseOrder: WorkloadPhaseKind[] = ["Pre Season", "Voorbereiding", "Competitie", "Winterstop", "After Season"];
  const phaseNames = [...new Set(dataRows.map(row => text(row, "Fase") as WorkloadPhaseKind))].sort((a, b) => phaseOrder.indexOf(a) - phaseOrder.indexOf(b));
  const phases: ImportedPhase[] = phaseNames.map(phaseKind => {
    const phaseRows = dataRows.filter(row => text(row, "Fase") === phaseKind);
    const sessions = phaseRows.map(row => {
      const enduranceName = text(row, "Uithoudingsvorm");
      const explosiveName = text(row, "Explosiviteit / snelheid");
      const warmupName = text(row, "Opwarming");
      const strengthSource = text(row, "Kracht");
      const strengthName = /krachtuith/i.test(strengthSource) ? "Krachtuithouding" : /snelkracht/i.test(strengthSource) ? "Snelkracht" : /algemene kracht/i.test(strengthSource) ? "Algemene kracht" : /plyometr/i.test(strengthSource) ? "Plyometrie" : strengthSource;
      const matchFrom = number(row, "Wedstrijdvorm van"); const matchTo = number(row, "Wedstrijdvorm tot");
      const notes = [text(row, "Principes"), text(row, "Blessurepreventie"), text(row, "Bronparameters"), strengthSource && strengthSource !== strengthName ? `Kracht uit bron: ${strengthSource}` : ""].filter(Boolean).join(" · ");
      const blocks: ImportedBlock[] = [];
      const add = (code: string, name: string, patch: Partial<ImportedBlock> = {}) => { const found = category(code); if (!found) return; blocks.push({ categoryId: found.id, modalityId: modality(code, name), matchFormat: "", durationValue: "", durationUnit: "minutes", repetitions: "", sets: "", restBetweenRepetitionsSeconds: "", restBetweenSetsSeconds: "", parameters: { yoyoTest: false, targetTime: "", speedKmh: "" }, note: "", ...patch }); };
      add("ENDURANCE", enduranceName, { matchFormat: matchFrom && matchTo ? `(${matchFrom} ↔ ${matchFrom} - ${matchTo} ↔ ${matchTo})` : "", durationValue: text(row, "Totale duur (min)"), durationUnit: "minutes", repetitions: text(row, "Herhalingen"), sets: text(row, "Sessies"), restBetweenRepetitionsSeconds: text(row, "RTH (mm:ss)"), restBetweenSetsSeconds: text(row, "RTS (mm:ss)"), parameters: { yoyoTest: false, targetTime: text(row, "Speelduur per herhaling (mm:ss)"), speedKmh: "" } });
      if (explosiveName) add("EXPLOSIVITY", explosiveName, { durationValue: text(row, "Afstand (m)"), durationUnit: "meters", repetitions: text(row, "Herhalingen explosiviteit"), sets: text(row, "Series"), restBetweenRepetitionsSeconds: text(row, "RTH explosiviteit (mm:ss)"), parameters: { yoyoTest: false, targetTime: text(row, "Doeltijd T (mm:ss)"), speedKmh: text(row, "Snelheid (km/u)") }, note: text(row, "Bronparameters") });
      add("STRENGTH", strengthName);
      add("WARMUP", warmupName, { parameters: { yoyoTest: /^ja$/i.test(text(row, "YOYO Test")), targetTime: "", speedKmh: "" } });
      return { weekNumber: number(row, "Faseweek"), sessionNumber: number(row, "Training/week"), warmup: warmupName, note: notes, blocks };
    });
    return { id: crypto.randomUUID(), phaseKind, durationWeeks: Math.max(...phaseRows.map(row => number(row, "Faseweek"))), trainingsPerWeek: Math.max(...phaseRows.map(row => number(row, "Training/week"))), trainingMode: "regular", resumePolicy: "continue", sessions };
  });
  return { name: text(dataRows[0], "Schema"), phases };
}

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
