import { monitoringEnvironment, monitoringRelease } from "@/lib/monitoring/sentry-options";

type MonitoringAlert = { source: "browser" | "server"; message: string; route?: string | null; stack?: string | null };
type AlertState = { recent: Map<string, number>; hourly: number[] };
const globalState = globalThis as typeof globalThis & { __svsMonitoringAlerts?: AlertState };
const state = globalState.__svsMonitoringAlerts ??= { recent: new Map(), hourly: [] };
const DEDUPLICATION_MS = 15 * 60 * 1000;
const MAX_EMAILS_PER_HOUR = 20;

function normalizedRoute(route: string | null | undefined) {
  if (!route) return "onbekende route";
  return route.split("?")[0].split("#")[0].slice(0, 300);
}

function cleanText(value: string | null | undefined, length: number) {
  return (value || "Onbekende fout").replace(/https?:\/\/\S+/gi, "[URL verwijderd]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[e-mail verwijderd]")
    .replace(/(authorization|cookie|token|secret|password)\s*[:=]\s*\S+/gi, "$1=[Filtered]").slice(0, length);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

function errorFingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export async function sendMonitoringAlert(alert: MonitoringAlert) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MONITORING_EMAIL_FROM || process.env.MAILBOX_EMAIL_FROM;
  const to = process.env.MONITORING_ALERT_EMAIL || "jurntrio@gmail.com";
  if (!apiKey || !from || process.env.NODE_ENV !== "production") return { sent: false, reason: "disabled" } as const;

  const route = normalizedRoute(alert.route);
  const message = cleanText(alert.message, 600);
  const fingerprint = errorFingerprint(`${alert.source}\n${route}\n${message}`);
  const now = Date.now();
  state.hourly = state.hourly.filter((time) => now - time < 60 * 60 * 1000);
  for (const [key, time] of state.recent) if (now - time >= DEDUPLICATION_MS) state.recent.delete(key);
  if (state.recent.has(fingerprint)) return { sent: false, reason: "duplicate" } as const;
  if (state.hourly.length >= MAX_EMAILS_PER_HOUR) return { sent: false, reason: "rate_limited" } as const;
  state.recent.set(fingerprint, now);
  state.hourly.push(now);

  const stack = cleanText(alert.stack, 3000);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to,
      subject: `[SVS fout] ${alert.source} · ${message.slice(0, 90)}`,
      html: `<h2>Nieuwe fout in Sport Visual Systems</h2><p><strong>Bron:</strong> ${escapeHtml(alert.source)}<br><strong>Omgeving:</strong> ${escapeHtml(monitoringEnvironment())}<br><strong>Release:</strong> ${escapeHtml(monitoringRelease())}<br><strong>Route:</strong> ${escapeHtml(route)}<br><strong>Fingerprint:</strong> ${fingerprint}</p><p><strong>Fout:</strong><br>${escapeHtml(message)}</p><pre style="white-space:pre-wrap;background:#f2f4f2;padding:12px;border-radius:8px;">${escapeHtml(stack)}</pre><p style="color:#66736b;font-size:12px;">Gevoelige velden, queryparameters, URL's en e-mailadressen zijn automatisch verwijderd. Herhalingen worden 15 minuten gededupliceerd; maximaal 20 waarschuwingen per uur.</p>`
    })
  });
  return response.ok ? { sent: true } as const : { sent: false, reason: `resend_${response.status}` } as const;
}
