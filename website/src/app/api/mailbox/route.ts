import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { mailboxEmailNotificationsEnabled, sendMailboxNotificationEmails } from "@/lib/email/resend";
import {
  getMailboxSendTargets, resolveMailboxRecipientIds, validateTargets,
  type MailboxTarget, type MailboxSendTargets
} from "@/lib/mailbox/send-targets";

type MailboxMessageRow = { id: string; thread_id: string; subject: string; body: string; sender_id: string | null; created_at: string };
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 10_000;
const MAX_TARGETS = 50;
const MAX_RECIPIENTS = 250;
const MAX_MESSAGES_PER_MINUTE = 10;

export async function GET() {
  const { user, activeClubId } = await getClubContext();
  if (!user || !activeClubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: recipientRows, error: recipientsError } = await admin
    .from("mailbox_recipients")
    .select("message_id, read_at, mailbox_messages(thread_id, club_id)")
    .eq("profile_id", user.id)
    .is("deleted_at", null);
  if (recipientsError) return NextResponse.json({ error: "Berichten konden niet geladen worden." }, { status: 500 });

  const threadIds = Array.from(new Set((recipientRows ?? [])
    .filter((row) => (row.mailbox_messages as unknown as { club_id: string } | null)?.club_id === activeClubId)
    .map((row) => (row.mailbox_messages as unknown as { thread_id: string }).thread_id)));

  if (!threadIds.length) return NextResponse.json({
    currentUserId: user.id, threads: [], emailNotificationsEnabled: mailboxEmailNotificationsEnabled()
  });

  const readAtByMessageId = new Map((recipientRows ?? []).map((row) => [row.message_id, row.read_at as string | null]));

  const { data: threadMessages, error: messagesError } = await admin
    .from("mailbox_messages").select("id, thread_id, subject, body, sender_id, created_at")
    .eq("club_id", activeClubId).in("thread_id", threadIds).order("created_at");
  if (messagesError) return NextResponse.json({ error: "Berichten konden niet geladen worden." }, { status: 500 });

  const messageIds = (threadMessages ?? []).map((message) => message.id);
  const { data: allRecipientRows, error: allRecipientsError } = messageIds.length
    ? await admin.from("mailbox_recipients").select("message_id, profile_id, read_at").in("message_id", messageIds)
    : { data: [], error: null };
  if (allRecipientsError) return NextResponse.json({ error: "Leesstatus kon niet geladen worden." }, { status: 500 });

  const recipientProfileIds = Array.from(new Set((allRecipientRows ?? []).map((row) => row.profile_id)));
  const { data: recipientProfiles } = recipientProfileIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", recipientProfileIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const recipientNameById = new Map((recipientProfiles ?? []).map((profile) => [profile.id, profile.full_name?.trim() || "Clublid"]));
  const recipientsByMessageId = new Map<string, Array<{ profileId: string; name: string; readAt: string | null }>>();
  for (const row of allRecipientRows ?? []) {
    const statuses = recipientsByMessageId.get(row.message_id) ?? [];
    statuses.push({ profileId: row.profile_id, name: recipientNameById.get(row.profile_id) ?? "Clublid", readAt: row.read_at });
    recipientsByMessageId.set(row.message_id, statuses);
  }

  const senderIds = Array.from(new Set((threadMessages ?? []).map((m) => m.sender_id).filter((id): id is string => !!id)));
  const { data: senderProfiles } = senderIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", senderIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const senderNameById = new Map((senderProfiles ?? []).map((p) => [p.id, p.full_name?.trim() || "Clublid"]));

  const threadsById = new Map<string, { threadId: string; subject: string; messages: Array<{ id: string; senderId: string | null; senderName: string; body: string; createdAt: string; read: boolean; recipients: Array<{ profileId: string; name: string; readAt: string | null }> }> }>();
  for (const message of (threadMessages ?? []) as MailboxMessageRow[]) {
    if (!threadsById.has(message.thread_id)) threadsById.set(message.thread_id, { threadId: message.thread_id, subject: message.subject, messages: [] });
    threadsById.get(message.thread_id)!.messages.push({
      id: message.id,
      senderId: message.sender_id,
      senderName: (message.sender_id && senderNameById.get(message.sender_id)) || "Onbekend",
      body: message.body,
      createdAt: message.created_at,
      read: message.sender_id === user.id || !!readAtByMessageId.get(message.id),
      recipients: (recipientsByMessageId.get(message.id) ?? [])
        .filter((recipient) => recipient.profileId !== message.sender_id)
        .sort((a, b) => a.name.localeCompare(b.name, "nl"))
    });
  }

  const threads = Array.from(threadsById.values())
    .map((thread) => ({
      ...thread,
      unreadCount: thread.messages.filter((m) => !m.read).length,
      lastMessageAt: thread.messages[thread.messages.length - 1]?.createdAt ?? ""
    }))
    .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));

  return NextResponse.json({
    currentUserId: user.id, threads, emailNotificationsEnabled: mailboxEmailNotificationsEnabled()
  });
}

