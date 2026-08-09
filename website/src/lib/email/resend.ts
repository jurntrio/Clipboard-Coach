import { Resend } from "resend";

const PRODUCTION_ORIGIN = "https://app.sportvisualsystems.com";

export function mailboxEmailNotificationsEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAILBOX_EMAIL_FROM);
}

function getAppOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || PRODUCTION_ORIGIN;
}

type MailboxNotification = {
  key: string;
  to: string;
  senderName: string;
  subject: string;
  body: string;
  threadId: string;
};

export type SelectionNotification = {
  key: string;
  to: string;
  recipientName?: string | null;
  playerName: string;
  selected: boolean;
  matchTitle: string;
  matchDate?: string | null;
  startTime?: string | null;
  meetingTime?: string | null;
  location?: string | null;
  nonSelectionReason?: string | null;
  attentionPoint?: string | null;
};

export async function sendSelectionNotificationEmails(notifications: SelectionNotification[]): Promise<Set<string>> {
  const sentKeys = new Set<string>();
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.MAILBOX_EMAIL_FROM;
  if (!apiKey || !fromAddress) {
    console.log(`[selection] E-mailconfiguratie ontbreekt, ${notifications.length} notificatie(s) overgeslagen.`);
    return sentKeys;
  }
  const resend = new Resend(apiKey);
  for (let offset = 0; offset < notifications.length; offset += 100) {
    const batch = notifications.slice(offset, offset + 100);
    const { error } = await resend.batch.send(batch.map(notification => ({
      from: fromAddress,
      to: notification.to,
      subject: `${notification.selected ? "Selectie" : "Niet geselecteerd"} · ${notification.matchTitle}`,
      html: selectionNotificationHtml(notification)
    })));
    if (error) {
      console.error(`[selection] Batch vanaf ontvanger ${offset} mislukt:`, error);
      continue;
    }
    batch.forEach(notification => sentKeys.add(notification.key));
  }
  return sentKeys;
}

function selectionNotificationHtml(notification: SelectionNotification) {
  const details = [notification.matchDate, notification.startTime ? `aanvang ${notification.startTime.slice(0, 5)}` : null, notification.meetingTime ? `afspraak ${notification.meetingTime.slice(0, 5)}` : null, notification.location].filter(Boolean).join(" · ");
  return `<p>Beste${notification.recipientName ? ` ${escapeHtml(notification.recipientName)}` : ""},</p>
    <p><strong>${escapeHtml(notification.playerName)}</strong> is <strong>${notification.selected ? "geselecteerd" : "niet geselecteerd"}</strong> voor ${escapeHtml(notification.matchTitle)}.</p>
    ${details ? `<p>${escapeHtml(details)}</p>` : ""}
    ${notification.nonSelectionReason ? `<p><strong>Reden</strong><br>${escapeHtml(notification.nonSelectionReason)}</p>` : ""}
    ${notification.attentionPoint ? `<p><strong>Individueel aandachtspunt</strong><br>${escapeHtml(notification.attentionPoint)}</p>` : ""}
    <p style="color:#888;font-size:13px;">Dit bericht werd verstuurd vanuit SVS.</p>`;
}

export async function sendMailboxNotificationEmails(notifications: MailboxNotification[]): Promise<Set<string>> {
  const sentKeys = new Set<string>();
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.MAILBOX_EMAIL_FROM;
  if (!apiKey || !fromAddress) {
    console.log(`[mailbox] E-mailconfiguratie ontbreekt, ${notifications.length} notificatie(s) overgeslagen.`);
    return sentKeys;
  }
  const resend = new Resend(apiKey);
  for (let offset = 0; offset < notifications.length; offset += 100) {
    const batch = notifications.slice(offset, offset + 100);
    const { error } = await resend.batch.send(batch.map((notification) => ({
      from: fromAddress,
      to: notification.to,
      subject: notification.subject,
      html: notificationHtml(notification)
    })));
    if (error) {
      console.error(`[mailbox] Batch vanaf ontvanger ${offset} mislukt:`, error);
      continue;
    }
    for (const notification of batch) sentKeys.add(notification.key);
  }
  return sentKeys;
}

function notificationHtml(params: MailboxNotification) {
  const inboxUrl = `${getAppOrigin()}/dashboard/inbox?thread=${encodeURIComponent(params.threadId)}`;
  return `<p><strong>${escapeHtml(params.senderName)}</strong> stuurde je een nieuwe e-mail via de Sport Visual Systems-mailbox:</p>
    <p style="white-space: pre-wrap;">${escapeHtml(params.body)}</p>
    <p><a href="${inboxUrl}">Open deze e-mailthread in Sport Visual Systems</a></p>
    <p style="color: #888; font-size: 13px;">Antwoorden worden centraal in de Sport Visual Systems-mailbox bewaard. Antwoord daarom niet rechtstreeks op deze notificatiemail.</p>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}
