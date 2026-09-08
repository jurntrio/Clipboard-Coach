import { calculateGame, dateLabel, euro, type BingoData } from "./game";

export type StandImage = { url: string; filename: string };

function wrapped(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  // Character wrapping also handles unusually long single-word names.
  for (const character of text) {
    if (line && context.measureText(line + character).width > maxWidth) { lines.push(line); line = ""; }
    line += character;
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateStandImages(data: BingoData, format: "png" | "jpeg"): Promise<StandImage[]> {
  const game = calculateGame(data);
  const logo = new Image();
  logo.src = "/clubboys/logo.png";
  await logo.decode();
  const count = Math.max(1, Math.ceil(game.ranking.length / 8));
  const result: StandImage[] = [];
  const stamp = new Date().toLocaleString("nl-BE", { timeZone: "Europe/Brussels", dateStyle: "short", timeStyle: "short" });
  try {
    for (let page = 0; page < count; page++) {
      const rows = game.ranking.slice(page * 8, (page + 1) * 8);
      const width = 1200, rowHeight = 148, top = 430, height = top + Math.max(2, rows.length) * rowHeight + 90;
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const c = canvas.getContext("2d");
      if (!c) throw new Error("Je browser ondersteunt deze afbeeldingsexport niet.");
      c.fillStyle = "#f4f5f2"; c.fillRect(0, 0, width, height);
      c.fillStyle = "#071d12"; c.fillRect(0, 0, width, 190);
      c.fillStyle = "#d7aa35"; c.fillRect(0, 186, width, 4);
      c.fillStyle = "#fff"; c.fillRect(36, 24, 138, 138); c.drawImage(logo, 39, 27, 132, 132);
      c.fillStyle = "#f1d36f"; c.font = "bold 22px Arial"; c.fillText("SUPPORTERSCLUB DE CLUBBOYS", 202, 58);
      c.fillStyle = "#fff"; c.font = "bold 62px Arial"; c.fillText("LOTTO BINGO", 198, 128);
      c.font = "20px Arial"; c.fillText("K.M. Torhout · Wie speelt als eerste zijn 10 nummers weg?", 202, 165);
      c.fillStyle = "#07542f"; c.font = "bold 32px Arial"; c.fillText(`Prijzenpot: ${euro(game.pot)}`, 40, 242);
      c.fillStyle = "#171a18"; c.font = "24px Arial"; c.fillText(`${data.participants.length} deelnemers · ${game.draws.length} trekkingen`, 640, 242);
      c.font = "21px Arial";
      c.fillText(game.lastDraw ? `Laatste trekking: ${dateLabel(game.lastDraw.draw_date)}` : `Start: ${dateLabel(data.settings.start_date)}`, 40, 285);
      const ball = (n: number, x: number, y: number, hit: boolean) => {
        c.beginPath(); c.arc(x, y, 18, 0, 2 * Math.PI); c.fillStyle = hit ? "#07542f" : "#fff8df"; c.fill(); c.strokeStyle = hit ? "#07542f" : "#d7aa35"; c.lineWidth = 1.5; c.stroke();
        c.fillStyle = hit ? "#fff" : "#665313"; c.font = "bold 18px Arial"; c.textAlign = "center"; c.fillText(String(n), x, y + 6); c.textAlign = "left";
      };
      game.lastDraw?.numbers.forEach((n, i) => ball(n, 790 + i * 44, 279, true));
      c.fillStyle = game.winners.length ? "#f1d36f" : "#e2eee5"; c.fillRect(32, 312, 1136, 62);
      c.fillStyle = "#193f2b"; c.font = "bold 22px Arial";
      c.fillText(game.winners.length ? `${game.winners.length} winnaar${game.winners.length > 1 ? "s" : ""} · ${euro(game.prize)} per winnaar · ${dateLabel(game.winners[0].completedOn!)}` : "10 nummers · Alleen de 6 hoofdnummers tellen · Groen = reeds getrokken", 48, 351);
      c.fillStyle = "#68706b"; c.font = "bold 18px Arial"; c.fillText("DEELNEMER", 50, 407); c.fillText("SCORE", 360, 407); c.fillText("GEKOZEN NUMMERS / NOG NODIG", 500, 407);
      rows.forEach((p, index) => {
        const y = top + index * rowHeight;
        const winner = game.winners.some(w => w.id === p.id);
        c.fillStyle = winner ? "#fff8df" : "#fff"; c.fillRect(32, y, 1136, rowHeight - 9);
        c.fillStyle = "#171a18"; let size = 23;
        c.font = `bold ${size}px Arial`;
        let lines = wrapped(c, `${page * 8 + index + 1}. ${p.name}`, 290);
        while (lines.length * (size + 3) > 99 && size > 14) { size--; c.font = `bold ${size}px Arial`; lines = wrapped(c, `${page * 8 + index + 1}. ${p.name}`, 290); }
        lines.forEach((line, lineIndex) => c.fillText(line, 50, y + 30 + lineIndex * (size + 3)));
        if (winner) { c.fillStyle = "#80600c"; c.font = "bold 16px Arial"; c.fillText("WINNAAR", 360, y + 94); }
        c.fillStyle = "#07542f"; c.font = "bold 30px Arial"; c.fillText(`${p.count}/10`, 360, y + 52);
        p.numbers.forEach((n, i) => ball(n, 520 + i * 57, y + 35, p.hits.includes(n)));
        c.fillStyle = "#68706b"; c.font = "16px Arial"; c.fillText(p.missing.length ? "Nog nodig:" : "Alle 10 nummers zijn getrokken!", 501, y + 76);
        p.missing.forEach((n, i) => ball(n, 520 + i * 57, y + 105, false));
      });
      if (!rows.length) { c.fillStyle = "#68706b"; c.font = "26px Arial"; c.fillText("Binnenkort vind je hier de eerste deelnemers.", 70, top + 80); }
      c.fillStyle = "#68706b"; c.font = "18px Arial"; c.fillText(`Stand ${stamp} · Pagina ${page + 1}/${count}`, 40, height - 48);
      c.font = "16px Arial"; c.fillText("app.sportvisualsystems.com/clubboys/lottobingo", 40, height - 21); c.textAlign = "right"; c.fillText("Powered by Sport Visual Systems", 1160, height - 21);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, `image/${format}`, .94));
      if (!blob) throw new Error("De afbeelding kon niet worden gemaakt.");
      result.push({ url: URL.createObjectURL(blob), filename: `clubboys-lotto-bingo-${new Date().toISOString().slice(0, 10)}-${page + 1}.${format === "jpeg" ? "jpg" : "png"}` });
    }
    return result;
  } catch (error) { result.forEach(image => URL.revokeObjectURL(image.url)); throw error; }
}
