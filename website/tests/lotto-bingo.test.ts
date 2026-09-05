import assert from "node:assert/strict";
import test from "node:test";
import { calculateGame, defaultSettings, parseNumbers, validNumbers, validSaturday, type BingoData } from "../src/lib/lotto-bingo/game.ts";

const participant = (id: string, numbers = [1,2,3,4,5,6,7,8,9,10]) => ({ id, name: id, numbers });
const first = { id: "d1", draw_date: "2026-10-03", numbers: [1,2,3,4,5,6] };
const second = { id: "d2", draw_date: "2026-10-10", numbers: [5,6,7,8,9,10] };
const state = (): BingoData => ({ participants: [participant("Anna"), participant("Bert")], draws: [first, second], settings: defaultSettings });

test("accepts exactly ten or six distinct integers, rejects duplicates and loose parsing", () => {
  assert.deepEqual(parseNumbers("10,9,8,7,6,5,4,3,2,1",10), [1,2,3,4,5,6,7,8,9,10]);
  for (const input of ["1,2,3,4,5,5", "1,2,3,4,5,47", "0,2,3,4,5,6", "1,2,3,4,5,6,6", "1,2,3,4,5,6.5", "1,2,3,4,5,-6", "1,2,3,4,5,6hello"]) assert.throws(() => parseNumbers(input,6));
  assert.equal(validNumbers([1,2,3,4,5,null],6),false);
  assert.equal(validNumbers([1,2,3,4,5,6.2],6),false);
});
test("accepts Saturdays only, independent of timezone, rejecting invalid dates", () => {
  assert.equal(validSaturday("2026-10-03"), true);
  for (const date of ["2026-10-04","2026-10-02","2026-02-31","nonsense", "2026-13-03"]) assert.equal(validSaturday(date),false);
});
test("counts a repeated drawn number once and preserves previous hits", () => {
  const data = state(); data.draws = [first, { ...second, numbers: [1,2,3,4,7,8] }];
  const game = calculateGame(data);
  assert.equal(game.ranking[0].count,8); assert.deepEqual(game.ranking[0].missing,[9,10]); assert.equal(game.winners.length,0);
});
test("first complete draw determines shared winners regardless of input order", () => {
  const data = state(); data.participants.push(participant("Later", [1,2,3,4,5,6,7,8,9,11]));
  data.draws = [{ id:"d3", draw_date:"2026-10-17", numbers:[11,12,13,14,15,16] }, second, first];
  const game = calculateGame(data);
  assert.deepEqual(game.winners.map(p => p.name),["Anna","Bert"]); assert.equal(game.winners[0].completedOn,"2026-10-10");
  assert.equal(game.pot,15); assert.equal(game.prize,7.5); assert.equal(game.ranking.find(p => p.name === "Later")?.count,10);
});
test("draw correction and deletion revoke obsolete winners and recompute missing numbers", () => {
  const data = state(); assert.equal(calculateGame(data).winners.length,2);
  data.draws = [first]; assert.equal(calculateGame(data).winners.length,0); assert.equal(calculateGame(data).ranking[0].count,6);
  data.draws = [first, {...second, numbers:[5,6,7,8,9,11]}]; assert.deepEqual(calculateGame(data).ranking[0].missing,[10]);
});
test("participant changes and settings recompute pot without any payment state", () => {
  const data = state(); data.participants.pop(); assert.equal(calculateGame(data).pot,5);
  data.participants[0] = participant("Anna",[11,12,13,14,15,16,17,18,19,20]); assert.equal(calculateGame(data).winners.length,0);
  data.settings = {...defaultSettings, fee:12.5,pot_pct:40}; assert.equal(calculateGame(data).pot,5);
});
test("empty competition has no winner, zero pot and no last draw", () => {
  const game = calculateGame({participants:[],draws:[],settings:defaultSettings});
  assert.equal(game.pot,0); assert.equal(game.prize,0); assert.equal(game.lastDraw,undefined); assert.deepEqual(game.winners,[]);
});
test("pre-start draws do not affect the game and source data is not mutated", () => {
  const data = state(); data.draws = [{...first,draw_date:"2026-09-26"}]; const before=structuredClone(data);
  assert.equal(calculateGame(data).ranking[0].count,0); assert.deepEqual(data,before);
});
