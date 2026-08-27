// scripts/load-test.mjs — Play full-size games and audit how the shared screen scales
//
// Fills real games with players over websockets (no browser per player, so a
// room of 100 costs about a second), drives the host through a whole round with
// Playwright, and captures every shared screen at every display size it's
// likely to be shown on.
//
// Anything clipped on the presentation view is invisible in the room — a
// projector can't be scrolled — so "CLIPPED" is a real defect, not a nit. Each
// line also reports which rung of its layout ladder a roster settled on (see
// useFitToBox), so you can see a screen collapsing further than it needs to.
//
// Every run writes a contact sheet to docs/load-test/index.html: every screen,
// at every size, for every crowd, side by side with its verdict. Open that to
// audit how the scaling actually looks — "fits" only means nothing was clipped,
// not that it still reads well from the back of the room.
//
// Usage:
//   npm run dev                                  # in one terminal
//   npm run load-test                            # the whole matrix (~10 min)
//   npm run load-test -- --players 68            # just one crowd, teams of 4
//   npm run load-test -- --players 40 --solo     # no Team Play
//   npm run load-test -- --only 100p-teams-of-4  # one scenario, merged into the sheet
//   npm run load-test -- --out ./audit           # write the sheet somewhere else
//   npm run load-test -- --no-shots              # verdicts only, no PNGs
//   npm run load-test -- --rebuild-sheet         # re-render index.html only
//   npm run load-test -- --debug                 # print each roster's height chain
//
// Env: BASE_URL (default http://localhost:5173), JANEDECK_ADMIN_PASSWORD
// (falls back to .env). First run only: npx playwright install chromium.
import { chromium } from "playwright";
import PartySocket from "partysocket";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { nanoid } from "nanoid";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE_URL || "http://localhost:5173";
const WS_HOST = new URL(BASE).host;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const OUT_DIR = path.resolve(ROOT, arg("out", "docs/load-test"));
const SHOTS = !flag("no-shots");
/** --debug prints the height chain above each fitted roster, for layout work */
const DEBUG = flag("debug");

/**
 * The crowds worth auditing: the sizes a room actually comes in, from a single
 * table to the cap. Each is a real game played end to end.
 */
const MATRIX = [
  { slug: "4p-teams-of-2", label: "4 players · teams of 2", players: 4, teamSize: 2 },
  { slug: "12p-teams-of-4", label: "12 players · teams of 4", players: 12, teamSize: 4 },
  { slug: "32p-teams-of-4", label: "32 players · teams of 4", players: 32, teamSize: 4 },
  { slug: "68p-teams-of-4", label: "68 players · teams of 4", players: 68, teamSize: 4 },
  { slug: "100p-teams-of-4", label: "100 players · teams of 4", players: 100, teamSize: 4 },
  { slug: "68p-individual", label: "68 players · individual", players: 68, teamSize: null },
];

/** The displays a shared screen gets put on. */
const DISPLAYS = [
  { label: "projector", width: 1920, height: 1080 },
  { label: "conf room", width: 1366, height: 768 },
  { label: "laptop share", width: 1280, height: 800 },
];

/** The moments in a game the room is looking at the shared screen. */
const SCREENS = ["lobby", "answering", "score-reveal", "game-over"];

/**
 * The other three roles, on the devices they're actually used from. Unlike the
 * shared screen these can scroll, so vertical length is a workload question
 * ("how far does the host have to scroll to judge 51 answers?") rather than a
 * defect — what would be a defect is content running off the SIDE of a phone.
 */
const ROLES = [
  { key: "host", label: "host dashboard", width: 1440, height: 900 },
  { key: "player", label: "player phone", width: 390, height: 844 },
  { key: "audience", label: "audience phone", width: 390, height: 844 },
];

function password() {
  if (process.env.JANEDECK_ADMIN_PASSWORD) return process.env.JANEDECK_ADMIN_PASSWORD;
  const match = readFileSync(path.join(ROOT, ".env"), "utf8").match(/^JANEDECK_ADMIN_PASSWORD=(.*)$/m);
  if (!match) throw new Error("Set JANEDECK_ADMIN_PASSWORD in .env or the environment.");
  return match[1].trim();
}

