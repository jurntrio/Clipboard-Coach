"use client";
import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";

type Screen = {
  id: string;
  name: string;
  location: string | null;
  public_token: string;
  club_tv_blocks: Block[];
};
type Block = {
  id: string;
  block_type: string;
  title: string | null;
  display_order: number;
  configuration: Record<string, any>;
};
type Match = {
  id: string;
  team_a_name: string;
  team_b_name: string;
  match_date: string;
  start_time: string | null;
};
type TickerSettings = {
  text: string;
  textColor: string;
  backgroundMode: "color" | "none";
  backgroundColor: string;
  fontSize: "small" | "normal" | "large";
  fontFamily: "sans" | "rounded" | "serif" | "mono";
  alignment: "left" | "center" | "right";
  displayMode: "fixed" | "ticker";
  separator: "bullet" | "bar" | "space";
};
const defaultTickerSettings: TickerSettings = {
  text: "",
  textColor: "#ffffff",
  backgroundMode: "color",
  backgroundColor: "#000000",
  fontSize: "normal",
  fontFamily: "sans",
  alignment: "center",
  displayMode: "ticker",
  separator: "bullet",
};
const blockOptions = [
  ["main_sponsors", "Hoofdsponsors", "Toon alle actieve hoofdsponsors."],
  ["sponsors", "Sponsors", "Toon de algemene sponsorcarrousel."],
  [
    "match_sponsors",
    "Wedstrijdsponsors",
    "Toon sponsors van de gekozen wedstrijd.",
  ],
  ["ball_donors", "Ballenschenkers", "Toon de matchbalschenkers."],
  ["players", "Spelersfoto’s", "Toon spelers van één of meer teams."],
  ["image", "Eigen afbeelding", "Toon een clubbericht of affiche."],
] as const;

type ClubTvTeam = {
  id: string;
  name: string;
  age_category: string | null;
  status: string;
  season_id: string | null;
  club_seasons: { name: string; status: string } | null;
};

type ClubTvData = {
  screens: Screen[];
  matches: Match[];
  teams: ClubTvTeam[];
  clubId: string;
  canManage: boolean;
};

const emptyClubTvData: ClubTvData = { screens: [], matches: [], teams: [], clubId: "", canManage: false };

type ClubTvAction =
  | { action: "createScreen"; name: string; location: string }
  | { action: "addBlock"; screenId: string; blockType: string; title: string; displayOrder: number; configuration: Record<string, unknown> }
  | { action: "updateBlock"; screenId: string; blockId: string; title?: string; displayOrder?: number; configuration?: Record<string, unknown> }
  | { action: "removeBlock"; screenId: string; blockId: string };

type ClubTvActionResult = {
  id?: string;
  public_token?: string;
  ok?: boolean;
  block?: { id: string; title: string | null; display_order: number; configuration: Record<string, unknown> };
  error?: string;
};

type ClubTvAct = (action: ClubTvAction) => Promise<ClubTvActionResult | null>;

