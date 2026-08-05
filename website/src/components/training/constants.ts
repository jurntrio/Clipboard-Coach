import type { Block } from "@/components/training/types";

export const ASSET_ROOT = "/branding/Training";
export const FIELD_SRC = `${ASSET_ROOT}/11vs11.jpg`;
export const GREEN_FIELD_SRC = `${ASSET_ROOT}/11vs11-groen.png`;
export const TEAM_TACTIC_GROUPS = [
  {
    label: "Offensieve principes",
    options: [
      "TT1 · Opbouw van achteruit",
      "TT2 · Infiltratie van verdedigers naar waarheidszone",
      "TT3 · Kansen creëren/scoren na dieptepass",
      "TT4 · Kansen creëren/scoren na voorzet"
    ]
  },
  {
    label: "Defensieve principes",
    options: [
      "TT5 · Opbouw van achteruit beletten",
      "TT6 · Infiltratie van verdedigers naar waarheidszone beletten",
      "TT7 · Kansen/scoren na dieptepass beletten",
      "TT8 · Kansen/scoren na voorzet beletten"
    ]
  },
  {
    label: "Offensieve omschakelingsprincipes",
    options: ["TT9 · Kansen creëren/scoren na tegenaanval"]
  },
  {
    label: "Defensieve omschakelingsprincipes",
    options: ["TT10 · Kansen/scoren na tegenaanval beletten"]
  }
] as const;
export const colors = [
  { file: "Groen", slug: "groen", label: "Groen" }, { file: "Blauw", slug: "blauw", label: "Blauw" },
  { file: "Zwart", slug: "zwart", label: "Zwart" }, { file: "Wit", slug: "wit", label: "Wit" },
  { file: "Rood", slug: "rood", label: "Rood" }
] as const;
export const playerFamilies = [
  { file: "shirt", label: "Shirts" }, { file: "cirkel", label: "Cirkels" },
  { file: "vierkant", label: "Vierkanten" }
] as const;
export const balls = [
  ["voetbal.png", "Voetbal"], ["tennisbal-geel.png", "Tennisbal geel"], ["tennisbal-zwart.png", "Tennisbal zwart"],
  ["Basketbal.png", "Basketbal"], ["volleybal.png", "Volleybal"], ["rugbybal.png", "Rugbybal"],
  ["AmericanFootballZwart.png", "American football"], ["medicijnbal.png", "Medicijnbal"]
] as const;
export const otherEquipment = [
  ["doeltje-klein.png", "Klein doel"], ["doeltje-middelgroot.png", "Middelgroot doel"], ["doeltje-groot.png", "Groot doel"],
  ["waterfles.png", "Waterfles"], ["springtouw.png", "Springtouw"], ["dumbbell.png", "Dumbbell"],
  ["FluitjeZwart.png", "Fluitje"], ["stopwatch.png", "Chronometer"], ["ClipboardZwart.png", "Clipboard"]
] as const;
export const phases = [
  "Warming-up", "Vorm 1", "Vorm 2", "Vorm 3", "Vorm 4", "Cooling-down"
] as const;

export function path(file: string) { return `${ASSET_ROOT}/${file}`; }

export function makeBlocks(): Block[] {
  return phases.map((label, index) => ({
    id: `default-phase-${index}`,
    code: "",
    label,
    active: true,
    title: "",
    minutes: index === 0 ? 15 : 10,
    organisation: "",
    flow: "",
    coaching: "",
    fieldType: "full",
    items: [],
    lines: [],
    areas: [],
    dribbles: []
  }));
}
