// Isolated PostgreSQL integration checks; no live database or credentials.
// npm install --prefix outputs/goal-media-checks --no-save --package-lock=false @electric-sql/pglite
// node --test website/tests/goal-media-database.cjs
let PGlite;
try { ({ PGlite } = require("../../outputs/goal-media-checks/node_modules/@electric-sql/pglite")); } catch {}
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const user = "10000000-0000-4000-8000-000000000001";
const match = "10000000-0000-4000-8000-000000000002";
const video = "10000000-0000-4000-8000-000000000003";
const tag = "10000000-0000-4000-8000-000000000004";

test("goal/report/archive migration works transactionally in PostgreSQL", { skip: !PGlite && "Install the isolated PostgreSQL test runtime first." }, async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table profiles(id uuid primary key);
      create table teams(id uuid primary key);
      create table videos(id uuid primary key, duration numeric);
      create table matches(id uuid primary key, team_a_id uuid, is_home_match boolean, score_a integer, score_b integer);
      create table tags(id uuid primary key, video_id uuid references videos(id), name text, start_time numeric, end_time numeric);
      create table match_videos(match_id uuid references matches(id), video_id uuid references videos(id));
      create table clips(id uuid primary key default gen_random_uuid(), coach_id uuid references profiles(id), video_id uuid references videos(id),
        team_id uuid references teams(id), name text, audience_type text, audience_player_ids uuid[], render_status text);
      create table clip_segments(id uuid primary key default gen_random_uuid(), clip_id uuid references clips(id) on delete cascade,
        tag_id uuid not null references tags(id) on delete cascade, video_id uuid references videos(id), sequence_order integer);
      create table match_dossiers(match_id uuid primary key references matches(id), lineup_notes text default '', general_report text default '',
        positives text default '', improvements text default '', highlights text default '', goals text default '', cards text default '',
        chances text default '', scouting text default '', goal_events jsonb default '[]', lineup_positions jsonb default '[]',
        lineup_blocks jsonb default '[]', player_reviews jsonb default '[]', updated_by uuid references profiles(id), updated_at timestamptz);
      insert into profiles values('${user}');
      insert into matches values('${match}',null,false,null,null);
      insert into videos values('${video}',100);
      insert into tags values('${tag}','${video}','Goal',10,25);
      insert into match_videos values('${match}','${video}');
    `);
    await db.exec(fs.readFileSync(path.join(__dirname, "../supabase/migrations/0208_goal_media_archive.sql"), "utf8"));
    const goal = { id: "report-goal", team: "away", scoreAfter: "0-1", minute: 12, scorerType: "", scorerPlayerId: "", scorerName: "", assistType: "none", assistPlayerId: "", assistName: "", description: "Bestaande toelichting" };
    await db.query("insert into match_dossiers(match_id,goal_events,general_report) values($1,$2,'Verslag')", [match, JSON.stringify([goal])]);
    async function link(start = null, end = null, data = goal, tagId = tag) {
      return (await db.query("select public.link_match_goal_media($1,$2,$3,$4,$5,$6,$7) as result", [match, tagId, JSON.stringify(data), user, start !== null, start, end])).rows[0].result;
    }
    const linked = await link();
    assert.equal(linked.goal.id, "report-goal");
    assert.equal(linked.goal.description, goal.description);
    assert.equal(linked.clipId, null);
    const first = await link(10,25);
    const duplicate = await link(10,25);
    assert.equal(duplicate.clipId, first.clipId);
    const snapshot = (await db.query("select source_start,source_end from clip_segments where clip_id=$1", [first.clipId])).rows[0];
    assert.equal(Number(snapshot.source_start), 10);
    assert.equal(Number(snapshot.source_end), 25);
    await db.query("update tags set start_time=9 where id=$1", [tag]);
    const corrected = await link(9,25);
    assert.notEqual(corrected.clipId, first.clipId);
    assert.equal((await db.query("select count(*) as n from clips where archived_goal")).rows[0].n, 2);
    await assert.rejects(db.query("select public.save_match_dossier_with_goal_media($1,$2,$3,true,0,1)", [match, JSON.stringify({ goal_events: [], general_report: "Oud verslag" }), user]), /gekoppeld doelpunt ontbreekt/);
    await assert.rejects(db.query("select public.save_match_dossier_with_goal_media($1,$2,$3,true,0,1)", [match, JSON.stringify({ goal_events: [{ ...goal, scoreAfter: "" }] }), user]), /gekoppeld doelpunt ontbreekt/);
    assert.equal((await db.query("select general_report from match_dossiers")).rows[0].general_report, "Verslag");
    await db.query("select public.save_match_dossier_with_goal_media($1,$2,$3,true,0,1)", [match, JSON.stringify({ goal_events: [goal], general_report: "Aangevuld verslag" }), user]);
    assert.equal((await db.query("select score_a from matches")).rows[0].score_a, 1);
    await db.query("delete from tags where id=$1", [tag]);
    const media = (await db.query("select * from match_goal_media")).rows[0];
    assert.equal(media.tag_id, null);
    assert.equal(media.clip_id, corrected.clipId);
    assert.equal((await db.query("select goal_events from match_dossiers")).rows[0].goal_events.length, 1);
    assert.equal((await db.query("select has_function_privilege('authenticated','public.link_match_goal_media(uuid,uuid,jsonb,uuid,boolean,numeric,numeric)','EXECUTE') as allowed")).rows[0].allowed, false);
    // Video-first, a different camera tag can link the same goal without duplication.
    await db.query("insert into tags values($1,$2,'Goal',30,45)", [tag, video]);
    const secondGoal = { ...goal, id: "goal-2", scoreAfter: "1-1", team: "home", description: "" };
    await link(null,null,secondGoal);
    assert.equal((await db.query("select goal_events from match_dossiers")).rows[0].goal_events.length, 2);
    await assert.rejects(link(null,null,goal), /TAG_ALREADY_LINKED/);
  } finally { await db.close(); }
});
