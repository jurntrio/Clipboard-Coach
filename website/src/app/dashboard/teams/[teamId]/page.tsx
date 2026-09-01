"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TrainingStatistics, type TrainingStatistic } from "@/components/training/TrainingStatistics";
import { TeamContextPanel } from "@/components/teams/TeamContextPanel";
import { useKeyedFetch } from "@/hooks/useKeyedFetch";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n/messages";
import type { Match, Player, Team } from "@/types/database";
import { hasScheduledEventEnded } from "@/lib/schedule-status";

type Tab = "overview" | "staff" | "matches" | "training" | "evaluations" | "statistics" | "tests";
type StaffMember = { id: string; user_id: string; full_name: string; role: string };
type PlayerContact = { id: string; full_name: string; email: string | null; phone_number: string | null };
type DetailedPlayer = Player & { contacts?: PlayerContact[]; can_manage?: boolean };
type TeamDetail = Team & { players: DetailedPlayer[]; linked_staff?: StaffMember[] };
type Training = { id: string; training_date: string; start_time: string; field_option_id: string | null; locker_room_option_id: string | null; attendance_confirmed_at: string | null; workload_modalities: Array<{ category: string; modality: string; color: string; matchFormat: string; details: string[] }>; workload_note: string };
type TrainingData = { trainings: Training[]; optionNames: Record<string, string> };
type MatchStatistic = { playerId: string; playerName: string; appearances: number; goals: number; assists: number };
type StatisticsData = { training: TrainingStatistic[]; matches: MatchStatistic[]; friendlyMatches: MatchStatistic[]; competitionMatches: MatchStatistic[]; cupMatches: MatchStatistic[]; hasCupMatches: boolean };
type MatchStatisticsFilter = "all" | "friendly" | "competition" | "cup";

