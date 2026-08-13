"use client";
import { FormEvent, useEffect, useState } from "react";

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

export function ClubTvManager() {
  const [data, setData] = useState<any>({
      screens: [],
      matches: [],
      teams: [],
    }),
    [openId, setOpenId] = useState(""),
    [name, setName] = useState(""),
    [location, setLocation] = useState(""),
    [error, setError] = useState("");
  async function load() {
    const r = await fetch("/api/club/club-tv", { cache: "no-store" }),
      x = await r.json();
    if (!r.ok) throw Error(x.error);
    setData(x);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function act(body: any) {
    setError("");
    const r = await fetch("/api/club/club-tv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      x = await r.json();
    if (!r.ok) {
      setError(x.error);
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
  teams: any[];
  clubId: string;
  canManage: boolean;
  act: (x: any) => Promise<any>;
}) {
  const header = screen.club_tv_blocks.find(
      (b) => b.block_type === "match_header" || b.block_type === "match",
    ),
    ticker = screen.club_tv_blocks.find(
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
          <TickerEditor screen={screen} block={ticker} canManage={canManage} act={act} />
          <BlockRail
            screen={screen}
            blocks={screen.club_tv_blocks.filter((b) => b !== header && b !== ticker)}
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

function TickerEditor({ screen, block, canManage, act }: {
  screen: Screen; block?: Block; canManage: boolean; act: (x: any) => Promise<any>;
}) {
  const [enabled, setEnabled] = useState(block?.configuration?.enabled === true),
    [text, setText] = useState(block?.configuration?.text ?? "");
  async function save() {
    const configuration = { persistentTicker: true, enabled, text: text.trim() };
    await act(block
      ? { action: "updateBlock", screenId: screen.id, blockId: block.id, configuration }
      : { action: "addBlock", screenId: screen.id, blockType: "image", title: "Tekstbalk", displayOrder: 10000, configuration });
  }
  return <section className="rounded-xl border border-borderSubtle bg-cardDeep p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div>
      <h3 className="font-black text-textBright">Tekstbalk onderaan</h3>
      <p className="text-xs text-textMuted">Blijft zichtbaar terwijl sponsors, foto&apos;s en andere blokken wisselen.</p>
    </div><label className="text-sm text-textSecondary"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Tonen</label></div>
    <label className="mt-4 block text-xs text-textMuted">Tekst
      <input value={text} maxLength={240} onChange={(e) => setText(e.target.value)} placeholder="Welkom bij onze club · Volgende thuiswedstrijd zaterdag om 20.00 uur" className={`${field} mt-1 w-full`} />
    </label>
    {canManage && <button disabled={enabled && !text.trim()} onClick={() => void save()} className={`${primary} mt-4 disabled:opacity-50`}>Tekstbalk bewaren</button>}
  </section>;
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
  act: (x: any) => Promise<any>;
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
    [donors, setDonors] = useState(c.showBallDonors !== false);
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
            {[
              [score, setScore, "Stand"],
              [lineup, setLineup, "Opstelling"],
              [sponsors, setSponsors, "Wedstrijdsponsors"],
              [donors, setDonors, "Ballenschenkers"],
            ].map(([value, setter, label]: any) => (
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
          className={`${primary} mt-4 disabled:opacity-50`}
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
  teams: any[];
  matches: Match[];
  clubId: string;
  canManage: boolean;
  act: (x: any) => Promise<any>;
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
    [uploading, setUploading] = useState(false);
  function startAdd() {
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
      if (editingId)
        await act({
          action: "updateBlock",
          screenId: screen.id,
          blockId: editingId,
          title: imageTitle,
          configuration,
        });
      else
        await act({
          action: "addBlock",
          screenId: screen.id,
          blockType: type,
          title: imageTitle,
          displayOrder: blocks.length,
          configuration,
        });
      setAdding(false);
      setEditingId(null);
      setImage(null);
      setImageTitle("");
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
              className={`${primary} disabled:opacity-50`}
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
