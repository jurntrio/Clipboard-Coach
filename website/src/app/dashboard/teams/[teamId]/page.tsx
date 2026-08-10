"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n/messages";
import type { Match, Player, Team } from "@/types/database";

type Tab = "overview" | "staff" | "matches" | "training" | "evaluations";
type TrainingView = "upcoming" | "past" | "statistics";
type StaffMember = { id: string; full_name: string; role: string };
type PlayerContact = { id: string; full_name: string; email: string | null; phone_number: string | null };
type DetailedPlayer = Player & { contacts?: PlayerContact[]; can_manage?: boolean };
type TeamDetail = Team & { players: DetailedPlayer[]; linked_staff?: StaffMember[] };
type Training = { id: string; training_date: string; start_time: string; field_option_id: string | null; locker_room_option_id: string | null };

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");
  const [trainingView, setTrainingView] = useState<TrainingView>("upcoming");
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [teamOptions, setTeamOptions] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [trainings, setTrainings] = useState<Training[] | null>(null);
  const [optionNames, setOptionNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingSection, setLoadingSection] = useState<"matches" | "training" | null>(null);

  useEffect(() => {
    void fetch(`/api/teams/${teamId}`).then(async (response) => {
      if (!response.ok) return;
      const body = await response.json() as { team: TeamDetail };
      setTeam(body.team);
    }).finally(() => setLoading(false));
  }, [teamId]);

  useEffect(() => {
    void fetch("/api/teams?all=true", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const body = await response.json() as { teams?: Team[] };
      setTeamOptions((body.teams ?? []).filter(item => item.name.trim().toUpperCase() !== "EXTRA"));
    });
  }, []);

  useEffect(() => {
    if (tab === "matches" && matches === null && loadingSection === null) {
      setLoadingSection("matches");
      void fetch(`/api/teams/${teamId}?section=matches`).then(async (response) => {
        if (!response.ok) { setMatches([]); return; }
        const body = await response.json() as { matches: Match[] };
        setMatches(body.matches ?? []);
      }).finally(() => setLoadingSection(null));
    }
    if (tab === "training" && trainings === null && loadingSection === null) {
      setLoadingSection("training");
      void fetch(`/api/teams/${teamId}?section=training`).then(async (response) => {
        if (!response.ok) { setTrainings([]); return; }
        const body = await response.json() as { trainings: Training[]; training_options: { id: string; label: string }[] };
        setTrainings(body.trainings ?? []);
        setOptionNames(Object.fromEntries((body.training_options ?? []).map((option) => [option.id, option.label])));
      }).finally(() => setLoadingSection(null));
    }
  }, [loadingSection, matches, tab, teamId, trainings]);

  const players = useMemo(() => (team?.players ?? []).filter((player) => player.role !== "staff").sort(sortPeople), [team]);
  const legacyStaff = useMemo(() => (team?.players ?? []).filter((player) => player.role === "staff").sort(sortPeople), [team]);
  const today = new Date().toISOString().slice(0, 10);
  const upcomingTrainings = useMemo(() => [...(trainings ?? [])].filter((item) => item.training_date >= today).sort(sortTrainingsAscending), [trainings, today]);
  const pastTrainings = useMemo(() => [...(trainings ?? [])].filter((item) => item.training_date < today).sort(sortTrainingsDescending), [trainings, today]);
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("team.overview") },
    { id: "staff", label: t("team.staffTab") },
    { id: "matches", label: t("common.matches") },
    { id: "training", label: t("team.trainings") },
    { id: "evaluations", label: t("team.evaluations") }
  ];

  async function openTeam(option: Team) {
    if (option.club_team_id) await fetch("/api/team-context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clubTeamId: option.club_team_id }) });
    window.location.href = `/dashboard/teams/${option.id}`;
  }

  if (loading) return <div className="mx-auto max-w-6xl p-5 sm:p-7"><p className="rounded-xl border border-border bg-card p-5 text-textMuted">{t("team.loading")}</p></div>;
  if (!team) return <div className="mx-auto max-w-6xl p-5 sm:p-7"><Link href="/dashboard/teams" className="text-accent">← {t("common.back")}</Link><p className="mt-5 text-textMuted">{t("team.notFound")}</p></div>;

  return <div className="mx-auto max-w-6xl p-5 sm:p-7">
    <SectionHeader title={team.name} artworkSrc="/branding/teams.png" showHome={false} />
    {teamOptions.length > 1 && <nav className="mb-5 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3" aria-label="Ploeg kiezen">
      {teamOptions.map(option => <button type="button" key={option.id} onClick={() => void openTeam(option)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${option.id === team.id ? "bg-accent text-page" : "text-textPrimary hover:bg-cardDeep"}`}>{option.name}</button>)}
    </nav>}
    <nav className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2" aria-label={t("team.navigation")}>
      {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === item.id ? "bg-accent text-page" : "text-textPrimary hover:bg-cardDeep"}`}>{item.label}</button>)}
    </nav>

    {tab === "overview" && <section><h2 className="mb-3 text-lg font-bold text-textBright">{t("team.players", { count: players.length })}</h2>{players.length ? <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[1020px] table-fixed border-collapse text-left text-sm"><colgroup><col className="w-[15%]" /><col className="w-[10%]" /><col className="w-[13%]" /><col className="w-[13%]" /><col className="w-[13%]" /><col className="w-[20%]" /><col className="w-[16%]" /></colgroup><thead className="bg-accent text-[11px] uppercase tracking-wide text-page"><tr><th className="px-3 py-2">{t("team.lastName")}</th><th className="px-3 py-2">{t("team.firstName")}</th><th className="px-3 py-2 text-center">{t("team.birthDate")}</th><th className="px-3 py-2 text-center">{t("team.phoneContact1")}</th><th className="px-3 py-2 text-center">{t("team.phoneContact2")}</th><th className="px-3 py-2">{t("team.emailContact1")}</th><th className="px-3 py-2">{t("team.emailContact2")}</th></tr></thead><tbody className="divide-y divide-borderSubtle">{players.map((player) => { const [contact1, contact2] = contactsForPlayer(player); return <tr key={player.id} className="bg-card hover:bg-cardHover"><td className="px-3 py-2 font-semibold"><Link href={`/dashboard/teams/players/${player.id}`} className="text-textPrimary underline decoration-accent/60 underline-offset-2 hover:text-accent">{player.last_name || "–"}</Link>{player.is_goalkeeper && <span className="ml-2 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">{t("team.goalkeeper")}</span>}</td><td className="px-3 py-2"><Link href={`/dashboard/teams/players/${player.id}`} className="text-textPrimary underline decoration-accent/60 underline-offset-2 hover:text-accent">{player.first_name || "–"}</Link></td><td className="whitespace-nowrap px-3 py-2 text-center text-textSecondary">{player.date_of_birth ? new Date(`${player.date_of_birth}T12:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB") : "–"}</td><td title={contact1?.full_name} className="px-3 py-2 text-center text-textSecondary">{contact1?.phone_number || "–"}</td><td title={contact2?.full_name} className="px-3 py-2 text-center text-textSecondary">{contact2?.phone_number || "–"}</td><td title={contact1?.full_name} className="px-3 py-2 text-textSecondary">{contact1?.email || "–"}</td><td title={contact2?.full_name} className="px-3 py-2 text-textSecondary">{contact2?.email || "–"}</td></tr>; })}</tbody></table></div> : <Empty text={t("team.noPlayers")} />}</section>}

    {tab === "staff" && <section><h2 className="mb-3 text-lg font-bold text-textBright">{t("team.staffTab")}</h2>{(team.linked_staff?.length || legacyStaff.length) ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{team.linked_staff?.map((member) => <StaffCard key={member.id} name={member.full_name} role={t(roleKey(member.role))} />)}{legacyStaff.map((member) => <StaffCard key={member.id} name={`${member.first_name} ${member.last_name}`.trim()} role={t("team.roleStaff")} />)}</div> : <Empty text={t("team.noStaff")} />}</section>}

    {tab === "matches" && <section><h2 className="mb-3 text-lg font-bold text-textBright">{t("team.matchesOf", { team: team.name })}</h2>{loadingSection === "matches" && <Loading text={t("team.loadingMatches")} />}{matches !== null && (matches.length ? <div className="space-y-3">{matches.map((match) => <div key={match.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"><div><p className="font-bold text-textBright">{match.team_a_name} – {match.team_b_name}</p><p className="mt-1 text-sm text-textMuted">{formatDate(match.match_date, locale)}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""}</p></div>{match.score_a !== null && match.score_b !== null && <strong className="text-xl text-accent">{match.score_a} – {match.score_b}</strong>}</div>)}</div> : <Empty text={t("team.noMatches")} />)}</section>}

    {tab === "training" && <section><h2 className="mb-3 text-lg font-bold text-textBright">{t("team.trainingsOf", { team: team.name })}</h2>
      <nav className="mb-5 flex flex-wrap gap-6 border-b border-border" aria-label="Trainingen bekijken">
        <button type="button" onClick={() => setTrainingView("upcoming")} className={`border-b-2 px-1 pb-3 text-sm font-bold ${trainingView === "upcoming" ? "border-accent text-textBright" : "border-transparent text-textMuted hover:text-textPrimary"}`}>Komende trainingen</button>
        <button type="button" onClick={() => setTrainingView("past")} className={`border-b-2 px-1 pb-3 text-sm font-bold ${trainingView === "past" ? "border-accent text-textBright" : "border-transparent text-textMuted hover:text-textPrimary"}`}>Afgelopen trainingen</button>
        <button type="button" onClick={() => setTrainingView("statistics")} className={`border-b-2 px-1 pb-3 text-sm font-bold ${trainingView === "statistics" ? "border-accent text-textBright" : "border-transparent text-textMuted hover:text-textPrimary"}`}>Statistieken</button>
      </nav>
      {loadingSection === "training" && <Loading text={t("team.loadingTrainings")} />}
      {trainings !== null && trainingView === "upcoming" && <TrainingGroups title="" trainings={upcomingTrainings} locale={locale} optionNames={optionNames} t={t} empty={t("team.noUpcomingTrainings")} />}
      {trainings !== null && trainingView === "past" && <TrainingGroups title="" trainings={pastTrainings} locale={locale} optionNames={optionNames} t={t} empty="Nog geen afgelopen trainingen." />}
      {trainingView === "statistics" && <div className="rounded-xl border border-border bg-card p-5"><h3 className="font-bold text-textBright">Aanwezigheidsstatistieken</h3><p className="mt-1 text-sm text-textMuted">Bekijk aanwezigheid, afwezigheid en blessures voor {team.name}.</p><Link href="/dashboard/training/statistics" className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">Statistieken openen</Link></div>}
    </section>}

    {tab === "evaluations" && <Empty text={t("team.evaluationsComingSoon")} />}
  </div>;
}

function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">{text}</p>; }
function Loading({ text }: { text: string }) { return <p className="rounded-xl border border-border bg-card p-5 text-sm text-textMuted">{text}</p>; }
function TrainingGroups({ title, trainings, locale, optionNames, t, empty }: { title: string; trainings: Training[]; locale: string; optionNames: Record<string, string>; t: (key: MessageKey, values?: Record<string, string | number>) => string; empty: string }) {
  const groups = trainings.reduce((result, training) => {
    const week = weekBounds(training.training_date);
    const group = result.get(week.key) ?? { ...week, trainings: [] };
    group.trainings.push(training);
    result.set(week.key, group);
    return result;
  }, new Map<string, { key: string; monday: string; sunday: string; trainings: Training[] }>());
  return <section><h3 className="mb-3 text-base font-bold text-textBright">{title}</h3>{groups.size ? <div className="space-y-4">{[...groups.values()].map((week) => <div key={week.key} className="overflow-hidden rounded-xl border border-border bg-card"><h4 className="border-b border-borderSubtle bg-cardDeep px-4 py-2 text-sm font-bold capitalize text-textSecondary">{t("team.weekOf", { start: formatShortDate(week.monday, locale), end: formatShortDate(week.sunday, locale) })}</h4><div className="divide-y divide-borderSubtle">{week.trainings.map((training) => <Link key={training.id} href={`/dashboard/training/${training.id}`} className="grid items-center gap-2 px-4 py-2.5 hover:bg-cardHover sm:grid-cols-[minmax(190px,1fr)_minmax(210px,1fr)_auto]"><p className="truncate text-sm font-semibold capitalize text-textBright">{formatCompactDate(training.training_date, locale)} · {training.start_time.slice(0, 5)}</p><p className="truncate text-sm text-textMuted">{t("team.field")}: {optionNames[training.field_option_id ?? ""] ?? "–"} · {t("team.lockerRoom")}: {optionNames[training.locker_room_option_id ?? ""] ?? "–"}</p><span className="text-sm font-semibold text-accent sm:text-right">{t("team.openTraining")} ›</span></Link>)}</div></div>)}</div> : empty ? <Empty text={empty} /> : null}</section>;
}
function StaffCard({ name, role }: { name: string; role: string }) { return <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-avatar font-bold text-accent">{name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><strong className="block text-textBright">{name}</strong><small className="text-textMuted">{role}</small></span></div>; }
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
function formatDate(date: string | null, locale: string) { return date ? new Date(`${date}T12:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "–"; }
function formatCompactDate(date: string, locale: string) { return new Date(`${date}T12:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB", { weekday: "short", day: "numeric", month: "short" }); }
function formatShortDate(date: string, locale: string) { return new Date(`${date}T12:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "short" }); }
function weekBounds(dateValue: string) { const date = new Date(`${dateValue}T12:00:00`); const offset = (date.getDay() + 6) % 7; const monday = new Date(date); monday.setDate(date.getDate() - offset); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); return { key: monday.toISOString().slice(0, 10), monday: monday.toISOString().slice(0, 10), sunday: sunday.toISOString().slice(0, 10) }; }
function roleKey(role: string): "team.roleTrainer" | "team.roleAssistant" | "team.roleManager" | "team.roleCoordinator" | "team.roleYouthManager" | "team.roleTechnicalDirector" | "team.roleStaff" { if (role === "coach") return "team.roleTrainer"; if (role === "assistant_coach") return "team.roleAssistant"; if (role === "team_manager") return "team.roleManager"; if (role === "youth_coordinator") return "team.roleCoordinator"; if (role === "head_youth_development") return "team.roleYouthManager"; if (role === "technical_director") return "team.roleTechnicalDirector"; return "team.roleStaff"; }
