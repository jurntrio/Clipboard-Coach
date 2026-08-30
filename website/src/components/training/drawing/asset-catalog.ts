import { balls, colors, otherEquipment, path } from "@/components/training/constants";
import type { PaletteAsset } from "@/components/training/types";

export type EquipmentGroup = { label: string; assets: PaletteAsset[] };

function byColor(families: readonly (readonly [string, string])[]): PaletteAsset[] {
  return colors.flatMap(color => families.map(([file, label]) => ({
    src: path(`${file}-${color.slug}.png`),
    label: `${label} ${color.label}`
  })));
}

export function buildEquipmentGroups(): EquipmentGroup[] {
  return [
    { label: "Vrijetrapmuren", assets: byColor([["vrijetrapmuur-1-pop", "Vrijetrapmuur · 1 pop"], ["vrijetrapmuur-3-5-poppen", "Vrijetrapmuur · 3-5 poppen"]]) },
    { label: "Ballen", assets: balls.map(([file, label]) => ({ src: path(file), label })) },
    { label: "Markeringen", assets: [
      ...byColor([["grote-kegel", "Grote kegel"], ["kleine-kegel", "Kleine kegel"]]),
      { src: path("pylon.png"), label: "Pylon" },
      ...byColor([["kegel-met-stok", "Kegel met stok"], ["koepelvormig-potje", "Koepelvormig potje"]]),
      ...byColor([["platte-markeringsschijf", "Platte markeringsschijf"], ["kleine-platte-stip", "Kleine platte stip"]])
    ] },
    { label: "Coördinatie & hindernissen", assets: [
      ...byColor([["korte-loopladder", "Korte loopladder"], ["lange-loopladder", "Lange loopladder"]]),
      ...byColor([["dubbele-loopladder", "Dubbele loopladder"], ["laag-haagje", "Laag haagje"]]),
      ...byColor([["middelhoog-haagje", "Middelhoog haagje"], ["hoog-haagje", "Hoog haagje"]]),
      ...byColor([["hoepel", "Hoepel"], ["zeshoekige-ring", "Zeshoekige ring"]]),
      { src: path("StepUpBankZwart.png"), label: "Step-upbank" }
    ] },
    { label: "Doelen & overig", assets: [
      ...byColor([["trainershesje-t", "Trainershesje"]]),
      ...otherEquipment.map(([file, label]) => ({ src: path(file), label }))
    ] }
  ];
}
