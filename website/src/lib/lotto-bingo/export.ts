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
  const rowsPerPage = 12;
  const count = Math.max(1, Math.ceil(game.ranking.length / rowsPerPage));
  const result: StandImage[] = [];
  const stamp = new Date().toLocaleString("nl-BE", { timeZone: "Europe/Brussels", dateStyle: "short", timeStyle: "short" });
  try {
    for (let page = 0; page < count; page++) {
      const rows = game.ranking.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
      const width = 1200, rowHeight = 88, top = 350, height = top + Math.max(2, rows.length) * rowHeight + 82;
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const c = canvas.getContext("2d");
      if (!c) throw new Error("Je browser ondersteunt deze afbeeldingsexport niet.");
      c.fillStyle = "#f4f5f2"; c.fillRect(0, 0, width, height);
      c.fillStyle = "#071d12"; c.fillRect(0, 0, width, 170);
      c.fillStyle = "#d7aa35"; c.fillRect(0, 166, width, 4);
      c.fillStyle = "#fff"; c.fillRect(36, 22, 124, 124); c.drawImage(logo, 39, 25, 118, 118);
      c.fillStyle = "#f1d36f"; c.font = "bold 21px Arial"; c.fillText("SUPPORTERSCLUB DE CLUBBOYS", 190, 55);
      c.fillStyle = "#fff"; c.font = "bold 58px Arial"; c.fillText("LOTTO BINGO", 186, 124);
      c.font = "19px Arial"; c.fillText("K.M. Torhout · Wie speelt als eerste zijn 10 nummers weg?", 190, 154);
      c.fillStyle = "#07542f"; c.font = "bold 30px Arial"; c.fillText(`Prijzenpot: ${euro(game.pot)}`, 40, 222);
      c.fillStyle = "#171a18"; c.font = "23px Arial"; c.fillText(`${data.participants.length} deelnemers · ${game.draws.length} trekkingen`, 640, 222);
      c.font = "20px Arial";
      c.fillText(game.lastDraw ? `Laatste trekking: ${dateLabel(game.lastDraw.draw_date)}` : `Start: ${dateLabel(data.settings.start_date)}`, 40, 263);
      const ball = (n: number, x: number, y: number, hit: boolean) => {
        c.beginPath(); c.arc(x, y, 18, 0, 2 * Math.PI); c.fillStyle = hit ? "#07542f" : "#fff"; c.fill(); c.strokeStyle = hit ? "#07542f" : "#ccd4ce"; c.lineWidth = 1.5; c.stroke();
        c.fillStyle = hit ? "#fff" : "#171a18"; c.font = "bold 18px Arial"; c.textAlign = "center"; c.fillText(String(n), x, y + 6); c.textAlign = "left";
      };
      game.lastDraw?.numbers.forEach((n, i) => ball(n, 790 + i * 44, 258, true));
      c.fillStyle = game.winners.length ? "#f1d36f" : "#e2eee5"; c.fillRect(32, 290, 1136, 44);
      c.fillStyle = "#193f2b"; c.font = "bold 20px Arial";
      c.fillText(game.winners.length ? `${game.winners.length} winnaar${game.winners.length > 1 ? "s" : ""} · ${euro(game.prize)} per winnaar · ${dateLabel(game.winners[0].completedOn!)}` : "10 nummers per deelnemer · Groen = reeds getrokken · Wit = nog niet getrokken", 48, 319);
      c.fillStyle = "#68706b"; c.font = "bold 17px Arial"; c.fillText("DEELNEMER", 50, 346); c.fillText("10 NUMMERS", 404, 346);
      rows.forEach((p, index) => {
        const y = top + index * rowHeight;
        const winner = game.winners.some(w => w.id === p.id);
        c.fillStyle = winner ? "#fff8df" : "#fff"; c.fillRect(32, y, 1136, rowHeight - 8);
        c.fillStyle = "#171a18"; let size = 23;
        c.font = `bold ${size}px Arial`;
        let lines = wrapped(c, `${page * rowsPerPage + index + 1}. ${p.name}`, 310);
        while (lines.length * (size + 3) > 60 && size > 14) { size--; c.font = `bold ${size}px Arial`; lines = wrapped(c, `${page * rowsPerPage + index + 1}. ${p.name}`, 310); }
        lines.forEach((line, lineIndex) => c.fillText(line, 50, y + 32 + lineIndex * (size + 3)));
        p.numbers.forEach((n, i) => ball(n, 430 + i * 66, y + 43, p.hits.includes(n)));
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