const ANSWERS = {
  "What is the capital of France?": "Paris",
  "What planet is known as the Red Planet?": "Mars",
  "How many continents are there on Earth?": "7",
  'Who directed the movie "Jurassic Park"?': "Steven Spielberg",
  "What band performed the song 'Bohemian Rhapsody'?": "Queen",
};
const TEAM_NAMES = ["Quiz Khalifa","Trivia Newton-John","Les Quizerables","Smarty Pants","Nacho Average","The Wisecrackers","Brain Freeze","Sofa King Smart","Periodic Table Dancers","Agatha Quiztie","Question Marks","E=MC Hammer","Tequila Mockingbird","Book Club Dropouts","Winona Ryders","Fact Hunters","Pop Quiz Kids","Cheat Sheets","Norwegian Wood","Quizzy Rascal","Sgt Peppers Lonely","Trivia Off The Dome","The Scrantonicity","Better Late Than Pregnant","Wham Bam Thank You Ma'am"];
const NAMES = ["Alex","Sam","Jo","Kim","Riley","Morgan","Casey","Dana","Pat","Quinn","Robin","Sky","Tay","Val","Wren","Zed","Ash","Bo","Cy","Di","Eli","Fay","Gus","Hal","Ivy","Jax","Kit","Lou","Max","Nia","Ozzy","Pip","Rex","Sol","Tex","Uma","Vic","Wes","Xan","Yuri","Zoe","Ada","Bex","Cleo","Drew","Emme","Finn","Gia","Hugo","Iris","Jude","Kai","Liv","Milo","Noor","Otis","Poppy","Rue","Sage","Theo","Ula","Vera","Wade","Xena","Yves","Zara","Ari","Bree","Cade","Dot"];

/** One player, joined and (in Team Play) seated, over a websocket. */
function joinPlayer(run, code, name, teamName, isCaptain) {
  return new Promise((resolve) => {
    const socket = new PartySocket({ host: WS_HOST, room: code, party: "game-room", query: { role: "player" } });
    const player = { socket, name, questions: [] };
    let settled = false;
    const done = (err) => {
      if (settled) return;
      settled = true;
      if (err) {
        run.failures++;
        if (run.failures <= 3) console.log(`  ! ${name}: ${err}`);
      }
      resolve();
    };
    socket.addEventListener("open", () =>
      socket.send(JSON.stringify({ type: "PLAYER_JOIN", payload: { displayName: name, avatarSeed: nanoid(10) } })),
    );
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "JOIN_ACCEPTED") {
        if (teamName) socket.send(JSON.stringify({ type: "PLAYER_SET_TEAM", payload: { teamName } }));
        done();
      } else if (message.type === "JOIN_REJECTED") {
        done(message.payload.reason);
      } else if (message.type === "ROUND_SHOW") {
        player.questions = message.payload.questions;
      } else if (message.type === "ROUND_QUESTION_REVEALED") {
        player.questions = [...player.questions, message.payload.question];
      }
    });
    socket.addEventListener("error", () => done("socket error"));
    run.sockets.push(socket);
    if (isCaptain) run.captains.push(player);
    setTimeout(() => done("timed out"), 10000);
  });
}

/** Each team's captain types the answers to every question revealed so far. */
function answerRevealedQuestions(run) {
  for (const captain of run.captains) {
    for (const question of captain.questions) {
      captain.socket.send(JSON.stringify({
        type: run.solo ? "PLAYER_SUBMIT_ANSWER" : "TEAM_ANSWER_SUBMIT",
        payload: { questionId: question.questionId, text: ANSWERS[question.text] ?? "Paris" },
      }));
    }
  }
}

/**
 * The presentation view is a fixed-height surface — it can't scroll, so page
 * height tells you nothing. What matters is whether anything got clipped, how
 * far the rosters had to collapse to avoid it, and what that looks like.
 */
