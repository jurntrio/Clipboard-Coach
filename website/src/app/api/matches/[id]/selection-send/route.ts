import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { addPlayerContacts } from "@/lib/teams/player-contacts";
import { selectionFingerprint } from "@/lib/matches/selection-fingerprint";
import { sendSelectionNotificationEmails, type SelectionNotification } from "@/lib/email/resend";

type Contact = { id: string; full_name: string; email: string | null; phone_number: string | null };
type PlayerWithContacts = {
  id: string; first_name: string; last_name: string; email: string | null; membership_id: string | null;
  contacts?: Contact[];
};

async function context(matchId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: match } = await admin.from("matches").select("*").eq("id", matchId).maybeSingle();
  if (!match?.club_id) return { response: NextResponse.json({ error: "Wedstrijd niet gevonden." }, { status: 404 }) };
  const access = await getClubAccess(match.club_id, user);
  if (!canAccessTeam(access, match.club_team_id) || (!hasClubPermission(access, "games.selection.view") && !hasClubPermission(access, "games.selection.manage"))) {
    return { response: NextResponse.json({ error: "Geen toegang tot deze selectie." }, { status: 403 }) };
  }
  return { admin, match, access, user };
}

async function selectionData(admin: ReturnType<typeof createAdminClient>, match: Record<string, any>) {
  const [{ data: selections }, { data: team }, { data: options }] = await Promise.all([
    admin.from("match_player_selections").select("*").eq("match_id", match.id),
    match.team_a_id
      ? admin.from("teams").select("id, players(id, first_name, last_name, email, membership_id)").eq("id", match.team_a_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("club_match_options").select("id, label").eq("club_id", match.club_id).eq("active", true)
  ]);
  const rows = await addPlayerContacts(admin, [{ ...(team ?? {}), players: team?.players ?? [] }], Number.POSITIVE_INFINITY);
  return { selections: selections ?? [], players: (rows[0]?.players ?? []) as PlayerWithContacts[], optionLabels: new Map((options ?? []).map(option => [option.id, option.label])) };
}

function recipientsForPlayer(player: PlayerWithContacts) {
  const recipients: Array<{ type: "player" | "contact"; email: string; name: string | null }> = [];
  if (player.email?.trim()) recipients.push({ type: "player", email: player.email.trim().toLocaleLowerCase(), name: `${player.first_name} ${player.last_name}`.trim() });
  for (const contact of player.contacts ?? []) {
    if (contact.email?.trim()) recipients.push({ type: "contact", email: contact.email.trim().toLocaleLowerCase(), name: contact.full_name });
  }
  const seen = new Set<string>();
  return recipients.filter(recipient => !seen.has(recipient.email) && !!seen.add(recipient.email));
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await context(params.id);
  if ("response" in ctx) return ctx.response;
  const { selections, players } = await selectionData(ctx.admin, ctx.match);
  const selectionByPlayer = new Map(selections.map(selection => [selection.player_id, selection]));
  let selectedRecipients = 0;
  let notSelectedRecipients = 0;
  let selectedPlayersWithoutEmail = 0;
  for (const player of players) {
    const count = recipientsForPlayer(player).length;
    if (selectionByPlayer.get(player.id)?.selected === true) {
      selectedRecipients += count;
      if (!count) selectedPlayersWithoutEmail += 1;
    } else notSelectedRecipients += count;
  }
  const fingerprint = selectionFingerprint({ match: ctx.match, selections });
  const { data: sends } = await ctx.admin.from("match_selection_sends")
    .select("id, sent_by, selection_fingerprint, status, intended_recipient_count, sent_recipient_count, failed_recipient_count, notify_not_selected, created_at, completed_at, profiles(full_name)")
    .eq("match_id", params.id).order("created_at", { ascending: false }).limit(5);
  const latest = sends?.[0] ?? null;
  return NextResponse.json({
    canSend: hasClubPermission(ctx.access, "games.selection.manage"),
    selectedRecipients, notSelectedRecipients, selectedPlayersWithoutEmail,
    changedSinceSend: !!latest && latest.selection_fingerprint !== fingerprint,
    latest, history: sends ?? []
  });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await context(params.id);
  if ("response" in ctx) return ctx.response;
  if (!hasClubPermission(ctx.access, "games.selection.manage")) return NextResponse.json({ error: "Geen recht om de selectie te versturen." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" && /^[0-9a-f-]{36}$/i.test(body.idempotencyKey) ? body.idempotencyKey : null;
  if (!idempotencyKey) return NextResponse.json({ error: "Ongeldige verzendaanvraag." }, { status: 400 });
  const notifyNotSelected = body?.notifyNotSelected === true;
  const includeSelectedAttention = body?.includeSelectedAttention !== false;
  const includeNotSelectedAttention = body?.includeNotSelectedAttention !== false;
  const { selections, players, optionLabels } = await selectionData(ctx.admin, ctx.match);
  const selectionByPlayer = new Map(selections.map(selection => [selection.player_id, selection]));
  const fingerprint = selectionFingerprint({ match: ctx.match, selections });

  const { data: existing } = await ctx.admin.from("match_selection_sends").select("*")
    .eq("match_id", params.id).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existing) return NextResponse.json({ send: existing, duplicate: true });

  const deliveries = players.flatMap(player => {
    const selection = selectionByPlayer.get(player.id);
    const selected = selection?.selected === true;
    if (!selected && !notifyNotSelected) return [];
    const attentionPoint = typeof selection?.individual_attention_point === "string" ? selection.individual_attention_point : null;
    const includeAttention = selected ? includeSelectedAttention : includeNotSelectedAttention;
    return recipientsForPlayer(player).map(recipient => ({
      player, selected, recipient, attentionPoint: includeAttention ? attentionPoint : null, attentionIncluded: includeAttention && !!attentionPoint,
      nonSelectionReason: selected ? null : optionLabels.get(selection?.non_selection_reason_id) ?? null
    }));
  });

  const { data: send, error: sendError } = await ctx.admin.from("match_selection_sends").insert({
    match_id: params.id, sent_by: ctx.user.id, idempotency_key: idempotencyKey,
    selection_fingerprint: fingerprint, notify_not_selected: notifyNotSelected,
    include_selected_attention: includeSelectedAttention, include_not_selected_attention: includeNotSelectedAttention,
    intended_recipient_count: deliveries.length
  }).select("*").single();
  if (sendError?.code === "23505") {
    const { data: duplicate } = await ctx.admin.from("match_selection_sends").select("*")
      .eq("match_id", params.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (duplicate) return NextResponse.json({ send: duplicate, duplicate: true });
  }
  if (sendError || !send) return NextResponse.json({ error: sendError?.message ?? "Verzending kon niet worden gestart." }, { status: 500 });
  if (!deliveries.length) {
    const completedAt = new Date().toISOString();
    await ctx.admin.from("match_selection_sends").update({ status: "failed", completed_at: completedAt }).eq("id", send.id);
    return NextResponse.json({ error: "Geen e-mailadressen gevonden voor de gekozen ontvangers." }, { status: 400 });
  }

  const { data: recipientRows, error: recipientError } = await ctx.admin.from("match_selection_send_recipients").insert(deliveries.map(delivery => ({
    send_id: send.id, player_id: delivery.player.id,
    player_name: `${delivery.player.first_name} ${delivery.player.last_name}`.trim(), player_selected: delivery.selected,
    recipient_type: delivery.recipient.type, recipient_email: delivery.recipient.email,
    recipient_name: delivery.recipient.name, attention_included: delivery.attentionIncluded
  }))).select("id, recipient_email, recipient_name, player_id");
  if (recipientError || !recipientRows) {
    await ctx.admin.from("match_selection_sends").update({ status: "failed", failed_recipient_count: deliveries.length, completed_at: new Date().toISOString() }).eq("id", send.id);
    return NextResponse.json({ error: recipientError?.message ?? "Ontvangers konden niet worden opgeslagen." }, { status: 500 });
  }

  const deliveryByKey = new Map(deliveries.map(delivery => [`${delivery.player.id}:${delivery.recipient.email}`, delivery]));
  const matchTitle = `${ctx.match.team_a_name} – ${ctx.match.team_b_name}`;
  const notifications: SelectionNotification[] = recipientRows.map(row => {
    const delivery = deliveryByKey.get(`${row.player_id}:${row.recipient_email}`)!;
    return {
      key: row.id, to: row.recipient_email, recipientName: row.recipient_name,
      playerName: `${delivery.player.first_name} ${delivery.player.last_name}`.trim(), selected: delivery.selected,
      matchTitle, matchDate: ctx.match.match_date, startTime: ctx.match.start_time,
      meetingTime: ctx.match.meeting_time_enabled ? ctx.match.meeting_time : null,
      location: ctx.match.meeting_place_custom || optionLabels.get(ctx.match.meeting_place_option_id) || ctx.match.public_location,
      nonSelectionReason: delivery.nonSelectionReason,
      attentionPoint: delivery.attentionPoint
    };
  });
  let sentKeys = new Set<string>();
  try { sentKeys = await sendSelectionNotificationEmails(notifications); }
  catch (error) { console.error("[selection] Verzending mislukt", error); }
  const sentAt = new Date().toISOString();
  const sentIds = recipientRows.filter(row => sentKeys.has(row.id)).map(row => row.id);
  const failedIds = recipientRows.filter(row => !sentKeys.has(row.id)).map(row => row.id);
  if (sentIds.length) await ctx.admin.from("match_selection_send_recipients").update({ status: "sent", sent_at: sentAt }).in("id", sentIds);
  if (failedIds.length) await ctx.admin.from("match_selection_send_recipients").update({ status: "failed" }).in("id", failedIds);
  const status = sentIds.length === recipientRows.length ? "sent" : sentIds.length ? "partial" : "failed";
  const { data: completed } = await ctx.admin.from("match_selection_sends").update({
    status, sent_recipient_count: sentIds.length, failed_recipient_count: failedIds.length, completed_at: sentAt
  }).eq("id", send.id).select("*").single();
  return NextResponse.json({ send: completed });
}