export function ClubTvManager() {
  const [data, setData] = useState<ClubTvData>(emptyClubTvData),
    [openId, setOpenId] = useState(""),
    [name, setName] = useState(""),
    [location, setLocation] = useState(""),
    [error, setError] = useState("");
  async function load() {
    const r = await fetch("/api/club/club-tv", { cache: "no-store" }),
      x: ClubTvData & { error?: string } = await r.json();
    if (!r.ok) throw Error(x.error);
    setData(x);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function act(body: ClubTvAction): Promise<ClubTvActionResult | null> {
    setError("");
    const r = await fetch("/api/club/club-tv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      x: ClubTvActionResult = await r.json();
    if (!r.ok) {
      setError(x.error ?? "Onbekende fout.");
      return null;
    }
    await load();
    return x;
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    const x = await act({ action: "createScreen", name, location });
    if (x?.id) {
      setOpenId(x.id);
      setName("");
      setLocation("");
    }
  }
  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-black text-textBright">
          Aangemaakte schermen
        </h2>
        <p className="mt-1 text-sm text-textMuted">
          Open een scherm om de wedstrijdheader, blokken en publieke link te
          beheren.
        </p>
      </header>
      <div className="space-y-3">
        {data.screens.map((screen: Screen) => (
          <ScreenCard
            key={screen.id}
            screen={screen}
            open={openId === screen.id}
            onToggle={() =>
              setOpenId((v) => (v === screen.id ? "" : screen.id))
            }
            matches={data.matches}
            teams={data.teams}
            clubId={data.clubId}
            canManage={data.canManage}
            act={act}
          />
        ))}
      </div>
      {!data.screens.length && (
        <p className="rounded-xl border border-dashed border-borderSubtle p-5 text-sm text-textMuted">
          Nog geen Club-TV-schermen aangemaakt.
        </p>
      )}
      {data.canManage && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-black text-textBright">
            Nieuw scherm maken
          </h2>
          <p className="mt-1 text-sm text-textMuted">
            Geef de tv een herkenbare naam en optioneel een locatie.
          </p>
          <form
            onSubmit={create}
            className="mt-4 grid gap-3 rounded-xl bg-cardDeep p-4 md:grid-cols-[1fr_1fr_auto]"
          >
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Naam, bv. Grote tribune"
              className={field}
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Locatie, bv. Kantine"
              className={field}
            />
            <button className={primary}>Scherm toevoegen</button>
          </form>
        </section>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}

function ScreenCard({
  screen,
  open,
  onToggle,
  matches,
  teams,
  clubId,
  canManage,
  act,
}: {
  screen: Screen;
  open: boolean;
  onToggle: () => void;
  matches: Match[];
  teams: ClubTvTeam[];
  clubId: string;
  canManage: boolean;
  act: ClubTvAct;
}) {
  const header = screen.club_tv_blocks.find(
      (b) => b.block_type === "match_header" || b.block_type === "match",
    ),
    tickers = screen.club_tv_blocks.filter(
      (b) => b.configuration?.persistentTicker === true,
    ),
    link =
      typeof window !== "undefined"
        ? `${window.location.origin}/club-tv/${screen.public_token}`
        : "";
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <span>
          <strong className="block text-lg text-textBright">
            {screen.name}
          </strong>
          {screen.location && (
            <span className="mt-1 block text-sm text-textMuted">
              {screen.location}
            </span>
          )}
        </span>
        <span className={`text-accent transition ${open ? "rotate-180" : ""}`}>
          ⌄
        </span>
      </button>
      {open && (
        <div className="space-y-5 border-t border-borderSubtle p-5">
          <div className="flex flex-wrap gap-2">
            <input
              readOnly
              value={link}
              className={`${field} min-w-0 flex-1`}
            />
            <button
              onClick={() => navigator.clipboard.writeText(link)}
              className={secondary}
            >
              Kopiëren
            </button>
            <a
              href={`${link}?preview=1`}
              target="_blank"
              rel="noreferrer"
              className={primary}
            >
              Fullscreen preview
            </a>
          </div>
          <MatchHeaderEditor
            screen={screen}
            block={header}
            matches={matches}
            canManage={canManage}
            act={act}
          />
          <TickerEditor screen={screen} blocks={tickers} canManage={canManage} act={act} />
          <BlockRail
            screen={screen}
            blocks={screen.club_tv_blocks.filter((b) => b !== header && !tickers.includes(b))}
            teams={teams}
            matches={matches}
            clubId={clubId}
            canManage={canManage}
            act={act}
          />
        </div>
      )}
    </article>
  );
}

function TickerEditor({ screen, blocks, canManage, act }: {
  screen: Screen; blocks: Block[]; canManage: boolean; act: ClubTvAct;
}) {
  const [draft, setDraft] = useState<TickerSettings>(defaultTickerSettings);
  const orderedBlocks = [...blocks].sort((a, b) => a.display_order - b.display_order);
  async function add() {
    const trimmed = draft.text.trim();
    if (!trimmed) return;
    await act({
      action: "addBlock",
      screenId: screen.id,
      blockType: "image",
      title: "Tekstbalk",
      displayOrder: 10000 + blocks.length,
      configuration: { persistentTicker: true, enabled: true, ...draft, text: trimmed },
    });
    setDraft(defaultTickerSettings);
  }
  async function move(block: Block, direction: -1 | 1) {
    const index = orderedBlocks.findIndex((item) => item.id === block.id),
      other = orderedBlocks[index + direction];
    if (!other) return;
    await Promise.all([
      act({ action: "updateBlock", screenId: screen.id, blockId: block.id, displayOrder: other.display_order }),
      act({ action: "updateBlock", screenId: screen.id, blockId: other.id, displayOrder: block.display_order }),
    ]);
  }
  return <section className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
    <div>
      <h3 className="font-black text-textBright">Tekstbalken onderaan</h3>
      <p className="text-xs text-textMuted">De teksten verschijnen na elkaar, met ruimte ertussen, terwijl de inhoudsblokken wisselen.</p>
    </div>
    {!!blocks.length && <div className="mt-4 space-y-2">
      {orderedBlocks.map((block, index) => (
        <TickerBlockEditor
          key={block.id}
          block={block}
          canManage={canManage}
          first={index === 0}
          last={index === orderedBlocks.length - 1}
          onMove={(direction) => void move(block, direction)}
          onSave={(configuration) => void act({ action: "updateBlock", screenId: screen.id, blockId: block.id, configuration })}
          onRemove={() => void act({ action: "removeBlock", screenId: screen.id, blockId: block.id })}
        />
      ))}
    </div>}
    {canManage && <div className="mt-4 rounded-lg border border-dashed border-borderButton p-3">
      <h4 className="text-sm font-bold text-textBright">Nieuwe tekstbalk</h4>
      <TickerFields value={draft} onChange={setDraft} />
      <button disabled={!draft.text.trim()} onClick={() => void add()} className={`${primary} mt-4 disabled:cursor-not-allowed disabled:opacity-50`}>Tekstbalk toevoegen</button>
    </div>}
  </section>;
}

function TickerBlockEditor({ block, canManage, first, last, onMove, onSave, onRemove }: {
  block: Block;
  canManage: boolean;
  first: boolean;
  last: boolean;
  onMove: (direction: -1 | 1) => void;
  onSave: (configuration: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false),
    [settings, setSettings] = useState<TickerSettings>(() => tickerSettings(block.configuration));
  return <article className="rounded-lg border border-borderSubtle bg-card p-3">
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 break-words text-sm text-textPrimary">{settings.text}</span>
      {canManage && <>
        <button disabled={first} onClick={() => onMove(-1)} title="Naar links" aria-label="Tekstbalk naar links" className="rounded border border-borderButton px-2 py-1 text-sm text-textSecondary disabled:cursor-not-allowed disabled:opacity-30">←</button>
        <button disabled={last} onClick={() => onMove(1)} title="Naar rechts" aria-label="Tekstbalk naar rechts" className="rounded border border-borderButton px-2 py-1 text-sm text-textSecondary disabled:cursor-not-allowed disabled:opacity-30">→</button>
        <button onClick={() => setOpen((value) => !value)} className="text-xs font-bold text-accent">{open ? "Sluiten" : "Instellen"}</button>
        <button onClick={onRemove} className="text-xs font-bold text-red-300">Verwijderen</button>
      </>}
    </div>
    {open && <div className="mt-3 border-t border-borderSubtle pt-3">
      <TickerFields value={settings} onChange={setSettings} />
      <button disabled={!settings.text.trim()} onClick={() => {
        const saved = { ...block.configuration, persistentTicker: true, enabled: true, ...settings, text: settings.text.trim() };
        setSettings({ ...settings, text: settings.text.trim() });
        onSave(saved);
        setOpen(false);
      }} className={`${primary} mt-4 disabled:cursor-not-allowed disabled:opacity-50`}>Wijzigingen bewaren</button>
    </div>}
  </article>;
}

function TickerFields({ value, onChange }: { value: TickerSettings; onChange: (value: TickerSettings) => void }) {
  const set = <K extends keyof TickerSettings>(key: K, next: TickerSettings[K]) => onChange({ ...value, [key]: next });
  return <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-xs text-textMuted sm:col-span-2 lg:col-span-3">Tekst
      <input value={value.text} maxLength={240} onChange={(e) => set("text", e.target.value)} placeholder="Welkom bij onze club" className={`${field} mt-1 w-full`} />
    </label>
    <label className="text-xs text-textMuted">Tekstkleur
      <span className="mt-1 flex gap-2"><input type="color" value={value.textColor} onChange={(e) => set("textColor", e.target.value)} className="h-10 w-12 rounded border border-borderButton bg-card p-1" /><input value={value.textColor} onChange={(e) => set("textColor", e.target.value)} className={`${field} min-w-0 flex-1`} /></span>
    </label>
    <label className="text-xs text-textMuted">Achtergrond
      <select value={value.backgroundMode} onChange={(e) => set("backgroundMode", e.target.value as TickerSettings["backgroundMode"])} className={`${field} mt-1 w-full`}><option value="color">Kleur</option><option value="none">Geen achtergrond</option></select>
    </label>
    {value.backgroundMode === "color" && <label className="text-xs text-textMuted">Achtergrondkleur
      <span className="mt-1 flex gap-2"><input type="color" value={value.backgroundColor} onChange={(e) => set("backgroundColor", e.target.value)} className="h-10 w-12 rounded border border-borderButton bg-card p-1" /><input value={value.backgroundColor} onChange={(e) => set("backgroundColor", e.target.value)} className={`${field} min-w-0 flex-1`} /></span>
    </label>}
    <label className="text-xs text-textMuted">Lettergrootte
      <select value={value.fontSize} onChange={(e) => set("fontSize", e.target.value as TickerSettings["fontSize"])} className={`${field} mt-1 w-full`}><option value="small">Klein</option><option value="normal">Normaal</option><option value="large">Groot</option></select>
    </label>
    <label className="text-xs text-textMuted">Lettertype
      <select value={value.fontFamily} onChange={(e) => set("fontFamily", e.target.value as TickerSettings["fontFamily"])} className={`${field} mt-1 w-full`}><option value="sans">Modern</option><option value="rounded">Rond</option><option value="serif">Klassiek</option><option value="mono">Monospace</option></select>
    </label>
    <label className="text-xs text-textMuted">Uitlijning vaste tekst
      <select value={value.alignment} onChange={(e) => set("alignment", e.target.value as TickerSettings["alignment"])} className={`${field} mt-1 w-full`}><option value="left">Links</option><option value="center">Midden</option><option value="right">Rechts</option></select>
    </label>
    <label className="text-xs text-textMuted">Weergave
      <select value={value.displayMode} onChange={(e) => set("displayMode", e.target.value as TickerSettings["displayMode"])} className={`${field} mt-1 w-full`}><option value="fixed">Vaste tekst</option><option value="ticker">Bewegen bij te lange tekst</option></select>
    </label>
    <label className="text-xs text-textMuted">Scheidingsteken
      <select value={value.separator} onChange={(e) => set("separator", e.target.value as TickerSettings["separator"])} className={`${field} mt-1 w-full`}><option value="bullet">• Punt</option><option value="bar">| Streep</option><option value="space">Extra ruimte</option></select>
    </label>
  </div>;
}

function tickerSettings(configuration: Partial<TickerSettings>): TickerSettings {
  return { ...defaultTickerSettings, ...configuration, text: String(configuration?.text ?? "") };
}

function MatchHeaderEditor({
  screen,
  block,
  matches,
  canManage,
  act,
}: {
  screen: Screen;
  block?: Block;
  matches: Match[];
  canManage: boolean;
  act: ClubTvAct;
}) {
  const c = block?.configuration ?? {},
    [matchId, setMatchId] = useState(c.matchId ?? ""),
    [enabled, setEnabled] = useState(c.enabled !== false),
    [timed, setTimed] = useState(c.timed !== false),
    [before, setBefore] = useState(c.hoursBefore ?? 3),
    [after, setAfter] = useState(c.hoursAfter ?? 3),
    [score, setScore] = useState(c.showScore !== false),
    [lineup, setLineup] = useState(c.showLineup !== false),
    [sponsors, setSponsors] = useState(c.showMatchSponsors !== false),
    [donors, setDonors] = useState(c.showBallDonors !== false),
    [position, setPosition] = useState(c.position ?? "top");
  async function save() {
    const configuration = {
      matchId,
      enabled,
      timed,
      hoursBefore: before,
      hoursAfter: after,
      showScore: score,
      showLineup: lineup,
      showMatchSponsors: sponsors,
      showBallDonors: donors,
      position,
    };
    if (block)
      await act({
        action: "updateBlock",
        screenId: screen.id,
        blockId: block.id,
        configuration,
      });
    else
      await act({
        action: "addBlock",
        screenId: screen.id,
        blockType: "match_header",
        title: "Wedstrijdinformatie",
        displayOrder: -100,
        configuration,
      });
  }
  return (
    <section className="rounded-xl border border-accent/30 bg-accent/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-textBright">
            Vaste wedstrijdinformatie
          </h3>
          <p className="text-xs text-textMuted">
            Blijft bovenaan staan terwijl de kleinere inhoudsblokken wisselen.
          </p>
        </div>
        <label className="text-sm text-textSecondary">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />{" "}
          Tonen
        </label>
      </div>
      {enabled && (
        <>
          <select
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            className={`${field} mt-4 w-full`}
          >
            <option value="">Kies wedstrijd</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.match_date} · {m.team_a_name} – {m.team_b_name}
              </option>
            ))}
          </select>
          <div className="mt-4 flex flex-wrap gap-4">
            {([
              [score, setScore, "Stand"],
              [lineup, setLineup, "Opstelling"],
              [sponsors, setSponsors, "Wedstrijdsponsors"],
              [donors, setDonors, "Ballenschenkers"],
            ] as [boolean, (value: boolean) => void, string][]).map(([value, setter, label]) => (
              <label key={label} className="text-sm text-textSecondary">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setter(e.target.checked)}
                />{" "}
                {label}
              </label>
            ))}
          </div>
          <label className="mt-4 block max-w-xs text-xs text-textMuted">
            Positie op het scherm
            <select value={position} onChange={(e) => setPosition(e.target.value)} className={`${field} mt-1 w-full`}>
              <option value="top">Boven</option>
              <option value="middle">Midden</option>
              <option value="bottom">Onder</option>
            </select>
          </label>
          <TimeWindow
            timed={timed}
            setTimed={setTimed}
            before={before}
            setBefore={setBefore}
            after={after}
            setAfter={setAfter}
          />
        </>
      )}
      {canManage && (
        <button
          disabled={enabled && !matchId}
          onClick={() => void save()}
          className={`${primary} mt-4 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Wedstrijdinformatie bewaren
        </button>
      )}
    </section>
  );
}

function BlockRail({
  screen,
  blocks,
  teams,
  matches,
  clubId,
  canManage,
  act,
}: {
  screen: Screen;
  blocks: Block[];
  teams: ClubTvTeam[];
  matches: Match[];
  clubId: string;
  canManage: boolean;
  act: ClubTvAct;
}) {
  const [adding, setAdding] = useState(false),
    [editingId, setEditingId] = useState<string | null>(null),
    [type, setType] = useState("main_sponsors"),
    [matchId, setMatchId] = useState(""),
    [teamIds, setTeamIds] = useState<string[]>([]),
    [timed, setTimed] = useState(false),
    [before, setBefore] = useState(3),
    [after, setAfter] = useState(3),
    [duration, setDuration] = useState(8),
    [itemsPerSlide, setItemsPerSlide] = useState(4),
    [image, setImage] = useState<File | null>(null),
    [imageTitle, setImageTitle] = useState(""),
    [existingImageUrl, setExistingImageUrl] = useState<string | undefined>(undefined),
    [imagePreviewUrl, setImagePreviewUrl] = useState<string | undefined>(undefined),
    [blockError, setBlockError] = useState(""),
    [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (!image) {
      setImagePreviewUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(image);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  function startAdd() {
    setBlockError("");
    setEditingId(null);
    setType("main_sponsors");
    setMatchId("");
    setTeamIds([]);
    setTimed(false);
    setBefore(3);
    setAfter(3);
    setDuration(8);
    setItemsPerSlide(4);
    setImage(null);
    setImageTitle("");
    setExistingImageUrl(undefined);
    setAdding(true);
  }
  function startEdit(b: Block) {
    setBlockError("");
    const c = b.configuration ?? {};
    setEditingId(b.id);
    setType(b.block_type);
    setMatchId(c.matchId ?? "");
    setTeamIds(c.teamIds ?? []);
    setTimed(!!c.timed);
    setBefore(c.hoursBefore ?? 3);
    setAfter(c.hoursAfter ?? 3);
    setDuration(c.durationSeconds ?? 8);
    setItemsPerSlide(c.itemsPerSlide ?? 4);
    setImage(null);
    setImageTitle(b.title ?? "");
    setExistingImageUrl(c.imageUrl);
    setAdding(true);
  }
  async function save() {
    setUploading(true);
    setBlockError("");
    try {
      let imageUrl = existingImageUrl;
      if (type === "image") {
        if (image) imageUrl = await uploadClubTvImage(image, clubId, screen.id);
        if (!imageUrl) throw new Error("Kies eerst een afbeelding.");
      }
      const configuration = {
        matchId,
        teamIds,
        timed,
        hoursBefore: before,
        hoursAfter: after,
        durationSeconds: Math.max(2, Math.min(120, duration)),
        itemsPerSlide: Math.max(1, Math.min(6, itemsPerSlide)),
        imageUrl,
      };
      const result = editingId
        ? await act({
          action: "updateBlock",
          screenId: screen.id,
          blockId: editingId,
          title: imageTitle,
          configuration,
        })
        : await act({
          action: "addBlock",
          screenId: screen.id,
          blockType: type,
          title: imageTitle,
          displayOrder: blocks.length,
          configuration,
        });
      if (!result) {
        setBlockError("De wijziging kon niet worden bewaard. Controleer de melding onderaan en probeer opnieuw.");
        return;
      }
      if (editingId) {
        const savedConfiguration = result.block?.configuration;
        if (
          !savedConfiguration ||
          Number(savedConfiguration.durationSeconds) !== configuration.durationSeconds ||
          (type === "image" && savedConfiguration.imageUrl !== configuration.imageUrl)
        )
          throw new Error("De server kon de nieuwe afbeelding of weergaveduur niet bevestigen. Probeer opnieuw.");
      }
      setAdding(false);
      setEditingId(null);
      setImage(null);
      setImageTitle("");
    } catch (reason) {
      setBlockError(reason instanceof Error ? reason.message : "Het inhoudsblok kon niet worden bewaard.");
    } finally {
      setUploading(false);
    }
  }
  return (
    <section>
      <div>
        <h3 className="font-black text-textBright">Inhoudsblokken</h3>
        <p className="text-xs text-textMuted">
          De blokken staan in deze volgorde van links naar rechts en worden
          kleiner onder de wedstrijdheader getoond.
        </p>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
        {blocks
          .sort((a, b) => a.display_order - b.display_order)
          .map((b) => (
            <div
              key={b.id}
              className="w-56 shrink-0 rounded-xl border border-borderSubtle bg-cardDeep p-4"
            >
              <strong className="text-textBright">
                {labelFor(b.block_type)}
              </strong>
              <p className="mt-2 text-xs text-textMuted">
                {b.configuration.durationSeconds ?? 8} seconden ·{" "}
                {b.configuration.timed
                  ? `${b.configuration.hoursBefore ?? 0}u vóór tot ${b.configuration.hoursAfter ?? 0}u na`
                  : "altijd actief"}
              </p>
              {canManage && (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => startEdit(b)}
                    className="text-xs font-bold text-accent"
                  >
                    Bewerken
                  </button>
                  <button
                    onClick={() =>
                      void act({
                        action: "removeBlock",
                        screenId: screen.id,
                        blockId: b.id,
                      })
                    }
                    className="text-xs font-bold text-red-300"
                  >
                    Verwijderen
                  </button>
                </div>
              )}
            </div>
          ))}
        {canManage && (
          <button
            onClick={startAdd}
            className="grid min-h-32 w-44 shrink-0 place-items-center rounded-xl border-2 border-dashed border-accent/40 text-center text-accent"
          >
            <span>
              <b className="block text-3xl">+</b>
              <small>Blok toevoegen</small>
            </span>
          </button>
        )}
      </div>
      {adding && (
        <div className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
          <h4 className="font-bold text-textBright">
            {editingId ? "Blok bewerken" : "Blok toevoegen"}
          </h4>
          {editingId ? (
            <p className="mt-3 text-sm text-textPrimary">
              Type: <strong>{labelFor(type)}</strong>
            </p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {blockOptions.map(([id, label, help]) => (
                <button
                  key={id}
                  onClick={() => setType(id)}
                  className={`rounded-lg border p-3 text-left ${type === id ? "border-accent bg-accent/10" : "border-borderButton"}`}
                >
                  <strong className="text-textBright">{label}</strong>
                  <span className="mt-1 block text-xs text-textMuted">
                    {help}
                  </span>
                </button>
              ))}
            </div>
          )}
          {["match_sponsors", "ball_donors"].includes(type) && (
            <select
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              className={`${field} mt-4 w-full`}
            >
              <option value="">Gebruik wedstrijd van vaste header</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.match_date} · {m.team_a_name} – {m.team_b_name}
                </option>
              ))}
            </select>
          )}
          {type === "players" && (
            <div className="mt-4 space-y-4">
              <label className="block max-w-xs text-xs text-textMuted">
                Foto&apos;s per dia
                <input type="number" min="1" max="6" value={itemsPerSlide} onChange={(e) => setItemsPerSlide(+e.target.value)} className={`${field} mt-1 w-full`} />
              </label>
              <div className="flex flex-wrap gap-3">
              {teams.map((t) => (
                <label key={t.id} className="text-sm text-textSecondary">
                  <input
                    type="checkbox"
                    checked={teamIds.includes(t.id)}
                    onChange={() =>
                      setTeamIds((v) =>
                        v.includes(t.id)
                          ? v.filter((x) => x !== t.id)
                          : [...v, t.id],
                      )
                    }
                  />{" "}
                  {t.name}
                  {t.club_seasons?.name ? ` · ${t.club_seasons.name}` : ""}
                </label>
              ))}
              </div>
            </div>
          )}
          {type === "image" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-textMuted">
                Titel (optioneel)
                <input
                  value={imageTitle}
                  onChange={(e) => setImageTitle(e.target.value)}
                  placeholder="Jeugdtornooi zaterdag"
                  className={`${field} mt-1 w-full`}
                />
              </label>
              <label className="text-xs text-textMuted">
                {existingImageUrl ? "Afbeelding vervangen (optioneel)" : "Afbeelding"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                  className="mt-2 block w-full text-sm text-textSecondary"
                />
              </label>
              {image && (
                <div className="sm:col-span-2 rounded-lg border border-borderSubtle p-3 text-sm text-textSecondary">
                  <strong className="text-textBright">Geselecteerd:</strong>{" "}
                  {image.name} · {(image.size / 1024 / 1024).toFixed(1)} MB
                </div>
              )}
              {(imagePreviewUrl || existingImageUrl) && (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-xs text-textMuted">Voorbeeld</p>
                  <Image
                    src={(imagePreviewUrl || existingImageUrl)!}
                    alt={imageTitle || "Voorbeeld van de afbeelding"}
                    width={208}
                    height={128}
                    unoptimized
                    className="h-32 w-52 rounded-lg border border-borderSubtle bg-card object-contain"
                  />
                </div>
              )}
              {!image && existingImageUrl && (
                <div className="sm:col-span-2 rounded-lg border border-borderSubtle p-3 text-sm text-textSecondary">
                  <strong className="text-textBright">Huidige afbeelding blijft behouden</strong> tenzij je een nieuwe kiest.
                </div>
              )}
            </div>
          )}
          <label className="mt-4 block max-w-xs text-xs text-textMuted">
            Weergaveduur in seconden
            <input
              type="number"
              min="2"
              max="120"
              value={duration}
              onChange={(e) => setDuration(+e.target.value)}
              className={`${field} mt-1 w-full`}
            />
          </label>
          <TimeWindow
            timed={timed}
            setTimed={setTimed}
            before={before}
            setBefore={setBefore}
            after={after}
            setAfter={setAfter}
          />
          <div className="mt-4 flex gap-2">
            <button
              disabled={uploading || (type === "image" && !image && !existingImageUrl)}
              onClick={() => void save()}
              className={`${primary} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {uploading ? "Bezig…" : editingId ? "Wijzigen" : "Toevoegen"}
            </button>
            <button
              disabled={uploading}
              onClick={() => {
                setAdding(false);
                setEditingId(null);
              }}
              className={secondary}
            >
              Annuleren
            </button>
          </div>
          {blockError && <p className="mt-3 text-sm text-red-300">{blockError}</p>}
        </div>
      )}
    </section>
  );
}