async function captureScreen(run, page, screen) {
  for (const display of DISPLAYS) {
    await page.setViewportSize({ width: display.width, height: display.height });
    await page.waitForTimeout(900);
    const state = await page.evaluate((debug) => {
      const bottom = window.innerHeight + 4;
      const right = window.innerWidth + 4;
      const backdrop = document.querySelector(".presentation-bg");
      let clipped = 0;
      let worst = "";
      for (const el of document.querySelectorAll("body *")) {
        // Only real content counts: leaf text and images. The drifting
        // background orbs are meant to run off the edges.
        if (backdrop?.contains(el)) continue;
        if (el.closest('[aria-hidden="true"]')) continue;
        const text = el.childElementCount === 0 ? (el.textContent || "").trim() : "";
        if (!text && el.tagName !== "IMG") continue;
        const rect = el.getBoundingClientRect();
        if (rect.height === 0 || rect.width === 0) continue;
        if (rect.bottom <= bottom && rect.top >= -4 && rect.right <= right && rect.left >= -4) continue;
        clipped++;
        if (!worst) worst = text || "<image>";
      }
      const boxes = [...document.querySelectorAll("[data-fit-step]")];
      const chain = debug && boxes[0]
        ? (() => {
            const rows = [];
            for (let el = boxes[0]; el && el !== document.body; el = el.parentElement) {
              const cs = getComputedStyle(el);
              rows.push(`${el.tagName}.${(el.className || "").toString().split(" ")[0]} h=${el.clientHeight} flex=${cs.flex} minH=${cs.minHeight} maxH=${cs.maxHeight}`);
            }
            return rows;
          })()
        : [];
      return {
        clipped,
        worst,
        rungs: boxes.map((el) => Number(el.dataset.fitStep)),
        hidden: boxes
          .flatMap((el) => [...el.querySelectorAll("*")])
          .map((el) => (el.childElementCount === 0 ? (el.textContent || "").trim() : ""))
          .filter((text) => /^\+\d+ more/.test(text)),
        chain,
      };
    }, DEBUG);

    let shot = null;
    if (SHOTS) {
      const dir = path.join(OUT_DIR, run.slug);
      mkdirSync(dir, { recursive: true });
      shot = `${screen}-${display.width}x${display.height}.png`;
      await page.screenshot({ path: path.join(dir, shot) });
    }

    const notes = [
      state.rungs.length ? `rung ${state.rungs.join(",")}` : null,
      state.hidden.length ? `hidden: ${state.hidden.join(" ")}` : null,
    ].filter(Boolean).join(" · ");
    console.log(
      `  ${screen.padEnd(14)} ${String(display.width).padStart(4)}x${display.height}  ` +
        (state.clipped ? `CLIPPED ${state.clipped} — "${state.worst}"` : "fits") +
        (notes ? `  (${notes})` : ""),
    );
    if (state.chain.length) console.log("      " + state.chain.join("\n      "));

    run.results.push({ screen, display: display.label, width: display.width, height: display.height, shot, ...state });
    if (state.clipped) run.problems.push(`${screen} @ ${display.label}: ${state.worst}`);
  }
}

/**
 * A role's view at one beat. These scroll, so the shot is full-page — the whole
 * thing a person would have to get through — and the only hard failure is
 * content running off the side, which no amount of scrolling recovers.
 */
async function captureRole(run, page, role, screen) {
  await page.waitForTimeout(700);
  const state = await page.evaluate(() => {
    const right = window.innerWidth + 4;
    let offSide = 0;
    let worst = "";
    for (const el of document.querySelectorAll("body *")) {
      const text = el.childElementCount === 0 ? (el.textContent || "").trim() : "";
      if (!text && el.tagName !== "IMG") continue;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0 || rect.width === 0) continue;
      if (rect.right <= right && rect.left >= -4) continue;
      offSide++;
      if (!worst) worst = text || "<image>";
    }
    return {
      offSide,
      worst,
      pageHeight: document.documentElement.scrollHeight,
      screens: Math.round((document.documentElement.scrollHeight / window.innerHeight) * 10) / 10,
    };
  });

  let shot = null;
  if (SHOTS) {
    const dir = path.join(OUT_DIR, run.slug);
    mkdirSync(dir, { recursive: true });
    shot = `${role.key}-${screen}.png`;
    // Full page: the point is to see everything the person has to scroll past.
    await page.screenshot({ path: path.join(dir, shot), fullPage: true });
  }

  console.log(
    `  ${(role.key + " " + screen).padEnd(24)} ` +
      (state.offSide ? `OFF-SIDE ${state.offSide} — "${state.worst}"` : "no side overflow") +
      `  (${state.screens} screens tall)`,
  );
  run.roleResults.push({ role: role.key, roleLabel: role.label, screen, shot, ...state });
  if (state.offSide) run.problems.push(`${role.label} ${screen}: "${state.worst}" runs off the side`);
}

