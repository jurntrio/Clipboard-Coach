export default async () => {
  const siteUrl = process.env.URL;
  const secret = process.env.SEASON_TRANSITION_CRON_SECRET;
  if (!siteUrl || !secret) throw new Error("Season transition scheduler is not configured.");
  const response = await fetch(`${siteUrl}/api/internal/season-transitions`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` }
  });
  if (!response.ok) throw new Error(`Season transition worker failed (${response.status}): ${await response.text()}`);
  return new Response(await response.text(), { status: 200, headers: { "content-type": "application/json" } });
};
