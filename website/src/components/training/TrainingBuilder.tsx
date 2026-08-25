"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supportsBelgianTeamTactics, TRAINING_AGE_CATEGORIES } from "@/lib/training-categories";
import { balls, colors, makeBlocks, otherEquipment, path, phases, playerFamilies } from "@/components/training/constants";
import { Meta } from "@/components/training/Meta";
import { MultiValueInput } from "@/components/training/MultiValueInput";
import { TeamTacticsSelect } from "@/components/training/TeamTacticsSelect";
import { AssetButton, PlayerGroup } from "@/components/training/PalettePicker";
import { Pitch } from "@/components/training/Pitch";
import { PrintPreview } from "@/components/training/TrainingPrintPreview";
import type { AreaShape, AreaStyle, Block, FieldArea, FieldDribble, FieldItem, FieldLine, PaletteAsset, SelectedDrawing } from "@/components/training/types";

export function TrainingBuilder({ initialTrainer = "", teamOptions = [], trainerOptions = [], clubOptions = [], initialTraining, editingTrainingId, sessionId }: {
  initialTrainer?: string;
  teamOptions?: { id: string; name: string; assigned: boolean; clubLogoUrl: string | null }[];
  trainerOptions?: string[];
  clubOptions?: { id: string; name: string; country: string }[];
  initialTraining?: Record<string, any>;
  editingTrainingId?: string;
  sessionId?: string;
}) {
  const editorFieldRef = useRef<HTMLDivElement>(null);
  const editorSnapshotRef = useRef<Block | null>(null);
  const drawingDragRef = useRef<{ drawing: Exclude<SelectedDrawing, null>; pointIndex?: number; last: { x: number; y: number } } | null>(null);
  const draftBaselineRef = useRef("");
  const initializeDraftRef = useRef(true);
  const restoredUnfinishedDraftRef = useRef(false);
  const unresolvedChangesRef = useRef(false);
  const [blocks, setBlocks] = useState<Block[]>(makeBlocks);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<PaletteAsset | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDrawing, setSelectedDrawing] = useState<SelectedDrawing>(null);
  const [lineStyle, setLineStyle] = useState<"solid" | "dashed" | null>(null);
  const [lineArrow, setLineArrow] = useState(true);
  const [numberLines, setNumberLines] = useState(false);
  const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);
  const [areaMode, setAreaMode] = useState(false);
  const [areaShape, setAreaShape] = useState<AreaShape>("polygon");
  const [areaStyle, setAreaStyle] = useState<AreaStyle>("outline");
  const [areaPoints, setAreaPoints] = useState<{ x: number; y: number }[]>([]);
  const [dribbleMode, setDribbleMode] = useState(false);
  const [dribblePoints, setDribblePoints] = useState<{ x: number; y: number }[]>([]);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const [drawColor, setDrawColor] = useState("#111111");
  const [showColorPanel, setShowColorPanel] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [pendingLocalDraft, setPendingLocalDraft] = useState<Record<string, any> | null>(null);
  const [name, setName] = useState("Nieuwe training");
  const [team, setTeam] = useState(teamOptions[0]?.name ?? "");
  const [customTeam, setCustomTeam] = useState(false);
  const [date, setDate] = useState("");
  const [playerCount, setPlayerCount] = useState(15);
  const [keeperCount, setKeeperCount] = useState(2);
  const [trainers, setTrainers] = useState<string[]>(initialTrainer ? [initialTrainer] : []);
  const [teamTactics, setTeamTactics] = useState<string[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [material, setMaterial] = useState("");
  const [status, setStatus] = useState("");
  const [clubId, setClubId] = useState(clubOptions[0]?.id ?? "");
  const [ageCategory, setAgeCategory] = useState("");
  const [personalTrainingId, setPersonalTrainingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [confirmNewTraining, setConfirmNewTraining] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [hasUnresolvedChanges, setHasUnresolvedChanges] = useState(false);

  const activeBlock = activeIndex === null ? null : blocks[activeIndex];
  const selectedItem = activeBlock?.items.find(item => item.id === selectedId) ?? null;
  const totalMinutes = blocks.reduce((sum, block) => sum + (block.active ? block.minutes : 0), 0);
  const clubLogoUrl = customTeam ? null : teamOptions.find(option => option.name === team)?.clubLogoUrl ?? null;
  const teamTacticsEnabled = supportsBelgianTeamTactics(clubOptions.find(club => club.id === clubId)?.country);
  const draft = useMemo(() => ({
    version: 6, name, team, date, playerCount, keeperCount, trainers, teamTactics, themes, material, blocks,
    clubId, ageCategory, personalTrainingId, updatedAt: new Date().toISOString()
  }), [ageCategory, blocks, clubId, date, keeperCount, material, name, personalTrainingId, playerCount, team, teamTactics, themes, trainers]);
  const draftSignature = useMemo(() => JSON.stringify({
    name, team, date, playerCount, keeperCount, trainers, teamTactics, themes, material, blocks, clubId, ageCategory
  }), [ageCategory, blocks, clubId, date, keeperCount, material, name, playerCount, team, teamTactics, themes, trainers]);
  const byColor = (families: readonly (readonly [string, string])[]) =>
    colors.flatMap(color => families.map(([file, label]) => ({
      src: path(`${file}-${color.slug}.png`), label: `${label} ${color.label}`
    })));
  const equipmentGroups = [
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

  function restoreDraft(draft: Record<string, any>, localDraft: boolean) {
    restoredUnfinishedDraftRef.current = localDraft;
    setName(draft.name ?? name); setTeam(draft.team ?? ""); setDate(draft.date ?? "");
    setPlayerCount(draft.playerCount ?? 15); setKeeperCount(draft.keeperCount ?? 2);
    setTrainers(Array.isArray(draft.trainers) ? draft.trainers : draft.trainer ? [draft.trainer] : initialTrainer ? [initialTrainer] : []);
    const restoredClubId = draft.clubId ?? clubOptions[0]?.id ?? "";
    const restoredClub = clubOptions.find(club => club.id === restoredClubId);
    setTeamTactics(supportsBelgianTeamTactics(restoredClub?.country) && Array.isArray(draft.teamTactics) ? draft.teamTactics : []);
    setThemes(Array.isArray(draft.themes) ? draft.themes : draft.theme ? [draft.theme] : []);
    setClubId(restoredClubId);
    setAgeCategory(draft.ageCategory ?? "");
    setPersonalTrainingId(draft.personalTrainingId);
    setCustomTeam(Boolean(draft.team && !teamOptions.some(option => option.name === draft.team)));
    setMaterial(draft.material ?? "");
    if (Array.isArray(draft.blocks) && draft.blocks.length) {
      setBlocks(draft.blocks.map((block: Block, index: number) => ({
        ...block,
        id: block.id ?? `restored-phase-${index}`,
        code: block.id?.startsWith("default-phase-") ? "" : block.code,
        label: block.id?.startsWith("default-phase-") && phases[index] ? phases[index] : block.title?.trim() || block.label,
        title: "",
        fieldType: block.fieldType ?? "full",
        lines: (block.lines ?? []).map(line => ({ ...line, color: line.color ?? "#111111" })),
        areas: (block.areas ?? []).map(area => ({ ...area, style: area.style ?? "fill" })),
        dribbles: block.dribbles ?? []
      })));
    } else {
      setBlocks(makeBlocks());
    }
    setStatus(localDraft ? "Lokaal concept hersteld" : "Gedeelde training geopend · wijzigingen worden een nieuwe versie");
    setPendingLocalDraft(null);
    setDraftReady(true);
  }

  useEffect(() => {
    const raw = window.localStorage.getItem("cbcs.training-builder.v2");
    if (initialTraining) {
      restoreDraft(initialTraining, false);
      return;
    }
    if (!raw) {
      setDraftReady(true);
      return;
    }
    try {
      setPendingLocalDraft(JSON.parse(raw));
    } catch {
      restoredUnfinishedDraftRef.current = false;
      window.localStorage.removeItem("cbcs.training-builder.v2");
      setDraftReady(true);
    }
    // Alleen eenmalig controleren of er een lokaal concept bestaat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    if (initializeDraftRef.current) {
      initializeDraftRef.current = false;
      draftBaselineRef.current = draftSignature;
      setHasUnresolvedChanges(restoredUnfinishedDraftRef.current);
      return;
    }
    setHasUnresolvedChanges(draftSignature !== draftBaselineRef.current);
  }, [draftReady, draftSignature]);

  useEffect(() => {
    if (!draftReady || !hasUnresolvedChanges) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem("cbcs.training-builder.v2", JSON.stringify(draft));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft, draftReady, hasUnresolvedChanges]);

  useEffect(() => {
    unresolvedChangesRef.current = hasUnresolvedChanges;
    if (!hasUnresolvedChanges) return;
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      if (!unresolvedChangesRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnresolvedChanges]);

  useEffect(() => {
    if (activeIndex === null) return;
    const editorIndex = activeIndex;
    function cancelActiveTool(event: KeyboardEvent) {
      if (event.key === "Enter" && areaMode && areaPoints.length >= 3) {
        event.preventDefault();
        const area: FieldArea = {
          id: crypto.randomUUID(), points: areaPoints, color: drawColor, style: areaStyle,
          number: numberLines ? blocks[editorIndex].areas.filter(item => item.number).length + 1 : undefined
        };
        setBlocks(current => current.map((block, index) => index === editorIndex ? { ...block, areas: [...block.areas, area] } : block));
        setAreaPoints([]);
        setHoverPoint(null);
      } else if (event.key === "Enter" && dribbleMode && dribblePoints.length >= 2) {
        event.preventDefault();
        const dribble: FieldDribble = {
          id: crypto.randomUUID(), points: dribblePoints, color: drawColor,
          number: numberLines ? blocks[editorIndex].dribbles.filter(item => item.number).length + 1 : undefined
        };
        setBlocks(current => current.map((block, index) => index === editorIndex ? { ...block, dribbles: [...block.dribbles, dribble] } : block));
        setDribblePoints([]);
        setHoverPoint(null);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setSelectedAsset(null);
        setSelectedId(null);
        setSelectedDrawing(null);
        setLineStyle(null);
        setLineStart(null);
        setAreaMode(false);
        setAreaPoints([]);
        setDribbleMode(false);
        setDribblePoints([]);
        setHoverPoint(null);
      }
    }
    window.addEventListener("keydown", cancelActiveTool);
    return () => window.removeEventListener("keydown", cancelActiveTool);
  }, [activeIndex, areaMode, areaPoints, areaStyle, blocks, drawColor, dribbleMode, dribblePoints, numberLines]);

  useEffect(() => {
    if (!showPrintPreview) return;
    function closePrintPreview(event: KeyboardEvent) {
      if (event.key === "Escape") setShowPrintPreview(false);
    }
    window.addEventListener("keydown", closePrintPreview);
    return () => window.removeEventListener("keydown", closePrintPreview);
  }, [showPrintPreview]);

  function updateBlock(index: number, patch: Partial<Block>) {
    setBlocks(current => current.map((block, i) => i === index ? { ...block, ...patch } : block));
  }
  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    setBlocks(current => {
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  }
  function addBlock() {
    const nextNumber = blocks.length + 1;
    setBlocks(current => [...current, {
      id: crypto.randomUUID(),
      code: `VAK ${nextNumber}`,
      label: "Nieuwe trainingsvorm",
      active: true,
      title: "",
      minutes: 10,
      organisation: "",
      flow: "",
      coaching: "",
      fieldType: "full",
      items: [],
      lines: [],
      areas: [],
      dribbles: []
    }]);
  }
  function chooseAsset(asset: PaletteAsset) {
    setSelectedAsset(asset);
    setSelectedId(null);
    setSelectedDrawing(null);
    setLineStyle(null);
    setLineStart(null);
    setAreaMode(false);
    setAreaPoints([]);
    setDribbleMode(false);
    setDribblePoints([]);
  }
  function openEditor(index: number) {
    editorSnapshotRef.current = JSON.parse(JSON.stringify(blocks[index])) as Block;
    setActiveIndex(index);
    setSelectedId(null);
    setSelectedDrawing(null);
    setSelectedAsset(null);
    setLineStyle(null);
    setLineStart(null);
    setAreaMode(false);
    setAreaPoints([]);
    setDribbleMode(false);
    setDribblePoints([]);
    setConfirmClose(false);
  }
  function closeEditor(save: boolean) {
    if (!save && activeIndex !== null && editorSnapshotRef.current) {
      updateBlock(activeIndex, editorSnapshotRef.current);
    }
    setActiveIndex(null);
    setSelectedId(null);
    setSelectedDrawing(null);
    setConfirmClose(false);
    editorSnapshotRef.current = null;
  }
  async function saveDraft(): Promise<boolean> {
    if (!clubId) { setStatus("Kies eerst de club waarvoor je bewaart."); return false; }
    if (!ageCategory) { setStatus("Kies verplicht een leeftijdsjaar."); return false; }
    if (!name.trim()) { setStatus("Geef de training eerst een naam."); return false; }
    setSaving(true);
    setStatus("Training bewaren…");
    window.localStorage.setItem("cbcs.training-builder.v2", JSON.stringify(draft));
    try {
      const response = await fetch("/api/trainings/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubId, ageCategory, title: name, themes, personalTrainingId, clubTrainingId: editingTrainingId, sessionId,
          content: { name, team, date, playerCount, keeperCount, trainers, teamTactics, themes, material, blocks }
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Bewaren is mislukt.");
      setPersonalTrainingId(result.personalTrainingId);
      window.localStorage.setItem("cbcs.training-builder.v2", JSON.stringify({
        version: 5, name, team, date, playerCount, keeperCount, trainers, teamTactics, themes, material, blocks,
        clubId, ageCategory, personalTrainingId: result.personalTrainingId, updatedAt: new Date().toISOString()
      }));
      const message = result.publicationState === "published"
        ? "Persoonlijk bewaard en automatisch gepubliceerd in Intradesk"
        : result.publicationState === "pending_approval"
          ? "Persoonlijk bewaard en naar de clubadmin gestuurd"
          : "Persoonlijk bewaard";
      setStatus(`${message} · ${ageCategory}`);
      draftBaselineRef.current = draftSignature;
      setHasUnresolvedChanges(false);
      window.localStorage.removeItem("cbcs.training-builder.v2");
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Bewaren is mislukt.");
      return false;
    } finally {
      setSaving(false);
    }
  }
  function startEmptyTraining() {
    unresolvedChangesRef.current = false;
    setHasUnresolvedChanges(false);
    window.localStorage.removeItem("cbcs.training-builder.v2");
    window.location.assign("/dashboard/training/new");
  }
  async function saveAndStartEmptyTraining() {
    if (await saveDraft()) startEmptyTraining();
  }
  function requestEmptyTraining() {
    if (hasUnresolvedChanges) setConfirmNewTraining(true);
    else startEmptyTraining();
  }
  function placeAsset(asset: PaletteAsset, x: number, y: number) {
    if (activeIndex === null) return;
    const assetName = asset.src.toLocaleLowerCase();
    const isWall = assetName.includes("/muur") || assetName.includes("/vrijetrapmuur-3-5-poppen");
    const isLadder = /\/(?:kortll|langll|dubbelll)/.test(assetName) || assetName.includes("-loopladder-");
    const isBigGoal = assetName.includes("/grote_goal") || assetName.includes("/doeltje-groot");
    const isMediumGoal = assetName.includes("/doeltje-middelgroot") || assetName.includes("/duivelsgoal");
    const isSmallGoal = assetName.includes("/doeltje-klein") || assetName.includes("/minigoal");
    const item: FieldItem = {
      ...asset, id: crypto.randomUUID(), x, y, scale: isWall ? 1.5 : 1, rotation: 0,
      stretchX: isBigGoal ? 2.5 : isMediumGoal ? 2 : isSmallGoal ? 1.5 : 1, stretchY: isLadder ? 2 : 1
    };
    updateBlock(activeIndex, { items: [...blocks[activeIndex].items, item] });
    setSelectedId(item.id);
  }
  function placeItem(event: React.MouseEvent<HTMLDivElement>) {
    if (activeIndex === null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (dribbleMode) {
      setDribblePoints(current => [...current, { x, y }]);
      return;
    }
    if (areaMode) {
      if (areaShape === "rectangle") {
        if (!areaPoints.length) {
          setAreaPoints([{ x, y }]);
        } else {
          const start = areaPoints[0];
          const area: FieldArea = {
            id: crypto.randomUUID(), points: [start, { x, y: start.y }, { x, y }, { x: start.x, y }], color: drawColor, style: areaStyle,
            number: numberLines ? blocks[activeIndex].areas.filter(item => item.number).length + 1 : undefined
          };
          updateBlock(activeIndex, { areas: [...blocks[activeIndex].areas, area] });
          setAreaPoints([]);
          setHoverPoint(null);
        }
        return;
      }
      setAreaPoints(current => [...current, { x, y }]);
      return;
    }
    if (lineStyle) {
      if (!lineStart) {
        setLineStart({ x, y });
      } else {
        const line: FieldLine = {
          id: crypto.randomUUID(), x1: lineStart.x, y1: lineStart.y, x2: x, y2: y, style: lineStyle, color: drawColor, showArrow: lineArrow,
          number: numberLines ? blocks[activeIndex].lines.filter(item => item.number).length + 1 : undefined
        };
        updateBlock(activeIndex, { lines: [...blocks[activeIndex].lines, line] });
        setLineStart(null);
      }
      return;
    }
    if (!selectedAsset) return;
    placeAsset(selectedAsset, x, y);
  }
  function dragAssetMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !editorFieldRef.current) return;
    const rect = editorFieldRef.current.getBoundingClientRect();
    setHoverPoint({
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
    });
  }
  function dragAssetEnd(event: React.PointerEvent<HTMLButtonElement>, asset: PaletteAsset) {
    if (!editorFieldRef.current) return;
    const rect = editorFieldRef.current.getBoundingClientRect();
    const withinField = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (withinField) {
      const x = Math.max(2, Math.min(98, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(2, Math.min(98, ((event.clientY - rect.top) / rect.height) * 100));
      placeAsset(asset, x, y);
    }
    setHoverPoint(null);
  }
  function moveItem(event: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || activeIndex === null || !editorFieldRef.current) return;
    const rect = editorFieldRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((event.clientY - rect.top) / rect.height) * 100));
    updateBlock(activeIndex, { items: blocks[activeIndex].items.map(item => item.id === id ? { ...item, x, y } : item) });
  }
  function updateSelected(patch: Partial<FieldItem>) {
    if (activeIndex === null || !selectedId) return;
    updateBlock(activeIndex, { items: blocks[activeIndex].items.map(item => item.id === selectedId ? { ...item, ...patch } : item) });
  }
  function selectDrawing(drawing: Exclude<SelectedDrawing, null>) {
    setSelectedDrawing(drawing);
    setSelectedId(null);
    setSelectedAsset(null);
    setLineStyle(null);
    setLineStart(null);
    setAreaMode(false);
    setAreaPoints([]);
    setDribbleMode(false);
    setDribblePoints([]);
  }
  function resizeSelected(event: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || activeIndex === null || !editorFieldRef.current) return;
    const item = blocks[activeIndex].items.find(candidate => candidate.id === id);
    if (!item) return;
    const rect = editorFieldRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width * item.x / 100;
    const cy = rect.top + rect.height * item.y / 100;
    const distance = Math.hypot(event.clientX - cx, event.clientY - cy);
    const baseSize = rect.width * .055 * Math.SQRT1_2;
    updateSelected({ scale: Math.max(.5, Math.min(3, distance / baseSize)) });
  }
  function rotateSelected(event: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || activeIndex === null || !editorFieldRef.current) return;
    const item = blocks[activeIndex].items.find(candidate => candidate.id === id);
    if (!item) return;
    const rect = editorFieldRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width * item.x / 100;
    const cy = rect.top + rect.height * item.y / 100;
    const degrees = Math.round((Math.atan2(event.clientY - cy, event.clientX - cx) * 180 / Math.PI + 90) / 5) * 5;
    updateSelected({ rotation: degrees });
  }
  function deleteSelected() {
    if (activeIndex === null) return;
    if (selectedId) {
      updateBlock(activeIndex, { items: blocks[activeIndex].items.filter(item => item.id !== selectedId) });
      setSelectedId(null);
    } else if (selectedDrawing?.kind === "line") {
      updateBlock(activeIndex, { lines: blocks[activeIndex].lines.filter(line => line.id !== selectedDrawing.id) });
      setSelectedDrawing(null);
    } else if (selectedDrawing?.kind === "area") {
      updateBlock(activeIndex, { areas: blocks[activeIndex].areas.filter(area => area.id !== selectedDrawing.id) });
      setSelectedDrawing(null);
    } else if (selectedDrawing?.kind === "dribble") {
      updateBlock(activeIndex, { dribbles: blocks[activeIndex].dribbles.filter(dribble => dribble.id !== selectedDrawing.id) });
      setSelectedDrawing(null);
    }
  }
  function deleteFieldItem(id: string) {
    if (activeIndex === null) return;
    updateBlock(activeIndex, { items: blocks[activeIndex].items.filter(item => item.id !== id) });
    setSelectedId(null);
  }
  function drawingPoint(event: React.PointerEvent<SVGElement>) {
    if (!editorFieldRef.current) return null;
    const rect = editorFieldRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
    };
  }
  function startDrawingDrag(event: React.PointerEvent<SVGElement>, drawing: Exclude<SelectedDrawing, null>, pointIndex?: number) {
    const point = drawingPoint(event);
    if (!point) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingDragRef.current = { drawing, pointIndex, last: point };
    selectDrawing(drawing);
  }
  function moveDrawingDrag(event: React.PointerEvent<SVGElement>, drawing: Exclude<SelectedDrawing, null>, pointIndex?: number) {
    const drag = drawingDragRef.current;
    if (!drag || drag.drawing.id !== drawing.id || !event.currentTarget.hasPointerCapture(event.pointerId) || activeIndex === null) return;
    const point = drawingPoint(event);
    if (!point) return;
    event.stopPropagation();
    const dx = point.x - drag.last.x;
    const dy = point.y - drag.last.y;
    const movePoints = (points: { x: number; y: number }[]) =>
      pointIndex === undefined ? points.map(value => ({ x: value.x + dx, y: value.y + dy })) : points.map((value, index) => index === pointIndex ? point : value);
    if (drawing.kind === "line") {
      updateBlock(activeIndex, { lines: blocks[activeIndex].lines.map(line => line.id !== drawing.id ? line : pointIndex === 0 ? { ...line, x1: point.x, y1: point.y } : pointIndex === 1 ? { ...line, x2: point.x, y2: point.y } : { ...line, x1: line.x1 + dx, y1: line.y1 + dy, x2: line.x2 + dx, y2: line.y2 + dy }) });
    } else if (drawing.kind === "area") {
      updateBlock(activeIndex, { areas: blocks[activeIndex].areas.map(area => area.id === drawing.id ? { ...area, points: movePoints(area.points) } : area) });
    } else {
      updateBlock(activeIndex, { dribbles: blocks[activeIndex].dribbles.map(dribble => dribble.id === drawing.id ? { ...dribble, points: movePoints(dribble.points) } : dribble) });
    }
    drag.last = point;
  }
  function trackDrawingPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!selectedAsset && !lineStart && areaPoints.length === 0 && dribblePoints.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setHoverPoint({
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
    });
  }
  function finishArea() {
    if (activeIndex === null || areaPoints.length < 3) return;
    const area: FieldArea = {
      id: crypto.randomUUID(), points: areaPoints, color: drawColor, style: areaStyle,
      number: numberLines ? blocks[activeIndex].areas.filter(item => item.number).length + 1 : undefined
    };
    updateBlock(activeIndex, { areas: [...blocks[activeIndex].areas, area] });
    setAreaPoints([]);
    setHoverPoint(null);
  }
  function finishDribble() {
    if (activeIndex === null || dribblePoints.length < 2) return;
    const dribble: FieldDribble = {
      id: crypto.randomUUID(), points: dribblePoints, color: drawColor,
      number: numberLines ? blocks[activeIndex].dribbles.filter(item => item.number).length + 1 : undefined
    };
    updateBlock(activeIndex, { dribbles: [...blocks[activeIndex].dribbles, dribble] });
    setDribblePoints([]);
    setHoverPoint(null);
  }

  const inputClass = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm normal-case text-textBright outline-none focus:border-accent";
  return (
    <div className="mt-6 space-y-4">
      {pendingLocalDraft && <div className="fixed inset-0 z-[130] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Lokaal trainingsconcept gevonden">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
          <h2 className="text-xl font-black text-textBright">Verdergaan met je vorige training?</h2>
          <p className="mt-2 text-sm text-textSecondary">CBCS heeft een lokaal concept gevonden. Kies of je daarmee verdergaat of met een volledig lege training begint.</p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => {
              window.localStorage.removeItem("cbcs.training-builder.v2");
              restoredUnfinishedDraftRef.current = false;
              setPendingLocalDraft(null);
              setDraftReady(true);
              setStatus("Nieuwe lege training gestart");
            }} className="rounded-lg border border-red-500/60 px-4 py-2 text-sm font-bold text-red-400">Volledig nieuwe training</button>
            <button type="button" onClick={() => restoreDraft(pendingLocalDraft, true)} className="rounded-lg bg-accent px-4 py-2 text-sm font-black text-page">Verdergaan met concept</button>
          </div>
        </div>
      </div>}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Meta label="Naam training"><input value={name} onChange={e => setName(e.target.value)} className={inputClass} /></Meta>
          <Meta label="Leeftijdsjaar *">
            <select required value={ageCategory} onChange={event => setAgeCategory(event.target.value)} className={inputClass}>
              <option value="">Kies leeftijdsjaar…</option>
              {TRAINING_AGE_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </Meta>
          {clubOptions.length > 1 && <Meta label="Club">
            <select value={clubId} onChange={event => {
              const nextClubId = event.target.value;
              setClubId(nextClubId);
              if (!supportsBelgianTeamTactics(clubOptions.find(club => club.id === nextClubId)?.country)) setTeamTactics([]);
            }} className={inputClass}>
              {clubOptions.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}
            </select>
          </Meta>}
          <Meta label="Ploeg">
            <select value={customTeam ? "__custom__" : team} onChange={event => {
              const value = event.target.value;
              setCustomTeam(value === "__custom__");
              setTeam(value === "__custom__" ? "" : value);
            }} className={inputClass}>
              {!teamOptions.length && <option value="">Geen clubploegen gevonden</option>}
              {teamOptions.map(option => <option key={option.id} value={option.name}>{option.name}{option.assigned ? " · toegewezen" : ""}</option>)}
              <option value="__custom__">Andere ploeg typen…</option>
            </select>
            {customTeam && <input autoFocus value={team} onChange={event => setTeam(event.target.value)} placeholder="Naam van de ploeg" className={inputClass} />}
          </Meta>
          <Meta label="Datum"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} /></Meta>
          <Meta label="Aantal spelers">
            <div className="mt-1 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1">
              <input aria-label="Veldspelers" type="number" min={0} value={playerCount} onChange={e => setPlayerCount(Number(e.target.value))} className={inputClass.replace("mt-1 ", "")} />
              <span className="text-sm font-bold text-textMuted">+</span>
              <input aria-label="Keepers" type="number" min={0} value={keeperCount} onChange={e => setKeeperCount(Number(e.target.value))} className={inputClass.replace("mt-1 ", "")} />
              <span className="text-xs text-textMuted">K</span>
            </div>
          </Meta>
          <Meta label="Trainer(s)"><MultiValueInput values={trainers} onChange={setTrainers} suggestions={trainerOptions} placeholder="Trainer toevoegen" /></Meta>
          {teamTacticsEnabled && <Meta label="TeamTactics"><TeamTacticsSelect values={teamTactics} onChange={setTeamTactics} /></Meta>}
          <Meta label="Hoofdthema('s)"><MultiValueInput values={themes} onChange={setThemes} placeholder="Thema toevoegen" /></Meta>
        </div>
        <Meta label="Benodigd materiaal volledige training" wide>
          <textarea value={material} onChange={e => setMaterial(e.target.value)} rows={2} className={inputClass} placeholder="Ballen, potjes, hesjes, doelen…" />
        </Meta>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-sm text-textSecondary">{status}</span>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-accentDim px-4 py-2 text-sm font-black text-accent">Totale duur: {totalMinutes} minuten</span>
            <button type="button" onClick={() => setShowPrintPreview(true)} className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-bold text-textPrimary">Afdrukvoorbeeld</button>
            <button type="button" disabled={saving} onClick={requestEmptyTraining} className="rounded-lg border border-borderButton bg-button px-4 py-2 text-sm font-bold text-textPrimary disabled:cursor-not-allowed disabled:opacity-50">Nieuwe training</button>
            <button type="button" disabled={saving} onClick={() => void saveDraft()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-black text-page disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "Opslaan…" : editingTrainingId ? "Nieuwe versie opslaan" : "Opslaan"}
            </button>
          </div>
        </div>
      </section>

      {confirmNewTraining && <div className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Nieuwe training starten">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
          <h2 className="text-xl font-black text-textBright">Wat wil je met deze training doen?</h2>
          <p className="mt-2 text-sm text-textSecondary">Kies bewust of je deze training bewaart. Daarna start de trainingsplanner volledig leeg.</p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => setConfirmNewTraining(false)} className="rounded-lg border border-borderButton px-4 py-2 text-sm font-bold text-textPrimary">Annuleren</button>
            <button type="button" disabled={saving} onClick={startEmptyTraining} className="rounded-lg border border-red-500/60 px-4 py-2 text-sm font-bold text-red-400">Niet opslaan</button>
            <button type="button" disabled={saving} onClick={() => void saveAndStartEmptyTraining()} className="rounded-lg bg-accent px-4 py-2 text-sm font-black text-page disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Opslaan…" : "Opslaan"}</button>
          </div>
        </div>
      </div>}

      <section className="space-y-4">
        {blocks.map((block, index) => (
          <article key={block.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <input value={block.label} onChange={event => updateBlock(index, { label: event.target.value })}
                  aria-label="Naam trainingsvak" className="min-w-48 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-2 font-bold text-textBright outline-none hover:border-border focus:border-accent focus:bg-input" />
              </div>
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-textSecondary">
                  <input type="number" min={0} value={block.minutes} onChange={event => updateBlock(index, { minutes: Number(event.target.value) })}
                    aria-label={`Minuten ${block.label}`} className="w-20 rounded border border-border bg-input px-3 py-1.5 text-right text-sm text-textBright outline-none focus:border-accent" />
                  min.
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} title="Vak omhoog" aria-label="Trainingsvak omhoog"
                    className="grid h-8 w-8 place-items-center rounded border border-borderButton bg-button text-sm font-black text-textPrimary disabled:cursor-not-allowed disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} title="Vak omlaag" aria-label="Trainingsvak omlaag"
                    className="grid h-8 w-8 place-items-center rounded border border-borderButton bg-button text-sm font-black text-textPrimary disabled:cursor-not-allowed disabled:opacity-30">↓</button>
                </div>
                <label className="flex items-center gap-2 text-xs text-textSecondary"><input type="checkbox" checked={block.active} onChange={e => updateBlock(index, { active: e.target.checked })} /> actief</label>
              </div>
            </header>
            <div className="grid gap-5 p-4 lg:grid-cols-[300px_1fr]">
              <div>
                <button type="button" onClick={() => openEditor(index)}
                  className="block w-full overflow-hidden rounded-xl border border-border bg-white hover:border-accent" title="Open tekentool">
                  <Pitch fieldType={block.fieldType} items={block.items} lines={block.lines} areas={block.areas} dribbles={block.dribbles} preview />
                </button>
                <button type="button" onClick={() => openEditor(index)}
                  className="mt-2 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-black text-page">Tekenen</button>
              </div>
              <div className="grid content-start gap-3">
                <Meta label="Organisatie" wide><textarea value={block.organisation} onChange={e => updateBlock(index, { organisation: e.target.value })} rows={3} className={inputClass} /></Meta>
                <Meta label="Verloop" wide><textarea value={block.flow} onChange={e => updateBlock(index, { flow: e.target.value })} rows={3} className={inputClass} /></Meta>
                <Meta label="Coaching" wide><textarea value={block.coaching} onChange={e => updateBlock(index, { coaching: e.target.value })} rows={3} className={inputClass} /></Meta>
              </div>
            </div>
          </article>
        ))}
        <button type="button" onClick={addBlock}
          className="w-full rounded-2xl border-2 border-dashed border-accent/60 bg-accentDim/30 px-5 py-5 text-sm font-black text-accent hover:border-accent hover:bg-accentDim">
          + Trainingsvak toevoegen
        </button>
      </section>

      {showPrintPreview && <PrintPreview name={name} team={team} clubLogoUrl={clubLogoUrl} date={date} playerCount={playerCount} keeperCount={keeperCount}
        trainers={trainers} teamTactics={teamTactics} themes={themes} material={material} blocks={blocks} onClose={() => setShowPrintPreview(false)} />}

      {activeBlock && activeIndex !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label={`Tekening ${activeBlock.label}`}>
          <div className="flex max-h-[97vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <header className="flex items-center justify-between bg-[#101713] px-4 py-3 text-white">
              <div><strong>Tekentool · {activeBlock.label}</strong><p className="text-xs text-white/60">Kies een icoon en klik op het veld. Sleep om te verplaatsen.</p></div>
              <button type="button" onClick={() => setConfirmClose(true)} className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold">Sluiten</button>
            </header>
            <div className="grid min-h-0 flex-1 gap-3 overflow-auto bg-white p-3 lg:grid-cols-[430px_1fr]">
              <aside className="space-y-2 overflow-auto lg:max-h-[78vh]">
                {playerFamilies.map(family => <PlayerGroup key={family.file} family={family} onPick={chooseAsset} activeAsset={selectedAsset} onDragMove={dragAssetMove} onDragEnd={dragAssetEnd} />)}
                {equipmentGroups.map(group => (
                  <section key={group.label} className="rounded-lg border border-[#dbe2de] bg-white p-2">
                    <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#243029]">{group.label}</h3>
                    <div className="grid grid-cols-10 gap-1">
                      {group.assets.map(asset => <AssetButton key={asset.src} asset={asset} onPick={chooseAsset} active={selectedAsset?.src === asset.src} onDragMove={dragAssetMove} onDragEnd={dragAssetEnd} />)}
                    </div>
                  </section>
                ))}
              </aside>
              <main className="min-w-0">
                <div className="mx-auto mb-3 flex max-w-[940px] flex-wrap items-center gap-2 rounded-lg border border-[#dbe2de] bg-[#f7f9f8] p-2 text-[#182019]">
                  <div className="flex items-center gap-1 rounded border border-[#cbd5cf] bg-white p-1">
                    <span className="px-2 text-[10px] font-black uppercase text-[#66706b]">Ondergrond</span>
                    {([["full", "Volledig · wit"], ["half", "Half · wit"], ["blank", "Vlak · wit"], ["full-green", "Volledig · groen"], ["half-green", "Half · groen"], ["blank-green", "Vlak · groen"]] as const).map(([value, label]) =>
                      <button key={value} type="button" onClick={() => updateBlock(activeIndex, { fieldType: value })}
                        className={`rounded px-2.5 py-1.5 text-xs font-bold ${activeBlock.fieldType === value ? "bg-[#169447] text-white" : "bg-[#f7f9f8] text-[#36423b]"}`}>{label}</button>)}
                  </div>
                  <button type="button" onClick={() => { setLineStyle(null); setLineStart(null); setAreaMode(false); setAreaPoints([]); setDribbleMode(false); setDribblePoints([]); setSelectedAsset(null); setSelectedId(null); setSelectedDrawing(null); }} className={`rounded border px-3 py-2 text-xs font-bold ${!selectedAsset && !lineStyle && !areaMode && !dribbleMode ? "border-[#169447] bg-[#eef8f1]" : "border-[#cbd5cf] bg-white"}`}>↖ Selecteren</button>
                  <button type="button" onClick={() => { setLineStyle("solid"); setLineArrow(true); setAreaMode(false); setAreaPoints([]); setDribbleMode(false); setDribblePoints([]); setSelectedAsset(null); setSelectedId(null); setSelectedDrawing(null); setLineStart(null); }} className={`rounded border px-3 py-2 text-xs font-bold ${lineStyle === "solid" ? "border-[#169447] bg-[#eef8f1]" : "border-[#cbd5cf] bg-white"}`}>→ Pass</button>
                  <button type="button" onClick={() => { setLineStyle("dashed"); setLineArrow(true); setAreaMode(false); setAreaPoints([]); setDribbleMode(false); setDribblePoints([]); setSelectedAsset(null); setSelectedId(null); setSelectedDrawing(null); setLineStart(null); }} className={`rounded border px-3 py-2 text-xs font-bold ${lineStyle === "dashed" ? "border-[#169447] bg-[#eef8f1]" : "border-[#cbd5cf] bg-white"}`}>⇢ Looplijn</button>
                  <button type="button" onClick={() => { setDribbleMode(true); setDribblePoints([]); setAreaMode(false); setAreaPoints([]); setLineStyle(null); setLineStart(null); setSelectedAsset(null); setSelectedId(null); setSelectedDrawing(null); }} className={`rounded border px-3 py-2 text-xs font-bold ${dribbleMode ? "border-[#169447] bg-[#eef8f1]" : "border-[#cbd5cf] bg-white"}`}>〰 Dribbel</button>
                  <button type="button" onClick={() => { setAreaMode(true); setAreaShape("polygon"); setDribbleMode(false); setDribblePoints([]); setLineStyle(null); setLineStart(null); setSelectedAsset(null); setSelectedId(null); setSelectedDrawing(null); setAreaPoints([]); }} className={`rounded border px-3 py-2 text-xs font-bold ${areaMode && areaShape === "polygon" ? "border-[#169447] bg-[#eef8f1]" : "border-[#cbd5cf] bg-white"}`}>▱ Area</button>
                  <button type="button" onClick={() => { setAreaMode(true); setAreaShape("rectangle"); setDribbleMode(false); setDribblePoints([]); setLineStyle(null); setLineStart(null); setSelectedAsset(null); setSelectedId(null); setSelectedDrawing(null); setAreaPoints([]); }} className={`rounded border px-3 py-2 text-xs font-bold ${areaMode && areaShape === "rectangle" ? "border-[#169447] bg-[#eef8f1]" : "border-[#cbd5cf] bg-white"}`}>▭ Rechthoek</button>
                  {lineStyle && <label className="flex items-center gap-2 rounded border border-[#cbd5cf] bg-white px-3 py-2 text-xs font-bold"><input type="checkbox" checked={lineArrow} onChange={event => setLineArrow(event.target.checked)} /> Pijl tonen</label>}
                  <label className="flex items-center gap-2 rounded border border-[#cbd5cf] bg-white px-3 py-2 text-xs font-bold"><input type="checkbox" checked={numberLines} onChange={e => setNumberLines(e.target.checked)} /> Pijlen, Areas & Dribbels nummeren</label>
                  <button type="button" onClick={() => setShowColorPanel(value => !value)} className="flex items-center gap-2 rounded border border-[#cbd5cf] bg-white px-3 py-2 text-xs font-bold">
                    <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: drawColor }} /> Kleur ▾
                  </button>
                  {areaMode && areaShape === "polygon" && areaPoints.length >= 3 && <button type="button" onClick={finishArea} className="rounded bg-[#169447] px-3 py-2 text-xs font-bold text-white">Area voltooien</button>}
                  {dribbleMode && dribblePoints.length >= 2 && <button type="button" onClick={finishDribble} className="rounded bg-[#169447] px-3 py-2 text-xs font-bold text-white">Dribbel voltooien</button>}
                  {selectedDrawing && <button type="button" onClick={deleteSelected} className="rounded bg-[#9f2525] px-3 py-2 text-xs font-bold text-white">Selectie verwijderen</button>}
                  <button type="button" onClick={() => { updateBlock(activeIndex, { items: [], lines: [], areas: [], dribbles: [] }); setSelectedId(null); setSelectedDrawing(null); setLineStart(null); setAreaPoints([]); setDribblePoints([]); }} className="ml-auto rounded border border-[#cbd5cf] bg-white px-3 py-2 text-xs font-bold">Alles wissen</button>
                  {areaMode && <div className="basis-full rounded-md border border-[#cbd5cf] bg-white p-2">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-[#66706b]">Area-weergave</p>
                    <div className="flex flex-wrap gap-2">
                      {([["outline", "Leeg"], ["fill", "Lichte fill"], ["hatched", "Arcering"]] as const).map(([value, label]) =>
                        <button key={value} type="button" onClick={() => setAreaStyle(value)} className={`rounded border px-3 py-2 text-xs font-bold ${areaStyle === value ? "border-[#169447] bg-[#eef8f1]" : "border-[#cbd5cf]"}`}>{label}</button>)}
                    </div>
                  </div>}
                  {showColorPanel && <div className="basis-full rounded-md border border-[#cbd5cf] bg-white p-2">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-[#66706b]">Tekenkleur</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {["#111111", "#4b5563", "#ffffff", "#e53935", "#fb7185", "#f59e0b", "#facc15", "#65a30d", "#169447", "#14b8a6", "#06b6d4", "#1565c0", "#6366f1", "#7c3aed", "#c026d3", "#92400e"].map(color => (
                        <button key={color} type="button" aria-label={`Kleur ${color}`} onClick={() => { setDrawColor(color); setShowColorPanel(false); }}
                          style={{ backgroundColor: color }} className={`h-7 w-7 rounded-full border ${drawColor === color ? "ring-2 ring-[#169447] ring-offset-2" : ""}`} />
                      ))}
                      <label className="ml-2 flex items-center gap-2 text-xs font-bold">Hex
                        <input value={drawColor} onChange={event => /^#[0-9a-fA-F]{0,6}$/.test(event.target.value) && setDrawColor(event.target.value)} className="w-24 rounded border border-[#cbd5cf] px-2 py-1.5 font-mono text-xs" />
                      </label>
                    </div>
                  </div>}
                  <p className="basis-full px-1 text-[11px] text-[#66706b]">
                    {dribbleMode ? (dribblePoints.length < 2 ? `Klik minstens 2 punten voor de dribbel (${dribblePoints.length}/2).` : `${dribblePoints.length} punten · blijf klikken of voltooi met de knop/Enter.`) : areaMode && areaShape === "rectangle" ? (areaPoints.length ? "Beweeg naar de overstaande hoek en klik om de rechthoek te plaatsen." : "Klik de eerste hoek van de rechthoek.") : areaMode ? (areaPoints.length < 3 ? `Klik minstens 3 hoekpunten voor de Area (${areaPoints.length}/3).` : `${areaPoints.length} punten · klik “Area voltooien” of druk Enter.`) : lineStyle ? (lineStart ? `Beweeg de cursor en klik het eindpunt van de ${lineArrow ? "pijl" : "lijn"}.` : `Klik het startpunt van de ${lineArrow ? "pijl" : "lijn"}.`) : selectedItem ? "Sleep het groene bolletje om te schalen en ↻ om te draaien." : selectedAsset ? `Actief: ${selectedAsset.label} · Escape annuleert.` : "Kies links een icoon, beweging of Area. Escape annuleert de actieve tool."}
                  </p>
                </div>
                <div ref={editorFieldRef} onClick={placeItem} onPointerMove={trackDrawingPointer} onPointerLeave={() => setHoverPoint(null)}
                  className="mx-auto w-full max-w-[620px] self-start overflow-hidden rounded border border-[#dbe2de] bg-white shadow-sm">
                  <Pitch fieldType={activeBlock.fieldType} items={activeBlock.items} lines={activeBlock.lines} areas={activeBlock.areas} dribbles={activeBlock.dribbles} selectedId={selectedId} selectedDrawing={selectedDrawing}
                    drawingInteractive={!selectedAsset && !lineStyle && !areaMode && !dribbleMode}
                    onSelect={id => { setSelectedId(id); setSelectedDrawing(null); }} onDeleteItem={deleteFieldItem}
                    onSelectDrawing={selectDrawing} onDrawingPointerDown={startDrawingDrag} onDrawingPointerMove={moveDrawingDrag}
                    onMove={moveItem} onResize={resizeSelected} onRotate={rotateSelected} pendingAsset={selectedAsset} pendingLine={lineStart}
                    pendingLineStyle={lineStyle} pendingLineArrow={lineArrow} pendingArea={areaPoints} pendingAreaStyle={areaStyle} pendingAreaShape={areaShape} pendingDribble={dribblePoints}
                    hoverPoint={hoverPoint} drawingColor={drawColor} />
                </div>
              </main>
            </div>
            <footer className="flex justify-end border-t border-[#dbe2de] bg-white px-4 py-3">
              <button type="button" onClick={() => closeEditor(true)} className="rounded-lg bg-[#169447] px-5 py-2.5 text-sm font-black text-white">Tekening opslaan</button>
            </footer>
          </div>
          {confirmClose && <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-5 text-[#182019] shadow-2xl">
              <h3 className="text-lg font-black">Tekening opslaan?</h3>
              <p className="mt-2 text-sm text-[#66706b]">Wil je de wijzigingen aan deze tekening bewaren voordat je sluit?</p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setConfirmClose(false)} className="rounded-lg border border-[#cbd5cf] px-4 py-2 text-sm font-bold">Annuleren</button>
                <button type="button" onClick={() => closeEditor(false)} className="rounded-lg border border-[#b43b3b] px-4 py-2 text-sm font-bold text-[#9f2525]">Niet opslaan</button>
                <button type="button" onClick={() => closeEditor(true)} className="rounded-lg bg-[#169447] px-4 py-2 text-sm font-black text-white">Opslaan</button>
              </div>
            </div>
          </div>}
        </div>
      )}
    </div>
  );
}
