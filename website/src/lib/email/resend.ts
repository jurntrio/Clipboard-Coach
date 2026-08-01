import { Resend } from "resend";

const PRODUCTION_ORIGIN = "https://clipboardcoachstudio.com";
const FROM_ADDRESS = "CBC Studio <noreply@clipboardcoachstudio.com>";

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

export async function sendMailboxNotificationEmails(notifications: MailboxNotification[]): Promise<Set<string>> {
  const sentKeys = new Set<string>();
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[mailbox] RESEND_API_KEY ontbreekt, ${notifications.length} e-mailnotificatie(s) overgeslagen.`);
    return sentKeys;
  }
  const resend = new Resend(apiKey);
  for (let offset = 0; offset < notifications.length; offset += 100) {
    const batch = notifications.slice(offset, offset + 100);
    const { error } = await resend.batch.send(batch.map((notification) => ({
      from: FROM_ADDRESS,
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
  return `<p><strong>${escapeHtml(params.senderName)}</strong> stuurde een nieuw bericht in CBC Studio:</p>
    <p style="white-space: pre-wrap;">${escapeHtml(params.body)}</p>
    <p><a href="${inboxUrl}">Bekijk en beantwoord in CBC Studio</a></p>
    <p style="color: #888; font-size: 13px;">Beantwoorden? Log in op CBC Studio, deze mail zelf beantwoorden werkt niet.</p>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}
