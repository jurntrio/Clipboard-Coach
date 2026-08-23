"use client";
import Image from "next/image";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { ClubLogoImage } from "@/components/clubs/ClubLogoImage";

export default function ClubTvShow({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { preview?: string };
}) {
  const [data, setData] = useState<any>(null),
    [index, setIndex] = useState(0),
    [now, setNow] = useState(new Date());
  useEffect(() => {
    let active = true;
    const load = () =>
      fetch(
        `/api/club-tv/${params.token}${searchParams.preview === "1" ? "?preview=1" : ""}`,
        { cache: "no-store" },
      )
        .then((r) => r.json())
        .then((x) => active && setData(x));
    void load();
    const refresh = setInterval(load, 10000),
      clock = setInterval(() => setNow(new Date()), 1000);
    return () => {
      active = false;
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, [params.token, searchParams.preview]);
  const slides = useMemo(() => buildSlides(data), [data]),
    slide = slides[index % Math.max(1, slides.length)];
  useEffect(() => {
    if (!slides.length) return;
    const t = setTimeout(
      () => setIndex((i) => (i + 1) % slides.length),
      (slide?.durationSeconds ?? data?.screen?.slide_duration_seconds ?? 8) *
        1000,
    );
    return () => clearTimeout(t);
  }, [
    index,
    slides.length,
    slide?.durationSeconds,
    data?.screen?.slide_duration_seconds,
  ]);
  if (!data)
    return (
      <main className="grid min-h-screen place-items-center bg-[#07130f] text-white">
        Club TV laden…
      </main>
    );
  if (data.error)
    return (
      <main className="grid min-h-screen place-items-center bg-[#07130f] text-white">
        {data.error}
      </main>
    );
  const headerMatch = data.header
    ? data.matches?.[data.header.configuration.matchId]
    : null;
  const matchPosition = data.header?.configuration?.position ?? "top";
  const matchHeader = headerMatch ? (
    <MatchHeader
      match={headerMatch}
      config={data.header.configuration}
      now={now}
      showClock={data.screen.show_clock}
    />
  ) : null;
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#174936,#06110d_68%)] p-[3vw] text-white">
      {data.screen.clubs?.logo_url && (
        <Image
          src={data.screen.clubs.logo_url}
          alt=""
          width={1200}
          height={1200}
          unoptimized
          className="pointer-events-none absolute left-1/2 top-1/2 h-[130vmin] w-[130vmin] -translate-x-1/2 -translate-y-1/2 select-none object-contain opacity-[0.06] grayscale"
        />
      )}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {data.screen.show_clock && !headerMatch && (
          <header className="flex items-center justify-end">
            <time className="text-3xl font-black tabular-nums">
              {now.toLocaleTimeString("nl-BE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </header>
        )}
        {matchPosition === "top" && matchHeader}
        <section
          key={slide?.key}
          className={`m-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col items-center justify-center py-6 text-center club-tv-${data.screen.transition_effect}`}
        >
          {matchPosition === "middle" && matchHeader}
          {slide?.node ?? <p className="text-4xl font-black">Welkom</p>}
        </section>
        {matchPosition === "bottom" && matchHeader}
        {!!data.tickers?.length && <TickerFooter tickers={data.tickers} />}
      </div>
    </main>
  );
}

function TickerFooter({ tickers }: { tickers: any[] }) {
  const viewportRef = useRef<HTMLElement>(null),
    trackRef = useRef<HTMLDivElement>(null),
    [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const measure = () => setOverflowing(
      (trackRef.current?.scrollWidth ?? 0) > (viewportRef.current?.clientWidth ?? 0),
    );
    measure();
    const observer = new ResizeObserver(measure);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (trackRef.current) observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, [tickers]);
  const first = tickerConfig(tickers[0]?.configuration),
    shouldMove = overflowing && tickers.some((ticker) => tickerConfig(ticker.configuration).displayMode === "ticker"),
    alignment = first.alignment === "left" ? "flex-start" : first.alignment === "right" ? "flex-end" : "center",
    duration = Math.max(16, tickers.reduce((total, ticker) => total + String(ticker.configuration?.text ?? "").length, 0) * 0.18);
  return <footer
    ref={viewportRef}
    className="relative z-20 -mx-[3vw] -mb-[3vw] overflow-hidden border-t border-emerald-300/25 shadow-[0_-12px_35px_rgba(0,0,0,.3)]"
    style={{ background: first.backgroundMode === "none" ? "transparent" : first.backgroundColor }}
  >
    <div
      ref={trackRef}
      className={`club-tv-ticker-track flex w-max min-w-full items-stretch whitespace-nowrap ${shouldMove ? "club-tv-ticker-moving" : ""}`}
      style={{ justifyContent: shouldMove ? "flex-start" : alignment, "--ticker-duration": `${duration}s` } as CSSProperties}
    >
      {tickers.map((ticker, index) => {
        const config = tickerConfig(ticker.configuration),
          separator = config.separator === "bar" ? "|" : config.separator === "space" ? "" : "•";
        return <span key={ticker.id} className="flex items-center">
          <span style={tickerTextStyle(config)} className="px-[3vw] py-4 font-bold tracking-wide">{config.text}</span>
          {index < tickers.length - 1 && <span aria-hidden="true" className={config.separator === "space" ? "w-12" : "px-2 text-white/60"}>{separator}</span>}
        </span>;
      })}
    </div>
  </footer>;
}

function tickerConfig(value: any) {
  return {
    text: String(value?.text ?? ""),
    textColor: value?.textColor ?? "#ffffff",
    backgroundMode: value?.backgroundMode === "none" ? "none" : "color",
    backgroundColor: value?.backgroundColor ?? "#000000",
    fontSize: ["small", "large"].includes(value?.fontSize) ? value.fontSize : "normal",
    fontFamily: ["rounded", "serif", "mono"].includes(value?.fontFamily) ? value.fontFamily : "sans",
    alignment: ["left", "right"].includes(value?.alignment) ? value.alignment : "center",
    displayMode: value?.displayMode === "fixed" ? "fixed" : "ticker",
    separator: ["bar", "space"].includes(value?.separator) ? value.separator : "bullet",
  };
}

function tickerTextStyle(config: ReturnType<typeof tickerConfig>): CSSProperties {
  const sizes = { small: "1.125rem", normal: "1.5rem", large: "2rem" },
    families = {
      sans: "ui-sans-serif, system-ui, sans-serif",
      rounded: "ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif",
      serif: "Georgia, 'Times New Roman', serif",
      mono: "ui-monospace, SFMono-Regular, Consolas, monospace",
    };
  return {
    color: config.textColor,
    background: config.backgroundMode === "none" ? "transparent" : config.backgroundColor,
    fontSize: sizes[config.fontSize as keyof typeof sizes],
    fontFamily: families[config.fontFamily as keyof typeof families],
  };
}

function MatchHeader({
  match,
  config,
  now,
  showClock,
}: {
  match: any;
  config: any;
  now: Date;
  showClock: boolean;
}) {
  const clock = showClock ? getClockDisplay(now, match) : null;
  return (
    <section className="mt-5 rounded-2xl border border-emerald-300/20 bg-black/25 px-6 py-4">
      <div className="relative flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
        <strong className="flex items-center gap-4 text-3xl">
          <ClubLogoImage logo={match.team_a_logo ?? { src: null, quality: "missing" }} naam={match.team_a_name} purpose="display" className="shrink-0" />
          <span>
            {match.team_a_name} <span className="text-emerald-300">–</span>{" "}
            {match.team_b_name}
          </span>
          <ClubLogoImage logo={match.team_b_logo ?? { src: null, quality: "missing" }} naam={match.team_b_name} purpose="display" className="shrink-0" />
        </strong>
        {config.showScore && match.score_a !== null && (
          <span className="rounded-lg bg-white/10 px-4 py-2 text-3xl font-black">
            {match.score_a} – {match.score_b}
          </span>
        )}
        <span className="text-xl text-white/70">
          {match.match_date} · {match.start_time?.slice(0, 5)}
        </span>
        {clock && (
          <span className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-col items-center leading-tight">
            {clock.countdown && (
              <span className="text-xs uppercase tracking-[.2em] text-emerald-300">
                Aftrap over
              </span>
            )}
            <time className="text-3xl font-black tabular-nums">
              {clock.text}
            </time>
          </span>
        )}
      </div>
      {config.showLineup && match.match_dossiers?.[0]?.lineup_notes && (
        <p className="mt-3 line-clamp-2 text-center text-sm text-white/60">
          {match.match_dossiers[0].lineup_notes}
        </p>
      )}
    </section>
  );
}
function getClockDisplay(now: Date, match: any) {
  const kickoff =
    match?.match_date && match?.start_time
      ? new Date(`${match.match_date}T${match.start_time}`)
      : null;
  if (kickoff && !isNaN(kickoff.getTime())) {
    const diffMs = kickoff.getTime() - now.getTime();
    if (diffMs > 0 && diffMs <= 3 * 60 * 60 * 1000) {
      const totalSeconds = Math.floor(diffMs / 1000),
        pad = (n: number) => String(n).padStart(2, "0");
      return {
        countdown: true,
        text: `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`,
      };
    }
  }
  return {
    countdown: false,
    text: now.toLocaleTimeString("nl-BE", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function buildSlides(data: any) {
  if (!data?.blocks) return [];
  const out: any[] = [];
  for (const b of data.blocks) {
    if (["main_sponsors", "sponsors"].includes(b.block_type)) {
      const wanted = b.block_type === "main_sponsors" ? "main_sponsor" : null;
      const eligible = (data.sponsors ?? []).filter((s: any) => {
        const level = s.sponsor_assignments?.find(
          (a: any) => a.status === "active",
        )?.sponsor_level;
        return !wanted || level === wanted;
      });
      const displayed =
        wanted && !eligible.length ? (data.sponsors ?? []) : eligible;
      for (const s of displayed) out.push(sponsorSlide(b, s));
    }
    if (["match_sponsors", "ball_donors"].includes(b.block_type)) {
      const matchId =
          b.configuration.matchId || data.header?.configuration?.matchId,
        role =
          b.block_type === "match_sponsors"
            ? "match_sponsor"
            : "match_ball_donor";
      for (const p of partnersFor(data, matchId).filter(
        (x: any) => x.partner_role === role,
      ))
        if (p.sponsors) out.push(sponsorSlide(b, p.sponsors));
    }
    if (b.block_type === "players") {
      for (const team of data.teams ?? []) {
        const players = team.players ?? [],
          itemsPerSlide = Math.max(
            1,
            Math.min(6, Number(b.configuration.itemsPerSlide) || 4),
          );
        for (let offset = 0; offset < players.length; offset += itemsPerSlide) {
          const group = players.slice(offset, offset + itemsPerSlide);
          out.push({
            key: `${b.id}-${team.id}-${offset}`,
            durationSeconds: b.configuration.durationSeconds,
            node: (
              <>
                <p className="mb-5 text-2xl font-bold text-emerald-300">
                  {team.name}
                </p>
                <div
                  className="grid w-full gap-5"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(itemsPerSlide, 4)}, minmax(0, 1fr))`,
                  }}
                >
                  {group.map((player: any) => (
                    <PlayerCard key={player.id} player={player} />
                  ))}
                </div>
              </>
            ),
          });
        }
      }
      continue;
    }
    if (b.block_type === "players")
      for (const team of data.teams ?? [])
        for (const p of team.players?.filter(
          (x: any) => x.role === "player" && x.photo_url,
        ) ?? [])
          out.push({
            key: `${b.id}-${p.id}`,
            node: (
              <>
                <p className="mb-4 text-xl text-emerald-300">{team.name}</p>
                <Image
                  src={p.photo_url}
                  alt={`${p.first_name} ${p.last_name}`}
                  width={520}
                  height={520}
                  unoptimized
                  className="h-[38vh] w-[38vh] rounded-3xl object-cover shadow-2xl"
                />
                <h2 className="mt-5 text-4xl font-black">
                  {p.jersey_number ? `${p.jersey_number} · ` : ""}
                  {p.first_name} {p.last_name}
                </h2>
              </>
            ),
          });
    if (b.block_type === "image" && b.configuration.imageUrl)
      out.push({
        key: b.id,
        node: (
          <>
            {b.title && <h2 className="mb-5 text-3xl font-black">{b.title}</h2>}
            <Image
              src={b.configuration.imageUrl}
              alt={b.title || "Club-TV-afbeelding"}
              width={1800}
              height={1000}
              unoptimized
              className="max-h-[78vh] max-w-[92vw] rounded-2xl object-contain"
            />
          </>
        ),
      });
  }
  const queues = data.blocks
    .map((block: any) =>
      out.filter((slide) => String(slide.key).startsWith(`${block.id}-`) || slide.key === block.id),
    )
    .filter((queue: any[]) => queue.length);
  const interleaved: any[] = [];
  for (let index = 0; queues.some((queue: any[]) => index < queue.length); index += 1)
    for (const queue of queues) if (queue[index]) interleaved.push(queue[index]);
  return interleaved;
}
function sponsorSlide(b: any, s: any) {
  const url = s.alternate_logo_url || s.logo_url;
  return {
    key: `${b.id}-${s.id}`,
    durationSeconds: b.configuration.durationSeconds,
    node: url ? (
      <Image
        src={url}
        alt={s.company_name}
        width={1400}
        height={650}
        unoptimized
        className="max-h-[70vh] max-w-[92vw] object-contain"
      />
    ) : (
      <div className="rounded-3xl border border-white/15 bg-white/5 px-14 py-12">
        <h2 className="text-6xl font-black">{s.company_name}</h2>
        {s.website_url && (
          <p className="mt-5 text-2xl text-emerald-300">
            {displayWebsite(s.website_url)}
          </p>
        )}
      </div>
    ),
  };
}
function partnersFor(data: any, matchId: string) {
  return (
    data?.matchPartners?.find((x: any) => x.match_id === matchId)
      ?.sponsor_match_partners ?? []
  );
}
function PlayerCard({ player }: { player: any }) {
  const fullName = `${player.first_name} ${player.last_name}`.trim();
  const initials =
    `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`.toUpperCase();
  return (
    <article className="flex min-w-0 flex-col items-center">
      {player.photo_url ? (
        <Image
          src={player.photo_url}
          alt={fullName}
          width={320}
          height={320}
          unoptimized
          className="aspect-square w-full max-w-64 rounded-2xl object-cover shadow-xl"
        />
      ) : (
        <div className="grid aspect-square w-full max-w-64 place-items-center rounded-2xl border border-emerald-300/25 bg-white/10 text-6xl font-black text-emerald-300 shadow-xl">
          {initials || "–"}
        </div>
      )}
      <h2 className="mt-4 break-words text-2xl font-black">{fullName}</h2>
    </article>
  );
}
function displayWebsite(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}