async function uploadClubTvImage(file: File, clubId: string, screenId: string) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Kies een PNG-, JPEG- of WebP-afbeelding.");
  if (file.size > 12 * 1024 * 1024)
    throw new Error("Een Club-TV-afbeelding mag maximaal 12 MB groot zijn.");
  const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "png",
    key = `clubs/${clubId}/club-tv/${screenId}-${crypto.randomUUID()}.${extension}`;
  const prepare = await fetch("/api/videos/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, contentType: file.type }),
    }),
    prepared = await prepare.json();
  if (!prepare.ok)
    throw new Error(prepared.error || "Upload kon niet worden voorbereid.");
  const put = await fetch(prepared.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload mislukt (HTTP ${put.status}).`);
  return prepared.publicUrl;
}

function TimeWindow({
  timed,
  setTimed,
  before,
  setBefore,
  after,
  setAfter,
}: {
  timed: boolean;
  setTimed: (v: boolean) => void;
  before: number;
  setBefore: (v: number) => void;
  after: number;
  setAfter: (v: number) => void;
}) {
  return (
    <div className="mt-4">
      <label className="text-sm font-semibold text-textSecondary">
        <input
          type="checkbox"
          checked={timed}
          onChange={(e) => setTimed(e.target.checked)}
        />{" "}
        Alleen tonen binnen een tijdvenster
      </label>
      {timed && (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-textMuted">
            Uren vóór
            <input
              type="number"
              min="0"
              value={before}
              onChange={(e) => setBefore(+e.target.value)}
              className={`${field} mt-1 w-full`}
            />
          </label>
          <label className="text-xs text-textMuted">
            Uren na
            <input
              type="number"
              min="0"
              value={after}
              onChange={(e) => setAfter(+e.target.value)}
              className={`${field} mt-1 w-full`}
            />
          </label>
        </div>
      )}
    </div>
  );
}
function labelFor(type: string) {
  return (
    blockOptions.find((x) => x[0] === type)?.[1] ??
    (type === "match" ? "Wedstrijdinformatie" : type)
  );
}
const field =
  "rounded-lg border border-borderButton bg-card px-3 py-2 text-sm text-textPrimary outline-none focus:border-accent";
const primary = "rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page";
const secondary =
  "rounded-lg border border-borderButton px-4 py-2 text-sm font-semibold text-textPrimary";
