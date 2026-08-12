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

type InvitationEmail = {
  to: string;
  recipientName?: string | null;
  title: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  expiresAt: string;
};

export async function sendInvitationEmail(invitation: InvitationEmail): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.MAILBOX_EMAIL_FROM;
  if (!apiKey || !fromAddress) return { sent: false, error: "E-mailconfiguratie ontbreekt." };
  const resend = new Resend(apiKey);
  const greeting = invitation.recipientName ? `Beste ${escapeHtml(invitation.recipientName)},` : "Beste,";
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: invitation.to,
    subject: invitation.title,
    html: brandedEmail("Uitnodiging", `<p>${greeting}</p><p>${escapeHtml(invitation.intro)}</p>
      ${actionButton(invitation.actionUrl, invitation.actionLabel)}
      <p style="color:#66736b;font-size:13px;">Deze persoonlijke uitnodiging vervalt op ${escapeHtml(new Date(invitation.expiresAt).toLocaleDateString("nl-BE"))}. Deel de link niet met anderen.</p>`)
  });
  return error ? { sent: false, error: error.message } : { sent: true };
}

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
  return brandedEmail("Wedstrijdselectie", `<p>Beste${notification.recipientName ? ` ${escapeHtml(notification.recipientName)}` : ""},</p>
    <p><strong>${escapeHtml(notification.playerName)}</strong> is <strong>${notification.selected ? "geselecteerd" : "niet geselecteerd"}</strong> voor ${escapeHtml(notification.matchTitle)}.</p>
    ${details ? `<div style="margin:20px 0;padding:14px 16px;border:1px solid #dce5dd;border-radius:10px;background:#f5f8f5;color:#405047;">${escapeHtml(details)}</div>` : ""}
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
  return brandedEmail("Nieuw bericht", `<p><strong>${escapeHtml(params.senderName)}</strong> stuurde je een nieuw bericht via Sport Visual Systems:</p>
    <div style="margin:20px 0;padding:16px;border-left:4px solid #18b84a;border-radius:8px;background:#f5f8f5;white-space:pre-wrap;">${escapeHtml(params.body)}</div>
    ${actionButton(inboxUrl, "Open het bericht")}
    <p style="color:#66736b;font-size:13px;">Antwoorden worden centraal in de Sport Visual Systems-mailbox bewaard. Antwoord daarom niet rechtstreeks op deze notificatiemail.</p>`);
}

function actionButton(url: string, label: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto;"><tr><td style="border-radius:9px;background:#15983d;">
    <a href="${url}" style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">${label}</a>
  </td></tr></table>`;
}

function brandHeader() {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;"><tr>
    <td style="border-radius:10px;background:#071109;padding:10px 13px;color:#20df63;font-size:22px;font-weight:900;letter-spacing:1px;">SVS</td>
    <td style="padding-left:13px;text-align:left;color:#17231b;font-size:18px;font-weight:800;line-height:1.15;">SPORT VISUAL<br><span style="color:#15983d;">SYSTEMS</span></td>
  </tr></table>`;
}

function brandedEmail(title: string, content: string) {
  return `<!doctype html><html lang="nl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#edf2ee;font-family:Arial,Helvetica,sans-serif;color:#17231b;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${title} van Sport Visual Systems</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#edf2ee;"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:1px solid #d5dfd6;border-radius:16px;background:#ffffff;box-shadow:0 8px 30px rgba(22,45,28,.08);">
        <tr><td style="height:6px;border-radius:16px 16px 0 0;background:#18b84a;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:26px 28px 18px;text-align:center;">${brandHeader()}</td></tr>
        <tr><td style="padding:8px 32px 4px;color:#15983d;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">${title}</td></tr>
        <tr><td style="padding:4px 32px 30px;font-size:16px;line-height:1.65;">${content}</td></tr>
        <tr><td style="border-top:1px solid #e3e9e4;padding:18px 32px;color:#66736b;font-size:12px;line-height:1.5;">Verstuurd door Sport Visual Systems<br><a href="${getAppOrigin()}" style="color:#15983d;text-decoration:none;font-weight:700;">app.sportvisualsystems.com</a></td></tr>
      </table>
    </td></tr></table></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}