export default function TeamDetailPage() {
  const { teamId: initialTeamId } = useParams<{ teamId: string }>();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const [teamId, setTeamId] = useState(initialTeamId);
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(isTab(requestedTab) ? requestedTab : "overview");
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [teamOptions, setTeamOptions] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [trainings, setTrainings] = useState<Training[] | null>(null);
  const [optionNames, setOptionNames] = useState<Record<string, string>>({});
  const [statistics, setStatistics] = useState<TrainingStatistic[] | null>(null);
  const [matchStatistics, setMatchStatistics] = useState<MatchStatistic[] | null>(null);
  const [friendlyMatchStatistics, setFriendlyMatchStatistics] = useState<MatchStatistic[]>([]);
  const [competitionMatchStatistics, setCompetitionMatchStatistics] = useState<MatchStatistic[]>([]);
  const [cupMatchStatistics, setCupMatchStatistics] = useState<MatchStatistic[]>([]);
  const [hasCupMatches, setHasCupMatches] = useState(false);
  const [matchStatisticsFilter, setMatchStatisticsFilter] = useState<MatchStatisticsFilter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingSection, setLoadingSection] = useState<"matches" | "training" | null>(null);
  const [scheduleNow, setScheduleNow] = useState(() => new Date());
  const overview = useKeyedFetch<TeamDetail>();
  const details = useKeyedFetch<TeamDetail>();
  const matchesSection = useKeyedFetch<Match[]>();
  const trainingSection = useKeyedFetch<TrainingData>();
  const statisticsSection = useKeyedFetch<StatisticsData>();
  const activeTeamId = useRef(initialTeamId);
  const sectionRequests = useRef(new Map<string, Promise<void>>());

  // matchesSection/trainingSection/statisticsSection are fresh objects every render,
  // but their fetchKeyed methods are ref-backed and stable (see useKeyedFetch), so it's
  // safe to treat this callback as never needing to change.
  const preloadTeamSections = useCallback(async (selectedTeamId: string) => {
    const existingRequest = sectionRequests.current.get(selectedTeamId);
    if (existingRequest) return existingRequest;
    const request = Promise.all([
      matchesSection.fetchKeyed(selectedTeamId, `/api/teams/${selectedTeamId}?section=matches`, (body: { matches: Match[] }) => body.matches ?? [])
        .then((result) => { if (result && activeTeamId.current === selectedTeamId) setMatches(result); }),
      trainingSection.fetchKeyed(selectedTeamId, `/api/teams/${selectedTeamId}?section=training`, (body: { trainings: Training[]; training_options: { id: string; label: string }[] }) => ({
        trainings: body.trainings ?? [],
        optionNames: Object.fromEntries((body.training_options ?? []).map(option => [option.id, option.label]))
      })).then((result) => { if (result && activeTeamId.current === selectedTeamId) { setTrainings(result.trainings); setOptionNames(result.optionNames); } }),
      statisticsSection.fetchKeyed(selectedTeamId, `/api/teams/${selectedTeamId}?section=statistics`, (body: { statistics: TrainingStatistic[]; match_statistics: MatchStatistic[]; match_statistics_by_type?: { friendly?: MatchStatistic[]; competition?: MatchStatistic[]; cup?: MatchStatistic[] }; has_cup_matches?: boolean }) => ({ training: body.statistics ?? [], matches: body.match_statistics ?? [], friendlyMatches: body.match_statistics_by_type?.friendly ?? [], competitionMatches: body.match_statistics_by_type?.competition ?? [], cupMatches: body.match_statistics_by_type?.cup ?? [], hasCupMatches: body.has_cup_matches === true }))
        .then((result) => { if (result && activeTeamId.current === selectedTeamId) { setStatistics(result.training); setMatchStatistics(result.matches); setFriendlyMatchStatistics(result.friendlyMatches); setCompetitionMatchStatistics(result.competitionMatches); setCupMatchStatistics(result.cupMatches); setHasCupMatches(result.hasCupMatches); } })
    ]).then(() => undefined).finally(() => sectionRequests.current.delete(selectedTeamId));
    sectionRequests.current.set(selectedTeamId, request);
    return request;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setScheduleNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function selectTabFromNavigation(event: Event) {
      const requested = (event as CustomEvent<{ tab?: string }>).detail?.tab ?? null;
      if (isTab(requested)) setTab(requested);
    }
    window.addEventListener("dashboard-team-tab", selectTabFromNavigation);
    return () => window.removeEventListener("dashboard-team-tab", selectTabFromNavigation);
  }, []);

  useEffect(() => {
    activeTeamId.current = teamId;
    const cachedTeam = overview.getCached(teamId);
    if (cachedTeam) {
      setTeam(cachedTeam);
      setLoading(false);
      return;
    }
    setLoading(true);
    void overview.fetchKeyed(teamId, `/api/teams/${teamId}`, (body: { team: TeamDetail }) => body.team).then((result) => {
      if (result && activeTeamId.current === teamId) setTeam(result);
    }).finally(() => {
      if (activeTeamId.current === teamId) setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useEffect(() => {
    if (!team) return;
    const timer = window.setTimeout(() => {
      void details.fetchKeyed(teamId, `/api/teams/${teamId}?section=details`, (body: { team: TeamDetail }) => body.team).then(result => {
        if (result && activeTeamId.current === teamId) setTeam(result);
      });
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, team?.id]);

  useEffect(() => {
    void fetch("/api/teams?all=true", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const body = await response.json() as { teams?: Team[] };
      setTeamOptions((body.teams ?? []).filter(item => item.name.trim().toUpperCase() !== "EXTRA"));
    });
  }, []);

  useEffect(() => {
    if (tab === "matches" && matches === null) {
      setLoadingSection("matches");
      void preloadTeamSections(teamId).finally(() => {
        if (activeTeamId.current === teamId) setLoadingSection(null);
      });
    }
    if ((tab === "training" || tab === "statistics") && trainings === null) {
      setLoadingSection("training");
      void preloadTeamSections(teamId).finally(() => {
        if (activeTeamId.current === teamId) setLoadingSection(null);
      });
    }
    if (tab === "statistics" && (matches === null || statistics === null)) void preloadTeamSections(teamId);
  }, [matches, tab, teamId, trainings, statistics, preloadTeamSections]);

  const players = useMemo(() => (team?.players ?? []).filter((player) => player.role !== "staff").sort(sortPeople), [team]);
  const legacyStaff = useMemo(() => (team?.players ?? []).filter((player) => player.role === "staff").sort(sortPeople), [team]);
  const upcomingTrainings = useMemo(() => [...(trainings ?? [])].filter((item) => !hasScheduledEventEnded(item.training_date, item.start_time, scheduleNow)).sort(sortTrainingsAscending), [trainings, scheduleNow]);
  const pastTrainings = useMemo(() => [...(trainings ?? [])].filter((item) => hasScheduledEventEnded(item.training_date, item.start_time, scheduleNow)).sort(sortTrainingsDescending), [trainings, scheduleNow]);
  const upcomingMatches = useMemo(() => [...(matches ?? [])].filter((item) => !hasScheduledEventEnded(item.match_date, item.start_time, scheduleNow)).sort(sortMatchesAscending), [matches, scheduleNow]);
  const pastMatches = useMemo(() => [...(matches ?? [])].filter((item) => hasScheduledEventEnded(item.match_date, item.start_time, scheduleNow)).sort(sortMatchesDescending), [matches, scheduleNow]);
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("team.overview") },
    { id: "staff", label: t("team.staffTab") },
    { id: "matches", label: t("common.matches") },
    { id: "training", label: t("team.trainings") },
    { id: "evaluations", label: t("team.evaluations") },
    { id: "statistics", label: "Statistieken" },
    { id: "tests", label: t("team.tests") }
  ];

  function openTeam(option: Team) {
    if (option.id === teamId) return;
    if (option.club_team_id) void fetch("/api/team-context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clubTeamId: option.club_team_id }) });
    const tabQuery = tab === "overview" ? "" : `?tab=${tab}`;
    window.history.replaceState(null, "", `/dashboard/teams/${option.id}${tabQuery}`);
    const cachedTeam = overview.getCached(option.id);
    const cachedMatches = matchesSection.getCached(option.id) ?? null;
    const cachedTraining = trainingSection.getCached(option.id) ?? null;
    const cachedStatistics = statisticsSection.getCached(option.id) ?? null;
    activeTeamId.current = option.id;
    if (cachedTeam) setTeam(cachedTeam);
    setMatches(cachedMatches);
    setTrainings(cachedTraining?.trainings ?? null);
    setOptionNames(cachedTraining?.optionNames ?? {});
    setStatistics(cachedStatistics?.training ?? null);
    setMatchStatistics(cachedStatistics?.matches ?? null);
    setFriendlyMatchStatistics(cachedStatistics?.friendlyMatches ?? []);
    setCompetitionMatchStatistics(cachedStatistics?.competitionMatches ?? []);
    setCupMatchStatistics(cachedStatistics?.cupMatches ?? []);
    setHasCupMatches(cachedStatistics?.hasCupMatches ?? false);
    setMatchStatisticsFilter("all");
    setLoadingSection(null);
    setTeamId(option.id);
  }

  function selectClubTeam(clubTeamId: string | null) {
    const option = teamOptions.find(item => item.club_team_id === clubTeamId);
    if (option) openTeam(option);
  }

  if (loading && !team) return <div className="mx-auto max-w-6xl p-5 sm:p-7"><p className="rounded-xl border border-border bg-card p-5 text-textMuted">{t("team.loading")}</p></div>;
  if (!team) return <div className="mx-auto max-w-6xl p-5 sm:p-7"><Link href="/dashboard/teams" className="text-accent">← {t("common.back")}</Link><p className="mt-5 text-textMuted">{t("team.notFound")}</p></div>;

  return <div className="mx-auto max-w-6xl p-5 sm:p-7">
    <SectionHeader title={team.name} artworkSrc="/branding/teams.webp" showHome={false} />
    <TeamContextPanel
      teams={teamOptions.flatMap(option => option.club_team_id ? [{ id: option.club_team_id, name: option.name }] : [])}
      activeTeamId={teamOptions.find(option => option.id === teamId)?.club_team_id ?? null}
      allowAll={false}
      onSelect={selectClubTeam}
    />
    <nav className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2" aria-label={t("team.navigation")}>
      {tabs.map((item) => <button key={item.id} type="button" onClick={() => { setTab(item.id); window.history.replaceState(null, "", item.id === "overview" ? `/dashboard/teams/${teamId}` : `/dashboard/teams/${teamId}?tab=${item.id}`); }} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === item.id ? "bg-accent text-page" : "text-textPrimary hover:bg-cardDeep"}`}>{item.label}</button>)}
    </nav>
    {loading && <Loading text={t("team.loading")} />}

    {tab === "overview" && <section><h2 className="mb-3 text-lg font-bold text-textBright">{t("team.players", { count: players.length })}</h2>{players.length ? <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[1020px] table-fixed border-collapse text-left text-sm"><colgroup><col className="w-[15%]" /><col className="w-[10%]" /><col className="w-[13%]" /><col className="w-[13%]" /><col className="w-[13%]" /><col className="w-[20%]" /><col className="w-[16%]" /></colgroup><thead className="bg-accent text-[11px] uppercase tracking-wide text-page"><tr><th className="px-3 py-2">{t("team.lastName")}</th><th className="px-3 py-2">{t("team.firstName")}</th><th className="px-3 py-2 text-center">{t("team.birthDate")}</th><th className="px-3 py-2 text-center">{t("team.phoneContact1")}</th><th className="px-3 py-2 text-center">{t("team.phoneContact2")}</th><th className="px-3 py-2">{t("team.emailContact1")}</th><th className="px-3 py-2">{t("team.emailContact2")}</th></tr></thead><tbody className="divide-y divide-borderSubtle">{players.map((player) => { const [contact1, contact2] = contactsForPlayer(player); return <tr key={player.id} className="bg-card hover:bg-cardHover"><td className="px-3 py-2 font-semibold"><Link href={`/dashboard/teams/players/${player.id}`} className="text-textPrimary underline decoration-accent/60 underline-offset-2 hover:text-accent">{player.last_name || "–"}</Link>{player.is_goalkeeper && <span className="ml-2 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">{t("team.goalkeeper")}</span>}</td><td className="px-3 py-2"><Link href={`/dashboard/teams/players/${player.id}`} className="text-textPrimary underline decoration-accent/60 underline-offset-2 hover:text-accent">{player.first_name || "–"}</Link></td><td className="whitespace-nowrap px-3 py-2 text-center text-textSecondary">{player.date_of_birth ? new Date(`${player.date_of_birth}T12:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB") : "–"}</td><td title={contact1?.full_name} className="px-3 py-2 text-center text-textSecondary">{contact1?.phone_number || "–"}</td><td title={contact2?.full_name} className="px-3 py-2 text-center text-textSecondary">{contact2?.phone_number || "–"}</td><td title={contact1?.full_name} className="px-3 py-2 text-textSecondary">{contact1?.email || "–"}</td><td title={contact2?.full_name} className="px-3 py-2 text-textSecondary">{contact2?.email || "–"}</td></tr>; })}</tbody></table></div> : <Empty text={t("team.noPlayers")} />}</section>}

    {tab === "staff" && <section><h2 className="mb-3 text-lg font-bold text-textBright">{t("team.staffTab")}</h2>{(team.linked_staff?.length || legacyStaff.length) ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{team.linked_staff?.map((member) => <StaffCard key={member.id} href={`/dashboard/teams/staff/${member.user_id}`} name={member.full_name} role={t(roleKey(member.role))} />)}{legacyStaff.map((member) => <StaffCard key={member.id} name={`${member.first_name} ${member.last_name}`.trim()} role={t("team.roleStaff")} />)}</div> : <Empty text={t("team.noStaff")} />}</section>}

    {tab === "matches" && <section><h2 className="mb-3 text-lg font-bold text-textBright">{t("team.matchesOf", { team: team.name })}</h2>{loadingSection === "matches" && <Loading text={t("team.loadingMatches")} />}{matches !== null && (matches.length ? <><nav className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2" aria-label="Ga naar wedstrijdensectie"><a href="#komende-wedstrijden" className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">Komende wedstrijden</a><a href="#afgelopen-wedstrijden" className="rounded-lg px-4 py-2 text-sm font-bold text-textPrimary hover:bg-cardDeep">Afgelopen wedstrijden</a></nav><MatchList id="komende-wedstrijden" title="Komende wedstrijden" matches={upcomingMatches} empty="Geen komende wedstrijden gepland." /><div className="mt-10"><MatchList id="afgelopen-wedstrijden" title="Afgelopen wedstrijden" matches={pastMatches} empty="Nog geen afgelopen wedstrijden in dit seizoen." played /></div></> : <Empty text={t("team.noMatches")} />)}</section>}

    {tab === "training" && <section><h2 className="mb-3 text-lg font-bold text-textBright">{t("team.trainingsOf", { team: team.name })}</h2>
      <nav className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2" aria-label="Ga naar trainingensectie"><a href="#komende-trainingen" className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">Komende trainingen</a><a href="#afgelopen-trainingen" className="rounded-lg px-4 py-2 text-sm font-bold text-textPrimary hover:bg-cardDeep">Afgelopen trainingen</a><Link href="/dashboard/training/new" className="rounded-lg px-4 py-2 text-sm font-bold text-textPrimary hover:bg-cardDeep">Losse training maken</Link><Link href="/dashboard/intradesk" className="rounded-lg px-4 py-2 text-sm font-bold text-textPrimary hover:bg-cardDeep">Open Intradesk</Link></nav>
      {loadingSection === "training" && <Loading text={t("team.loadingTrainings")} />}
      {trainings !== null && <><div id="komende-trainingen" className="scroll-mt-6"><TrainingGroups title="Komende trainingen" trainings={upcomingTrainings} locale={locale} optionNames={optionNames} t={t} empty={t("team.noUpcomingTrainings")} /></div><div id="afgelopen-trainingen" className="mt-10 scroll-mt-6"><TrainingGroups title="Afgelopen trainingen" trainings={pastTrainings} locale={locale} optionNames={optionNames} t={t} empty="Nog geen afgelopen trainingen in dit seizoen." showAttendance /></div></>}
    </section>}

    {tab === "evaluations" && <Empty text={t("team.evaluationsComingSoon")} />}
    {tab === "tests" && <Empty text={t("team.testsComingSoon")} />}
    {tab === "statistics" && <section>
      <nav className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2" aria-label="Ga naar statistiekensectie"><a href="#wedstrijdstatistieken" className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">Wedstrijdstatistieken</a><a href="#trainingsstatistieken" className="rounded-lg px-4 py-2 text-sm font-bold text-textPrimary hover:bg-cardDeep">Trainingsstatistieken</a></nav>
      <div id="wedstrijdstatistieken" className="scroll-mt-6"><h2 className="mb-3 text-lg font-bold text-textBright">Wedstrijdstatistieken</h2>{matchStatistics === null ? <Loading text="Wedstrijdstatistieken laden…" /> : <><div className="mb-3 flex flex-wrap gap-2">{([['all','Alle wedstrijden'],['friendly','Vriendschappelijk'],['competition','Competitie'], ...(hasCupMatches ? [['cup','Beker'] as const] : [])] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setMatchStatisticsFilter(value)} className={`rounded-lg px-4 py-2 text-sm font-bold ${matchStatisticsFilter === value ? 'bg-accent text-page' : 'border border-borderButton bg-button text-textPrimary hover:border-accent'}`}>{label}</button>)}</div><MatchStatistics rows={matchStatisticsFilter === "friendly" ? friendlyMatchStatistics : matchStatisticsFilter === "competition" ? competitionMatchStatistics : matchStatisticsFilter === "cup" ? cupMatchStatistics : matchStatistics} /></>}</div>
      <div id="trainingsstatistieken" className="mt-10 scroll-mt-6"><h2 className="mb-3 text-lg font-bold text-textBright">Trainingsstatistieken</h2>{statistics ? <TrainingStatistics rows={statistics} /> : <Loading text="Trainingsstatistieken laden…" />}</div>
    </section>}
  </div>;
}

function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">{text}</p>; }
function Loading({ text }: { text: string }) { return <p className="rounded-xl border border-border bg-card p-5 text-sm text-textMuted">{text}</p>; }
function TrainingGroups({ title, trainings, locale, optionNames, t, empty, showAttendance = false }: { title: string; trainings: Training[]; locale: string; optionNames: Record<string, string>; t: (key: MessageKey, values?: Record<string, string | number>) => string; empty: string; showAttendance?: boolean }) {
  const groups = trainings.reduce((result, training) => {
    const week = weekBounds(training.training_date);
    const group = result.get(week.key) ?? { ...week, trainings: [] };
    group.trainings.push(training);
    result.set(week.key, group);
    return result;
  }, new Map<string, { key: string; monday: string; sunday: string; trainings: Training[] }>());
  return <section><h3 className="mb-3 text-base font-bold text-textBright">{title}</h3>{groups.size ? <div className="space-y-4">{[...groups.values()].map((week) => <div key={week.key} className="overflow-hidden rounded-xl border border-border bg-card"><h4 className="border-b border-borderSubtle bg-cardDeep px-4 py-2 text-sm font-bold capitalize text-textSecondary">{t("team.weekOf", { start: formatShortDate(week.monday, locale), end: formatShortDate(week.sunday, locale) })}</h4><div className="divide-y divide-borderSubtle">{week.trainings.map((training) => <Link key={training.id} href={`/dashboard/training/${training.id}`} className="block px-4 py-2.5 hover:bg-cardHover"><div className="grid items-center gap-2 sm:grid-cols-[minmax(190px,1fr)_minmax(210px,1fr)_auto]"><p className="flex min-w-0 items-center gap-2 text-sm font-semibold capitalize text-textBright"><span className="whitespace-nowrap">{formatCompactDate(training.training_date, locale)} · {training.start_time.slice(0, 5)}</span>{training.workload_note && <span className="truncate text-xs font-normal normal-case text-textMuted">· {training.workload_note}</span>}{showAttendance && <span title={training.attendance_confirmed_at ? "Aanwezigheden doorgegeven" : "Aanwezigheden nog niet doorgegeven"} aria-label={training.attendance_confirmed_at ? "Aanwezigheden doorgegeven" : "Aanwezigheden nog niet doorgegeven"} className={`grid h-7 w-7 flex-none place-items-center rounded-lg border text-xs font-black ${training.attendance_confirmed_at ? "border-accent/50 bg-accent/10 text-accent" : "border-red-500/50 bg-red-500/10 text-red-400"}`}>A</span>}</p><p className="truncate text-sm text-textMuted">{t("team.field")}: {optionNames[training.field_option_id ?? ""] ?? "–"} · {t("team.lockerRoom")}: {optionNames[training.locker_room_option_id ?? ""] ?? "–"}</p><span className="text-sm font-semibold text-accent sm:text-right">{t("team.openTraining")} ›</span></div>{training.workload_modalities?.length > 0 && <div className="mt-2 grid grid-cols-2 gap-2 border-t border-borderSubtle pt-2">{training.workload_modalities.map((item, index) => <div key={`${item.category}-${index}`} className="min-w-0 rounded-lg border border-borderSubtle bg-cardDeep px-3 py-2 text-xs"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: item.color }} /><span className="font-bold text-textSecondary">{item.category}:</span><span className="truncate font-semibold text-textBright">{item.modality}</span>{item.matchFormat && <span className="ml-auto flex-none text-[11px] text-textMuted">WV: {item.matchFormat}</span>}</div>{item.details?.length > 0 && <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-textMuted">{item.details.map((detail, detailIndex) => <span key={`${detail}-${detailIndex}`}>{detail}</span>)}</div>}</div>)}</div>}</Link>)}</div></div>)}</div> : empty ? <Empty text={empty} /> : null}</section>;
}
function StaffCard({ name, role, href }: { name: string; role: string; href?: string }) { const content = <><span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-avatar font-bold text-accent">{name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><strong className="block text-textBright">{name}</strong><small className="text-textMuted">{role}</small></span></>; return href ? <Link href={href} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-accent hover:bg-cardHover">{content}</Link> : <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">{content}</div>; }
function MatchList({ id, title, matches, empty, played = false }: { id: string; title: string; matches: Match[]; empty: string; played?: boolean }) {
  return <section id={id} className="scroll-mt-6">
    <h3 className="mb-3 text-base font-bold text-textBright">{title}</h3>
    {matches.length ? <div className="rounded-xl border border-border bg-card">
      <div className="divide-y divide-borderSubtle">{matches.map(match => { const readLabel = played ? "Wedstrijdverslag lezen" : "Wedstrijdvoorbereiding lezen"; const editLabel = played ? match.completed_at ? "Wedstrijdverslag aanpassen" : "Wedstrijdverslag opmaken" : "Wedstrijdvoorbereiding aanpassen"; return <article key={match.id} className="grid gap-2 px-4 py-3 transition first:rounded-t-xl last:rounded-b-xl hover:bg-cardHover lg:grid-cols-[minmax(180px,0.9fr)_minmax(130px,0.7fr)_minmax(280px,2fr)_auto_92px] lg:items-center lg:gap-4">
        <p className="whitespace-nowrap text-sm font-semibold text-textPrimary">{formatMatchDateShort(match.match_date)}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""}</p>
        <p className="flex justify-center"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${match.match_type === "competition" ? "border-accent/50 bg-accent/10 text-accent" : match.match_type === "cup" ? "border-amber-400/50 bg-amber-400/10 text-amber-300" : match.match_type === "friendly" ? "border-blue-400/50 bg-blue-400/10 text-blue-300" : "border-borderButton bg-button text-textMuted"}`}>{match.match_type === "competition" ? "Competitie" : match.match_type === "cup" ? "Beker" : match.match_type === "friendly" ? "Vriendschappelijk" : "Niet bepaald"}</span></p>
        <Link href={`/dashboard/games/${match.id}`} className="min-w-0 truncate font-bold text-textBright hover:text-accent hover:underline">{match.team_a_name} – {match.team_b_name}</Link>
        <strong className="text-sm text-accent">{match.score_a !== null && match.score_b !== null ? `${match.score_a} – ${match.score_b}` : "–"}</strong>
        <div className="flex gap-2 lg:justify-end">
          <Link href={`/dashboard/games/${match.id}`} title={readLabel} aria-label={readLabel} className="group relative grid h-9 w-9 place-items-center rounded-lg border border-borderButton bg-button text-accent transition hover:border-accent hover:bg-accentDim">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M4 5.5A2.5 2.5 0 0 1 6.5 8H20M8 12h8M8 16h5"/></svg>
            <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden whitespace-nowrap rounded-lg bg-cardAlt px-2.5 py-1.5 text-xs font-semibold text-textPrimary shadow-xl ring-1 ring-border group-hover:block">{readLabel}</span>
          </Link>
          <Link href={`/dashboard/games/${match.id}?edit=1`} title={editLabel} aria-label={editLabel} className="group relative grid h-9 w-9 place-items-center rounded-lg border border-borderButton bg-button text-textPrimary transition hover:border-accent hover:bg-accentDim hover:text-accent">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><path d="m14.5 5.5 4 4M4 20l4.25-.75L19 8.5a2.12 2.12 0 0 0-3-3L5.25 16.25 4 20Z"/><path d="m13.5 7.5 3 3"/></svg>
            <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden whitespace-nowrap rounded-lg bg-cardAlt px-2.5 py-1.5 text-xs font-semibold text-textPrimary shadow-xl ring-1 ring-border group-hover:block">{editLabel}</span>
          </Link>
        </div>
      </article>; })}</div>
    </div> : <Empty text={empty} />}
  </section>;
}
function MatchStatistics({ rows }: { rows: MatchStatistic[] }) { return <div className="overflow-hidden rounded-xl border border-border bg-card"><div className="border-b border-borderSubtle bg-cardDeep px-4 py-3"><p className="text-sm text-textMuted">Gebaseerd op opgeslagen wedstrijdselecties en geregistreerde doelpunten en assists.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-center text-sm"><thead className="border-b border-borderSubtle text-xs uppercase text-textMuted"><tr><th className="px-4 py-3 text-left">Speler</th><th className="px-4 py-3">Gespeeld</th><th className="px-4 py-3">Goals</th><th className="px-4 py-3">Assists</th></tr></thead><tbody className="divide-y divide-borderSubtle">{rows.map(row => <tr key={row.playerId}><td className="px-4 py-3 text-left font-semibold"><Link href={`/dashboard/teams/players/${row.playerId}`} className="text-textBright underline decoration-accent/50 underline-offset-4 hover:text-accent">{row.playerName}</Link></td><td className="px-4 py-3 text-textPrimary">{row.appearances}</td><td className="px-4 py-3 font-semibold text-accent">{row.goals}</td><td className="px-4 py-3 font-semibold text-accent">{row.assists}</td></tr>)}</tbody></table></div>{!rows.length && <p className="p-5 text-sm text-textMuted">Nog geen spelers voor deze ploeg.</p>}</div>; }
function sortPeople(a: Player, b: Player) { return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`); }
function contactsForPlayer(player: DetailedPlayer): PlayerContact[] {
  if (player.contacts?.length) return player.contacts;
  return [
    { id: `${player.id}-contact-1`, full_name: "", email: player.email, phone_number: player.phone_numbers?.[0] ?? null },
    { id: `${player.id}-contact-2`, full_name: "", email: null, phone_number: player.phone_numbers?.[1] ?? null }
  ].filter((contact) => contact.email || contact.phone_number);
}
function sortTrainingsAscending(a: Training, b: Training) { return `${a.training_date} ${a.start_time}`.localeCompare(`${b.training_date} ${b.start_time}`); }
function sortTrainingsDescending(a: Training, b: Training) { return `${b.training_date} ${b.start_time}`.localeCompare(`${a.training_date} ${a.start_time}`); }
function sortMatchesAscending(a: Match, b: Match) { return `${a.match_date ?? ""} ${a.start_time ?? ""}`.localeCompare(`${b.match_date ?? ""} ${b.start_time ?? ""}`); }
function sortMatchesDescending(a: Match, b: Match) { return sortMatchesAscending(b, a); }
function formatMatchDateShort(date: string | null) { if (!date) return "Datum onbekend"; const value = new Date(`${date}T12:00:00`); const days = ["zon", "maa", "din", "woe", "don", "vri", "zat"]; return `${days[value.getDay()]} ${value.toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" })}`; }
function formatCompactDate(date: string, locale: string) { return new Date(`${date}T12:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB", { weekday: "short", day: "numeric", month: "short" }); }
function formatShortDate(date: string, locale: string) { return new Date(`${date}T12:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "short" }); }
function weekBounds(dateValue: string) { const date = new Date(`${dateValue}T12:00:00`); const offset = (date.getDay() + 6) % 7; const monday = new Date(date); monday.setDate(date.getDate() - offset); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); return { key: monday.toISOString().slice(0, 10), monday: monday.toISOString().slice(0, 10), sunday: sunday.toISOString().slice(0, 10) }; }
function roleKey(role: string): "team.roleTrainer" | "team.roleAssistant" | "team.roleManager" | "team.roleCoordinator" | "team.roleYouthManager" | "team.roleTechnicalDirector" | "team.roleStaff" { if (role === "coach") return "team.roleTrainer"; if (role === "assistant_coach") return "team.roleAssistant"; if (role === "team_manager") return "team.roleManager"; if (role === "youth_coordinator") return "team.roleCoordinator"; if (role === "head_youth_development") return "team.roleYouthManager"; if (role === "technical_director") return "team.roleTechnicalDirector"; return "team.roleStaff"; }
function isTab(value: string | null): value is Tab { return ["overview", "staff", "matches", "training", "evaluations", "statistics", "tests"].includes(value ?? ""); }