function labelForTarget(target: MailboxTarget, sendTargets: MailboxSendTargets): string {
  if (target.type === "user") {
    const person = sendTargets.teamGroups.flatMap((group) => [...group.staff, ...group.contacts]).find((p) => p.profileId === target.profileId);
    return person?.name ?? "Individu";
  }
  const teamName = sendTargets.teamGroups.find((group) => group.clubTeamId === target.clubTeamId)?.teamName ?? "team";
  return target.type === "team_staff" ? `Staf van ${teamName}` : `Contactpersonen van ${teamName}`;
}

export async function POST(request: Request) {
  const { user, activeClubId } = await getClubContext();
  if (!user || !activeClubId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null) as {
    subject?: string; body?: string; targets?: MailboxTarget[]; threadId?: string;
  } | null;
  const messageBody = payload?.body?.trim();
  if (!messageBody) return NextResponse.json({ error: "Berichttekst is verplicht." }, { status: 400 });
  if (messageBody.length > MAX_BODY_LENGTH) return NextResponse.json({ error: "Een bericht mag maximaal 10.000 tekens bevatten." }, { status: 400 });

  const admin = createAdminClient();
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentMessageCount, error: rateLimitError } = await admin.from("mailbox_messages")
    .select("id", { count: "exact", head: true }).eq("sender_id", user.id).gte("created_at", oneMinuteAgo);
  if (rateLimitError) return NextResponse.json({ error: "Verzenden kon niet worden gecontroleerd." }, { status: 500 });
  if ((recentMessageCount ?? 0) >= MAX_MESSAGES_PER_MINUTE) {
    return NextResponse.json({ error: "Je verstuurt te snel berichten. Probeer over een minuut opnieuw." }, { status: 429 });
  }
  const { data: senderProfile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const senderName = senderProfile?.full_name?.trim() || "Een clublid";

  let recipientIds: Set<string>;
  let targetsToStore: Array<MailboxTarget & { label: string }>;
  let subject: string;
  let threadId: string;

  if (payload?.threadId) {
    const { data: threadMessages } = await admin.from("mailbox_messages")
      .select("id, club_id, subject").eq("thread_id", payload.threadId).order("created_at").limit(1);
    const rootMessage = threadMessages?.[0];
    if (!rootMessage || rootMessage.club_id !== activeClubId) return NextResponse.json({ error: "Gesprek niet gevonden." }, { status: 404 });
    const { data: rootRecipients } = await admin.from("mailbox_recipients").select("profile_id").eq("message_id", rootMessage.id);
    recipientIds = new Set((rootRecipients ?? []).map((row) => row.profile_id));
    if (!recipientIds.has(user.id)) return NextResponse.json({ error: "Geen toegang tot dit gesprek." }, { status: 403 });
    targetsToStore = [];
    subject = rootMessage.subject;
    threadId = payload.threadId;
  } else {
    const subjectDraft = payload?.subject?.trim();
    if (!subjectDraft) return NextResponse.json({ error: "Onderwerp is verplicht." }, { status: 400 });
    if (subjectDraft.length > MAX_SUBJECT_LENGTH) return NextResponse.json({ error: "Een onderwerp mag maximaal 200 tekens bevatten." }, { status: 400 });
    const targets = payload?.targets ?? [];
    if (!Array.isArray(targets) || targets.length > MAX_TARGETS) return NextResponse.json({ error: "Te veel ontvangersgroepen geselecteerd." }, { status: 400 });
    const sendTargets = await getMailboxSendTargets(activeClubId, user);
    if (!targets.length || !validateTargets(targets, sendTargets)) {
      return NextResponse.json({ error: "Ongeldige of niet-toegestane ontvangers." }, { status: 403 });
    }
    recipientIds = await resolveMailboxRecipientIds(activeClubId, targets);
    targetsToStore = targets.map((target) => ({ ...target, label: labelForTarget(target, sendTargets) }));
    subject = subjectDraft;
    threadId = crypto.randomUUID();
  }

  recipientIds.delete(user.id);
  if (!recipientIds.size) return NextResponse.json({ error: "Geen ontvangers gevonden." }, { status: 400 });
  if (recipientIds.size > MAX_RECIPIENTS) return NextResponse.json({ error: `Een bericht kan maximaal ${MAX_RECIPIENTS} ontvangers hebben.` }, { status: 400 });

  const { data: message, error: messageError } = await admin.from("mailbox_messages")
    .insert({ club_id: activeClubId, sender_id: user.id, thread_id: threadId, subject, body: messageBody })
    .select("id").single();
  if (messageError || !message) return NextResponse.json({ error: messageError?.message ?? "Versturen mislukt." }, { status: 500 });

  if (targetsToStore.length) {
    const { error: targetsError } = await admin.from("mailbox_message_targets").insert(targetsToStore.map((target) => ({
      message_id: message.id,
      target_type: target.type,
      club_team_id: target.type === "user" ? null : target.clubTeamId,
      profile_id: target.type === "user" ? target.profileId : null,
      label: target.label
    })));
    if (targetsError) {
      await admin.from("mailbox_messages").delete().eq("id", message.id);
      return NextResponse.json({ error: "Ontvangers konden niet worden opgeslagen." }, { status: 500 });
    }
  }

  const nowIso = new Date().toISOString();
  const { error: insertRecipientsError } = await admin.from("mailbox_recipients").insert([
    { message_id: message.id, profile_id: user.id, read_at: nowIso },
    ...Array.from(recipientIds).map((profileId) => ({ message_id: message.id, profile_id: profileId }))
  ]);
  if (insertRecipientsError) {
    await admin.from("mailbox_messages").delete().eq("id", message.id);
    return NextResponse.json({ error: "Ontvangers konden niet worden opgeslagen." }, { status: 500 });
  }

  const { data: recipientProfiles } = await admin.from("profiles")
    .select("id, email, mailbox_email_notifications").in("id", Array.from(recipientIds));
  const emailProfiles = (recipientProfiles ?? []).filter((profile) => profile.mailbox_email_notifications !== false && !!profile.email);
  try {
    const sentProfileIds = await sendMailboxNotificationEmails(emailProfiles.map((profile) => ({
      key: profile.id, to: profile.email, senderName, subject, body: messageBody, threadId
    })));
    if (sentProfileIds.size) {
      await admin.from("mailbox_recipients").update({ emailed_at: new Date().toISOString() })
        .eq("message_id", message.id).in("profile_id", [...sentProfileIds]);
    }
  } catch (error) {
    console.error("[mailbox] e-mailbatch versturen mislukt", error);
  }

  return NextResponse.json({ messageId: message.id, threadId });
}
