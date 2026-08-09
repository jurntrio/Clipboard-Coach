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
  return brandedEmail(`<p>Beste${notification.recipientName ? ` ${escapeHtml(notification.recipientName)}` : ""},</p>
    <p><strong>${escapeHtml(notification.playerName)}</strong> is <strong>${notification.selected ? "geselecteerd" : "niet geselecteerd"}</strong> voor ${escapeHtml(notification.matchTitle)}.</p>
    ${details ? `<p>${escapeHtml(details)}</p>` : ""}
    ${notification.nonSelectionReason ? `<p><strong>Reden</strong><br>${escapeHtml(notification.nonSelectionReason)}</p>` : ""}
    ${notification.attentionPoint ? `<p><strong>Individueel aandachtspunt</strong><br>${escapeHtml(notification.attentionPoint)}</p>` : ""}`);
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
  return brandedEmail(`<p><strong>${escapeHtml(params.senderName)}</strong> stuurde je een nieuwe e-mail via de Sport Visual Systems-mailbox:</p>
    <p style="white-space: pre-wrap;">${escapeHtml(params.body)}</p>
    <p><a href="${inboxUrl}" style="display:inline-block;border-radius:8px;background:#18b84a;color:#071109;padding:12px 18px;text-decoration:none;font-weight:700;">Open in Sport Visual Systems</a></p>
    <p style="color:#66736b;font-size:13px;">Antwoorden worden centraal in de Sport Visual Systems-mailbox bewaard. Antwoord daarom niet rechtstreeks op deze notificatiemail.</p>`);
}

function brandedEmail(content: string) {
  const logoUrl = `${getAppOrigin()}/branding/svs-banner-light.png`;
  return `<!doctype html><html><body style="margin:0;background:#eef2ee;font-family:Arial,sans-serif;color:#18221b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;background:#eef2ee;"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;overflow:hidden;border:1px solid #d6dfd7;border-radius:14px;background:#fff;">
        <tr><td style="padding:24px 28px 14px;text-align:center;"><img src="${logoUrl}" width="420" alt="Sport Visual Systems" style="display:block;width:100%;max-width:420px;height:auto;margin:0 auto;"></td></tr>
        <tr><td style="padding:8px 32px 28px;font-size:16px;line-height:1.6;">${content}</td></tr>
        <tr><td style="border-top:1px solid #e3e9e4;padding:16px 32px;color:#66736b;font-size:12px;">Sport Visual Systems · <a href="${getAppOrigin()}" style="color:#169447;">app.sportvisualsystems.com</a></td></tr>
      </table>
    </td></tr></table></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}