/** Play one crowd size end to end, capturing the shared screen at each beat. */
async function runScenario(browser, scenario) {
  const run = {
    ...scenario,
    solo: scenario.teamSize === null,
    sockets: [],
    captains: [],
    results: [],
    roleResults: [],
    problems: [],
    failures: 0,
    reviewQueue: null,
  };
  console.log(`\n━━ ${scenario.label} ━━`);
  const context = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const host = await context.newPage();
    host.setDefaultTimeout(30000);
    await host.setViewportSize({ width: 1440, height: 900 });
    await host.goto(`${BASE}/host`);
    await host.fill("#host-password", password());
    await host.click('button:has-text("Enter as Host")');
    await host.waitForURL("**/host/create");
    await host.click('button:has-text("Trivia")');
    if (!run.solo) await host.check("#team-play-enabled");
    await host.click('button:has-text("Quick Start")');
    await host.check("#allow-audience"); // so the audience role can join below
    await host.waitForTimeout(400); // the settings state is applied on a tick
    await host.click('button:has-text("Start Game")');
    await host.waitForURL(/\/host\/[A-Z0-9]+$/, { timeout: 20000 });
    const code = host.url().split("/").pop();

    // The shared screen is open before anyone arrives, as it would be in a room.
    const presentation = await context.newPage();
    await presentation.goto(`${BASE}/present/${code}`);
    await presentation.waitForTimeout(800);

    const hostRole = ROLES.find((r) => r.key === "host");
    const playerRole = ROLES.find((r) => r.key === "player");
    const audienceRole = ROLES.find((r) => r.key === "audience");

    const started = Date.now();
    // One seat is left for the browser player joined below — they count toward
    // maxPlayers like anyone else, and at the cap they'd be turned away.
    const overSocket = run.players - 1;
    for (let i = 0; i < overSocket; i++) {
      // Seat 0 of the first team is the browser player's.
      const seat = i + 1;
      const team = run.solo ? null : TEAM_NAMES[Math.floor(seat / run.teamSize) % TEAM_NAMES.length];
      const name = NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${i}` : "");
      await joinPlayer(run, code, name, team, run.solo || seat % run.teamSize === 0);
    }
    run.joinSeconds = Number(((Date.now() - started) / 1000).toFixed(1));
    run.teams = run.solo ? 0 : Math.ceil(overSocket / run.teamSize);
    console.log(
      `game ${code} · joined ${overSocket - run.failures + 1}/${run.players} in ${run.joinSeconds}s` +
        (run.teams ? ` · ${run.teams} teams` : ""),
    );
    run.joined = overSocket - run.failures + 1;
    if (run.failures) console.log("  some players were rejected — check Max players on the create form");

    // One player and one audience member in a real browser, so their views can
    // be audited at the same crowd size the shared screen is seeing.
    const player = await context.newPage();
    await player.setViewportSize({ width: playerRole.width, height: playerRole.height });
    await player.goto(`${BASE}/play/${code}`);
    await player.waitForSelector("#display-name");
    await player.fill("#display-name", "Hero");
    await player.click('button:has-text("Join Game")');
    if (!run.solo) {
      await player.waitForSelector("#team-name", { timeout: 15000 });
      await player.fill("#team-name", TEAM_NAMES[0]);
      await player.click('button:has-text("Join / Create Team")');
    }
    const audience = await context.newPage();
    await audience.setViewportSize({ width: audienceRole.width, height: audienceRole.height });
    await audience.goto(`${BASE}/audience/${code}`);
    try {
      await audience.waitForSelector("#audience-name", { timeout: 15000 });
    } catch {
      const shown = (await audience.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
      throw new Error(`Audience join form never appeared — page says: "${shown}"`);
    }
    await audience.fill("#audience-name", "Watcher");
    await audience.click('button:has-text("Watch Game")');
    // Landing back on the join form would mean every audience shot below is a
    // picture of a join form, which is worse than no audit at all.
    try {
      await audience.waitForSelector("#audience-name", { state: "detached", timeout: 15000 });
    } catch {
      const reason = (await audience.locator('[role="alert"]').first().textContent().catch(() => null))
        ?? "no error shown";
      throw new Error(`Audience could not join: ${reason.trim()}`);
    }

    await presentation.waitForTimeout(2000);

    await captureScreen(run, presentation, "lobby");
    await captureRole(run, host, hostRole, "lobby");
    await captureRole(run, player, playerRole, "lobby");
    await captureRole(run, audience, audienceRole, "lobby");

    await host.click('button:has-text("Start Game")');
    await host.waitForTimeout(1200);
    // Team Play reveals a whole round at once; individual play walks question by
    // question. Either way the roster ends up answering everything on screen.
    if (run.solo) {
      await host.click('button:has-text("Start First Question")');
      await host.waitForTimeout(1500);
      answerRevealedQuestions(run);
      await host.waitForTimeout(1000);
    } else {
      await host.click('button:has-text("Start Round")');
      await host.waitForTimeout(1500);
      answerRevealedQuestions(run);
      for (const q of [2, 3]) {
        const reveal = host.locator(`button:has-text("Reveal Question ${q}")`);
        if (await reveal.count()) {
          await reveal.first().click();
          await host.waitForTimeout(1200);
          answerRevealedQuestions(run);
        }
      }
    }
    await host.waitForTimeout(1200);
    await captureScreen(run, presentation, "answering");
    await captureRole(run, host, hostRole, "answering");
    await captureRole(run, player, playerRole, "answering");
    await captureRole(run, audience, audienceRole, "answering");

    const close = host.locator('button:has-text("Close Round"), button:has-text("Close Answers")').first();
    if (await close.count()) {
      await close.click();
      await host.waitForTimeout(1500);
    }
    await captureRole(run, host, hostRole, "reviewing");
    const acceptAll = host.locator('button:has-text("Accept All Remaining")').first();
    if (await acceptAll.count()) {
      run.reviewQueue = (await acceptAll.textContent())?.trim() ?? null;
      console.log(`  host review queue: ${run.reviewQueue}`);
      await acceptAll.click();
      await host.waitForTimeout(800);
    }
    await host.click('button:has-text("Reveal Scores")');
    await host.waitForTimeout(1800);
    await captureScreen(run, presentation, "score-reveal");
    await captureRole(run, host, hostRole, "score-reveal");
    await captureRole(run, player, playerRole, "score-reveal");
    await captureRole(run, audience, audienceRole, "score-reveal");

    // Ending early is a two-step confirm — clicking once only arms it, which
    // silently left the game running and made every "game-over" capture below
    // a second picture of the score reveal.
    const end = host.locator('button:has-text("End Game Early")').first();
    if (await end.count()) {
      await end.click();
      await host.waitForTimeout(400);
      await host.click('button:has-text("End Game")');
      await host.waitForTimeout(600);
      await host.waitForSelector('button:has-text("End Game")', { state: "detached", timeout: 15000 });
      await host.waitForTimeout(3000);
      await captureScreen(run, presentation, "game-over");
      await captureRole(run, host, hostRole, "game-over");
      await captureRole(run, player, playerRole, "game-over");
      await captureRole(run, audience, audienceRole, "game-over");
    }
  } finally {
    for (const socket of run.sockets) socket.close();
    await context.close();
  }
  return run;
}

// ─── Contact sheet ────────────────────────────────────────────────────────────

const escape = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * One page showing every screen, at every size, for every crowd — because the
 * verdict "fits" only says nothing was clipped, not that the screen still reads
 * from the back of the room.
 */
function writeContactSheet(runs, stamp) {
  const sections = (run) =>
    SCREENS.map((screen) => {
      const shots = DISPLAYS.map((display) => {
        const result = run.results.find((r) => r.screen === screen && r.display === display.label);
        if (!result) return "";
        const verdict = result.clipped
          ? `<span class="bad">clipped ${result.clipped} — “${escape(result.worst)}”</span>`
          : `<span class="ok">fits</span>`;
        const notes = [
          result.rungs.length ? `rung ${result.rungs.join(",")}` : null,
          result.hidden.length ? escape(result.hidden.join(" ")) : null,
        ].filter(Boolean).join(" · ");
        const img = result.shot
          ? `<a href="${run.slug}/${result.shot}" target="_blank"><img src="${run.slug}/${result.shot}" loading="lazy" alt="${escape(screen)} at ${display.width}×${display.height}"></a>`
          : `<div class="noshot">no screenshot</div>`;
        return `<figure>
          ${img}
          <figcaption><b>${display.label}</b> ${display.width}×${display.height}<br>${verdict}${notes ? `<br><span class="notes">${notes}</span>` : ""}</figcaption>
        </figure>`;
      }).join("");
      return shots ? `<section><h3>${escape(screen)}</h3><div class="row">${shots}</div></section>` : "";
    }).join("");

  /**
   * The other roles, shown full-page — these scroll, so the question isn't
   * "does it fit" but "what does a person have to get through".
   */
  const roleSections = (run) => {
    if (!run.roleResults?.length) return "";
    const byRole = ROLES.map((role) => {
      const shots = run.roleResults
        .filter((r) => r.role === role.key)
        .map((result) => {
          const verdict = result.offSide
            ? `<span class="bad">runs off the side — “${escape(result.worst)}”</span>`
            : `<span class="ok">no side overflow</span>`;
          const img = result.shot
            ? `<a href="${run.slug}/${result.shot}" target="_blank"><img class="tall" src="${run.slug}/${result.shot}" loading="lazy" alt="${escape(role.label)} at ${escape(result.screen)}"></a>`
            : `<div class="noshot">no screenshot</div>`;
          return `<figure>
            ${img}
            <figcaption><b>${escape(result.screen)}</b><br>${verdict}<br><span class="notes">${result.screens} screens tall · ${result.pageHeight}px</span></figcaption>
          </figure>`;
        })
        .join("");
      return shots
        ? `<section><h3>${escape(role.label)} · ${role.width}×${role.height} · scrolls</h3><div class="row">${shots}</div></section>`
        : "";
    }).join("");
    return byRole;
  };

  const summary = runs
    .map((run) => {
      const clipped = run.results.filter((r) => r.clipped).length;
      return `<tr>
        <td><a href="#scale-${run.slug}">${escape(run.label)}</a></td>
        <td>${run.teams || "—"}</td>
        <td>${run.joined ?? run.players - (run.failures ?? 0)}/${run.players} in ${run.joinSeconds}s</td>
        <td>${escape(run.reviewQueue ?? "—")}</td>
        <td class="${clipped ? "bad" : "ok"}">${clipped ? `${clipped} clipped` : "all fit"}</td>
      </tr>`;
    })
    .join("");

  const body = runs
    .map((run) => `<article id="scale-${run.slug}">
      <h2>${escape(run.label)}</h2>
      <p class="lead">Shared screen — fixed height, cannot scroll.</p>
      ${sections(run)}
      <p class="lead">Other roles — these scroll, so length is a workload measure, not a defect.
      Shots are full-page; a sticky action bar renders once, at its viewport position, so
      apparent overlap partway down a tall page is a capture artifact rather than a real one.</p>
      ${roleSections(run)}
    </article>`)
    .join("");

  const html = `<!doctype html>
<meta charset="utf-8">
<title>JaneDeck — shared screen at scale</title>
<style>
  :root { color-scheme: dark; --bg:#0f172a; --card:#1e293b; --line:#334155; --text:#f1f5f9; --dim:#94a3b8; }
  body { margin:0; padding:2rem; background:var(--bg); color:var(--text);
         font:14px/1.5 system-ui, -apple-system, sans-serif; }
  h1 { margin:0 0 .25rem; font-size:1.6rem; }
  .stamp { color:var(--dim); margin:0 0 2rem; max-width:60ch; }
  table { border-collapse:collapse; margin-bottom:3rem; min-width:min(900px,100%); }
  th, td { text-align:left; padding:.5rem .9rem; border-bottom:1px solid var(--line); }
  th { color:var(--dim); font-weight:600; }
  a { color:#60a5fa; }
  article { border-top:2px solid var(--line); padding-top:1.5rem; margin-bottom:3rem; }
  h2 { font-size:1.25rem; margin:0 0 1rem; }
  h3 { font-size:.8rem; text-transform:uppercase; letter-spacing:.08em; color:var(--dim);
       margin:1.5rem 0 .6rem; }
  .row { display:flex; gap:1rem; flex-wrap:wrap; }
  figure { margin:0; background:var(--card); border:1px solid var(--line); border-radius:.6rem;
           padding:.6rem; flex:1 1 320px; max-width:520px; }
  img { width:100%; display:block; border-radius:.35rem; background:#000; }
  img.tall { max-height:70vh; object-fit:contain; object-position:top; }
  figcaption { padding-top:.5rem; color:var(--dim); font-size:.8rem; }
  .ok { color:#22c55e; } .bad { color:#ef4444; }
  .notes { color:var(--dim); font-family:ui-monospace, monospace; font-size:.72rem; }
  .noshot { padding:3rem 0; text-align:center; color:var(--dim); }
  .lead { color:var(--dim); margin:2rem 0 0; padding-top:1rem; border-top:1px dashed var(--line); }
</style>
<h1>Shared screen at scale</h1>
<p class="stamp">${escape(stamp)} · every screen, at every display size, for every crowd.
“Rung” is the step of its layout ladder a roster settled on — 0 is the boldest, and a
higher number means it had to tighten to fit. Regenerate with <code>npm run load-test</code>.</p>
<table>
  <tr><th>Crowd</th><th>Teams</th><th>Joined</th><th>Host review queue</th><th>Shared screen</th></tr>
  ${summary}
</table>
${body}
`;
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, "index.html"), html);
  writeFileSync(
    path.join(OUT_DIR, "results.json"),
    JSON.stringify(
      { stamp, base: BASE, displays: DISPLAYS, runs: runs.map(({ sockets, captains, ...rest }) => rest) },
      null,
      2,
    ),
  );
}

// ─── Run ──────────────────────────────────────────────────────────────────────

// Re-render the sheet from the last run's data — for changing how the audit is
// presented without replaying ten minutes of games.
if (flag("rebuild-sheet")) {
  const saved = JSON.parse(readFileSync(path.join(OUT_DIR, "results.json"), "utf8"));
  writeContactSheet(saved.runs, saved.stamp);
  console.log(`Rebuilt ${path.relative(process.cwd(), path.join(OUT_DIR, "index.html"))} from results.json`);
  process.exit(0);
}

let scenarios = MATRIX;
const only = arg("only", null);
if (arg("players", null)) {
  const players = Number(arg("players", 68));
  const solo = flag("solo");
  const teamSize = solo ? null : Number(arg("team-size", 4));
  scenarios = [{
    slug: solo ? `${players}p-individual` : `${players}p-teams-of-${teamSize}`,
    label: solo ? `${players} players · individual` : `${players} players · teams of ${teamSize}`,
    players,
    teamSize,
  }];
} else if (only) {
  scenarios = MATRIX.filter((scenario) => scenario.slug === only);
  if (!scenarios.length) {
    throw new Error(`No scenario named "${only}". Try one of: ${MATRIX.map((s) => s.slug).join(", ")}`);
  }
}

// A stale folder is worse than none — it reads as a current audit.
if (SHOTS) {
  for (const scenario of scenarios) {
    rmSync(path.join(OUT_DIR, scenario.slug), { recursive: true, force: true });
  }
}

const browser = await chromium.launch();
const runs = [];
try {
  for (const scenario of scenarios) {
    runs.push(await runScenario(browser, scenario));
  }
} finally {
  await browser.close();
}

const stamp = `${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`;

/**
 * Running one scenario shouldn't blank the other five out of the sheet — an
 * audit you have to spend fifteen minutes rebuilding to amend is an audit
 * nobody amends. Fresh runs replace their own slug and keep the rest.
 */
function mergeWithPrevious(fresh) {
  let previous = [];
  try {
    previous = JSON.parse(readFileSync(path.join(OUT_DIR, "results.json"), "utf8")).runs ?? [];
  } catch {
    return fresh;
  }
  const kept = previous.filter((run) => !fresh.some((r) => r.slug === run.slug));
  const order = MATRIX.map((scenario) => scenario.slug);
  return [...kept, ...fresh].sort(
    (a, b) => (order.indexOf(a.slug) + 1 || 99) - (order.indexOf(b.slug) + 1 || 99),
  );
}

if (SHOTS) writeContactSheet(mergeWithPrevious(runs), stamp);

const problems = runs.flatMap((run) => run.problems.map((problem) => `${run.label}: ${problem}`));
console.log(
  problems.length
    ? `\n${problems.length} screen/display combination(s) clip content:\n  ${problems.join("\n  ")}`
    : "\nEvery shared screen fits every display, at every crowd size tested.",
);
if (SHOTS) {
  console.log(`\nContact sheet: ${path.relative(process.cwd(), path.join(OUT_DIR, "index.html"))}`);
}
process.exitCode = problems.length ? 1 : 0;
