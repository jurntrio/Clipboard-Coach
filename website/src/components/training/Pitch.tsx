import Image from "next/image";
import { FIELD_SRC, GREEN_FIELD_SRC } from "@/components/training/constants";
import { smoothPath } from "@/components/training/geometry";
import type { AreaShape, AreaStyle, FieldArea, FieldDribble, FieldItem, FieldLine, FieldType, PaletteAsset, SelectedDrawing } from "@/components/training/types";

export function Pitch({ fieldType = "full", items, lines, areas, dribbles, preview = false, onOpen, selectedId, selectedDrawing, drawingInteractive = true, onSelect, onDeleteItem, onSelectDrawing, onDrawingPointerDown, onDrawingPointerMove, onMove, onResize, onRotate, pendingAsset, pendingLine, pendingLineStyle, pendingLineArrow = true, pendingArea, pendingAreaStyle = "outline", pendingAreaShape = "polygon", pendingDribble, hoverPoint, drawingColor = "#111111" }: {
  fieldType?: FieldType; items: FieldItem[]; lines: FieldLine[]; areas: FieldArea[]; dribbles: FieldDribble[]; preview?: boolean; onOpen?: () => void; selectedId?: string | null;
  selectedDrawing?: SelectedDrawing;
  drawingInteractive?: boolean;
  onSelect?: (id: string) => void; onDeleteItem?: (id: string) => void;
  onMove?: (event: React.PointerEvent<HTMLButtonElement>, id: string) => void;
  onSelectDrawing?: (drawing: Exclude<SelectedDrawing, null>) => void;
  onDrawingPointerDown?: (event: React.PointerEvent<SVGElement>, drawing: Exclude<SelectedDrawing, null>, pointIndex?: number) => void;
  onDrawingPointerMove?: (event: React.PointerEvent<SVGElement>, drawing: Exclude<SelectedDrawing, null>, pointIndex?: number) => void;
  onResize?: (event: React.PointerEvent<HTMLButtonElement>, id: string) => void;
  onRotate?: (event: React.PointerEvent<HTMLButtonElement>, id: string) => void;
  pendingAsset?: PaletteAsset | null;
  pendingLine?: { x: number; y: number } | null;
  pendingLineStyle?: "solid" | "dashed" | null;
  pendingLineArrow?: boolean;
  pendingArea?: { x: number; y: number }[];
  pendingAreaStyle?: AreaStyle;
  pendingAreaShape?: AreaShape;
  pendingDribble?: { x: number; y: number }[];
  hoverPoint?: { x: number; y: number } | null;
  drawingColor?: string;
}) {
  const isGreen = fieldType.endsWith("-green");
  const isHalf = fieldType === "half" || fieldType === "half-green";
  const isBlank = fieldType === "blank" || fieldType === "blank-green";
  return (
    <div onClick={onOpen} className={`relative aspect-[414/612] w-full overflow-hidden ${isGreen ? "bg-[#269c36]" : "bg-white"} ${preview ? "cursor-pointer" : pendingAsset ? "cursor-none" : "cursor-crosshair"}`}>
      {!isBlank && <Image src={isGreen ? GREEN_FIELD_SRC : FIELD_SRC} alt={`${isHalf ? "Half" : "Volledig"} voetbalveld op ${isGreen ? "groene" : "witte"} achtergrond`} fill sizes={preview ? "360px" : "620px"}
        className={`pointer-events-none object-fill ${isHalf ? "origin-top scale-[1.6667]" : ""}`} priority />}
      <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id={preview ? "training-arrow-preview" : "training-arrow-editor"} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
          </marker>
          {areas.map(area => <pattern key={area.id} id={`training-hatch-${area.id}`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="3" stroke={area.color} strokeWidth=".7" />
          </pattern>)}
          <pattern id="training-hatch-pending" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="3" stroke={drawingColor} strokeWidth=".7" />
          </pattern>
        </defs>
        {areas.map(area => (
          <polygon key={area.id} points={area.points.map(point => `${point.x},${point.y}`).join(" ")}
            fill={area.style === "outline" ? "transparent" : area.style === "hatched" ? `url(#training-hatch-${area.id})` : area.color}
            color={area.color} fillOpacity={area.style === "fill" ? ".18" : "1"} stroke={area.color}
            strokeWidth={selectedDrawing?.kind === "area" && selectedDrawing.id === area.id ? "1.35" : ".65"}
            vectorEffect="non-scaling-stroke" className={preview || !drawingInteractive ? "pointer-events-none" : "pointer-events-auto cursor-move"}
            onPointerDown={event => onDrawingPointerDown?.(event, { kind: "area", id: area.id })}
            onPointerMove={event => onDrawingPointerMove?.(event, { kind: "area", id: area.id })}
            onClick={event => { event.stopPropagation(); onSelectDrawing?.({ kind: "area", id: area.id }); }} />
        ))}
        {lines.map(line => (
          <g key={line.id} className={preview || !drawingInteractive ? "pointer-events-none" : "pointer-events-auto cursor-move"}
            onPointerDown={event => onDrawingPointerDown?.(event, { kind: "line", id: line.id })}
            onPointerMove={event => onDrawingPointerMove?.(event, { kind: "line", id: line.id })}
            onClick={event => { event.stopPropagation(); onSelectDrawing?.({ kind: "line", id: line.id }); }}>
            {!preview && <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="transparent" strokeWidth="10" />}
            <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke={line.color || "#111111"} strokeWidth={selectedDrawing?.kind === "line" && selectedDrawing.id === line.id ? "1.35" : ".65"} vectorEffect="non-scaling-stroke"
              strokeDasharray={line.style === "dashed" ? "3 2" : undefined}
              markerEnd={line.showArrow === false ? undefined : `url(#${preview ? "training-arrow-preview" : "training-arrow-editor"})`} />
            {line.number && <>
              <circle cx={(line.x1 + line.x2) / 2} cy={(line.y1 + line.y2) / 2} r="1.35" fill="white" stroke={line.color || "#111111"} strokeWidth=".3" />
              <text x={(line.x1 + line.x2) / 2} y={(line.y1 + line.y2) / 2 + .45} textAnchor="middle" fontSize="1.3" fontWeight="700" fill={line.color || "#111111"}>{line.number}</text>
            </>}
          </g>
        ))}
        {dribbles.map(dribble => (
          <g key={dribble.id} className={preview || !drawingInteractive ? "pointer-events-none" : "pointer-events-auto cursor-move"}
            onPointerDown={event => onDrawingPointerDown?.(event, { kind: "dribble", id: dribble.id })}
            onPointerMove={event => onDrawingPointerMove?.(event, { kind: "dribble", id: dribble.id })}
            onClick={event => { event.stopPropagation(); onSelectDrawing?.({ kind: "dribble", id: dribble.id }); }}>
            {!preview && <path d={smoothPath(dribble.points)} fill="none" stroke="transparent" strokeWidth="10" />}
            <path d={smoothPath(dribble.points)} fill="none" stroke={dribble.color} strokeWidth={selectedDrawing?.kind === "dribble" && selectedDrawing.id === dribble.id ? "1.35" : ".65"} strokeLinecap="round"
              markerEnd={`url(#${preview ? "training-arrow-preview" : "training-arrow-editor"})`} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        {!preview && pendingLine && hoverPoint && (
          <line x1={pendingLine.x} y1={pendingLine.y} x2={hoverPoint.x} y2={hoverPoint.y}
            stroke={drawingColor} strokeOpacity=".65" strokeWidth=".65" strokeDasharray={pendingLineStyle === "dashed" ? "3 2" : undefined}
            markerEnd={pendingLineArrow ? "url(#training-arrow-editor)" : undefined} vectorEffect="non-scaling-stroke" />
        )}
        {!preview && pendingArea && pendingArea.length > 0 && (
          pendingAreaShape === "rectangle" && hoverPoint
            ? <polygon points={[pendingArea[0], { x: hoverPoint.x, y: pendingArea[0].y }, hoverPoint, { x: pendingArea[0].x, y: hoverPoint.y }].map(point => `${point.x},${point.y}`).join(" ")}
                fill={pendingAreaStyle === "outline" ? "none" : pendingAreaStyle === "hatched" ? "url(#training-hatch-pending)" : drawingColor}
                color={drawingColor} fillOpacity={pendingAreaStyle === "fill" ? ".18" : "1"} stroke={drawingColor} strokeOpacity=".75" strokeWidth=".65" strokeDasharray="2 1" vectorEffect="non-scaling-stroke" />
            : pendingArea.length >= 2 && hoverPoint
            ? <polygon points={[...pendingArea, hoverPoint].map(point => `${point.x},${point.y}`).join(" ")}
                fill={pendingAreaStyle === "outline" ? "none" : pendingAreaStyle === "hatched" ? "url(#training-hatch-pending)" : drawingColor}
                color={drawingColor} fillOpacity={pendingAreaStyle === "fill" ? ".18" : "1"} stroke={drawingColor} strokeOpacity=".75" strokeWidth=".65" strokeDasharray="2 1" vectorEffect="non-scaling-stroke" />
            : <polyline points={[...pendingArea, ...(hoverPoint ? [hoverPoint] : [])].map(point => `${point.x},${point.y}`).join(" ")}
                fill="none" stroke={drawingColor} strokeOpacity=".65" strokeWidth=".65" strokeDasharray="2 1" vectorEffect="non-scaling-stroke" />
        )}
        {!preview && pendingDribble && pendingDribble.length > 0 && (
          <path d={smoothPath([...pendingDribble, ...(hoverPoint ? [hoverPoint] : [])])}
            fill="none" stroke={drawingColor} strokeOpacity=".75" strokeWidth=".65" strokeLinecap="round"
            strokeDasharray="1.2 1.2" markerEnd="url(#training-arrow-editor)" vectorEffect="non-scaling-stroke" />
        )}
        {areas.filter(area => area.number).map(area => {
          const center = area.points.reduce((sum, point) => ({ x: sum.x + point.x / area.points.length, y: sum.y + point.y / area.points.length }), { x: 0, y: 0 });
          return <g key={`${area.id}-number`} className="pointer-events-none">
            <circle cx={center.x} cy={center.y} r="1.8" fill="white" stroke={area.color} strokeWidth=".3" />
            <text x={center.x} y={center.y + .55} textAnchor="middle" fontSize="1.6" fontWeight="700" fill={area.color}>{area.number}</text>
          </g>;
        })}
        {dribbles.filter(dribble => dribble.number).map(dribble => {
          const point = dribble.points[dribble.points.length - 1];
          return <g key={`${dribble.id}-number`} className="pointer-events-none">
            <circle cx={point.x} cy={point.y} r="1.35" fill="white" stroke={dribble.color} strokeWidth=".3" />
            <text x={point.x} y={point.y + .45} textAnchor="middle" fontSize="1.3" fontWeight="700" fill={dribble.color}>{dribble.number}</text>
          </g>;
        })}
        {!preview && drawingInteractive && selectedDrawing?.kind === "line" && lines.filter(line => line.id === selectedDrawing.id).map(line =>
          [[line.x1, line.y1], [line.x2, line.y2]].map(([x, y], index) =>
            <circle key={index} cx={x} cy={y} r="1.5" fill="#169447" stroke="white" strokeWidth=".55"
              className="pointer-events-auto cursor-grab"
              onPointerDown={event => onDrawingPointerDown?.(event, selectedDrawing, index)}
              onPointerMove={event => onDrawingPointerMove?.(event, selectedDrawing, index)} />))}
        {!preview && drawingInteractive && selectedDrawing?.kind === "area" && areas.filter(area => area.id === selectedDrawing.id).flatMap(area =>
          area.points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.5" fill="#169447" stroke="white" strokeWidth=".55"
            className="pointer-events-auto cursor-grab"
            onPointerDown={event => onDrawingPointerDown?.(event, selectedDrawing, index)}
            onPointerMove={event => onDrawingPointerMove?.(event, selectedDrawing, index)} />))}
        {!preview && drawingInteractive && selectedDrawing?.kind === "dribble" && dribbles.filter(dribble => dribble.id === selectedDrawing.id).flatMap(dribble =>
          dribble.points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.5" fill="#169447" stroke="white" strokeWidth=".55"
            className="pointer-events-auto cursor-grab"
            onPointerDown={event => onDrawingPointerDown?.(event, selectedDrawing, index)}
            onPointerMove={event => onDrawingPointerMove?.(event, selectedDrawing, index)} />))}
      </svg>
      {items.map(item => (
        <div key={item.id} style={{ left: `${item.x}%`, top: `${item.y}%`, width: "5.5%", aspectRatio: "1", transform: "translate(-50%, -50%)" }} className="pointer-events-none absolute z-10">
          <button type="button" title={item.label}
            style={{ transform: `rotate(${item.rotation}deg) scale(${item.scale}) scaleX(${item.stretchX ?? 1}) scaleY(${item.stretchY ?? 1})` }}
            onPointerDown={event => { event.stopPropagation(); onSelect?.(item.id); event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={event => onMove?.(event, item.id)}
            onClick={event => { event.stopPropagation(); onSelect?.(item.id); }}
            className={`pointer-events-auto absolute inset-0 touch-none rounded-sm ${preview ? "pointer-events-none" : "cursor-grab active:cursor-grabbing"} ${selectedId === item.id ? "outline outline-2 outline-[#169447] outline-offset-2" : ""}`}>
            <Image src={item.src} alt="" fill sizes="40px" className="pointer-events-none object-contain drop-shadow-sm" />
            {item.playerNumber !== undefined && <span aria-hidden="true"
              className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-sans font-black leading-none ${item.playerNumber.length >= 3 ? "text-[7px]" : item.playerNumber.length === 2 ? "text-[9px]" : "text-[11px]"} ${item.playerNumberColor === "black" ? "text-black" : "text-white"}`}>
              {item.playerNumber}
            </span>}
          </button>
          {!preview && selectedId === item.id && <>
            <span style={{ transform: `rotate(${item.rotation}deg) scale(${item.scale}) scaleX(${item.stretchX ?? 1}) scaleY(${item.stretchY ?? 1})` }}
              className="pointer-events-none absolute inset-0 border border-dashed border-[#169447]" />
            <button type="button" aria-label="Icoon vergroten of verkleinen"
              onPointerDown={event => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerMove={event => onResize?.(event, item.id)}
              onClick={event => event.stopPropagation()}
              className="pointer-events-auto absolute -bottom-2 -right-2 z-30 h-4 w-4 touch-none cursor-nwse-resize rounded-full border-2 border-white bg-[#169447] shadow" />
            <button type="button" aria-label="Icoon draaien"
              onPointerDown={event => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); }}
              onPointerMove={event => onRotate?.(event, item.id)}
              onClick={event => event.stopPropagation()}
              className="pointer-events-auto absolute -top-7 left-1/2 z-30 grid h-5 w-5 -translate-x-1/2 touch-none cursor-grab place-items-center rounded-full border-2 border-white bg-[#182019] text-[10px] text-white shadow">↻</button>
            <button type="button" aria-label="Icoon verwijderen" onClick={event => { event.stopPropagation(); onDeleteItem?.(item.id); }}
              className="pointer-events-auto absolute -left-8 top-1/2 z-30 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#b42323] text-white shadow">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
              </svg>
            </button>
          </>}
        </div>
      ))}
      {!preview && pendingAsset && hoverPoint && (
        <div aria-hidden="true" style={{ left: `${hoverPoint.x}%`, top: `${hoverPoint.y}%`, width: "5.5%", aspectRatio: "1", transform: "translate(-50%, -50%)" }}
          className="pointer-events-none absolute z-20 opacity-75 drop-shadow-md">
          <Image src={pendingAsset.src} alt="" fill sizes="40px" className="object-contain" />
          {pendingAsset.playerNumber !== undefined && <span
            className={`absolute inset-0 z-10 flex items-center justify-center font-sans font-black leading-none ${pendingAsset.playerNumber.length >= 3 ? "text-[7px]" : pendingAsset.playerNumber.length === 2 ? "text-[9px]" : "text-[11px]"} ${pendingAsset.playerNumberColor === "black" ? "text-black" : "text-white"}`}>
            {pendingAsset.playerNumber}
          </span>}
        </div>
      )}
    </div>
  );
}
