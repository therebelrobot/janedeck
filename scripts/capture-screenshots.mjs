// scripts/capture-screenshots.mjs — README screenshot capture
//
// Drives a live JaneDeck dev server with Playwright and captures every major
// screen for all four roles (host, player, presentation, audience) across
// all four game modes (trivia individual, trivia team, bingo numbered,
// bingo phrase pool), writing PNGs into docs/screenshots/<mode>/<role>-<state>.png.
//
// Usage:
//   npm run dev                    # in one terminal, leave running
//   npm run capture:screenshots    # in another terminal
//
// First run only: npx playwright install chromium
//
// Env overrides: BASE_URL (default http://localhost:5173),
// JANEDECK_ADMIN_PASSWORD (falls back to the value in .env).

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_ROOT = path.join(ROOT, "docs", "screenshots");
const BASE = process.env.BASE_URL || "http://localhost:5173";

function loadEnvPassword() {
  if (process.env.JANEDECK_ADMIN_PASSWORD) return process.env.JANEDECK_ADMIN_PASSWORD;
  try {
    const envFile = readFileSync(path.join(ROOT, ".env"), "utf8");
    const match = envFile.match(/^JANEDECK_ADMIN_PASSWORD=(.*)$/m);
    if (match) return match[1].trim();
  } catch {
    // no .env file — fall through to error below
  }
  throw new Error(
    "Could not find JANEDECK_ADMIN_PASSWORD. Set it in .env or as an env var before running this script.",
  );
}

const PASSWORD = loadEnvPassword();

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const PHONE_VIEWPORT = { width: 390, height: 844 };

function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

async function step(label, fn) {
  try {
    await fn();
  } catch (e) {
    log("WARN step failed:", label, "-", String(e.message || e).split("\n")[0]);
  }
}

/**
 * Click a button by text, retrying the whole locate-and-click a few times.
 * Player pages sometimes re-render right as a click lands (a fresh
 * PLAYER_LIST_UPDATED broadcast from another page joining/switching teams),
 * which can detach the button mid-click — a single retry window isn't always
 * enough, so this re-queries the locator fresh on each attempt.
 */
async function clickRetry(page, text, { attempts = 4, timeout = 4000, settle = 400 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      await page.click(`button:has-text("${text}")`, { timeout });
      return;
    } catch (e) {
      lastErr = e;
      await page.waitForTimeout(settle);
    }
  }
  throw lastErr;
}

/** Same idea as clickRetry, for filling a text input. */
async function fillRetry(page, selector, value, { attempts = 4, timeout = 4000, settle = 400 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      await page.fill(selector, value, { timeout });
      return;
    } catch (e) {
      lastErr = e;
      await page.waitForTimeout(settle);
    }
  }
  throw lastErr;
}

async function shot(page, mode, name) {
  const dir = path.join(OUT_ROOT, mode);
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
  log(`[${mode}]`, "captured", name);
}

async function newPage(context, viewport) {
  const page = await context.newPage();
  page.setDefaultTimeout(8000); // fail fast on a stale/mismatched selector instead of hanging 30s
  if (viewport) await page.setViewportSize(viewport);
  return page;
}

async function login(page) {
  await page.goto(BASE + "/host");
  await page.waitForSelector("#host-password");
  await page.fill("#host-password", PASSWORD);
  await page.click('button:has-text("Enter as Host")');
  await page.waitForURL("**/host/create");
  await page.waitForTimeout(300);
}

/**
 * Accept every pending answer-review bulk action visible on the page.
 * Each bulk button clears its whole group in a single click (there may be
 * several groups at once in Team Play — one per question in the round).
 * Clicking "Accept All Auto-Accepted" and "Accept All Remaining" back to
 * back in the same pass is a race: the first click can make the second
 * button vanish mid-click (it covers the same answers), which hangs
 * waiting for a stable element. So this clicks at most ONE button per
 * pass, then re-queries fresh next pass.
 */
async function bulkAcceptAllReviews(page) {
  for (let i = 0; i < 12; i++) {
    const autoAccept = page.locator('button:has-text("Accept All Auto-Accepted")').first();
    if (await autoAccept.count()) {
      await step("bulk accept auto-accepted", () => autoAccept.click({ timeout: 3000 }));
      await page.waitForTimeout(250);
      continue;
    }
    const remaining = page.locator('button:has-text("Accept All Remaining")').first();
    if (await remaining.count()) {
      await step("bulk accept remaining", () => remaining.click({ timeout: 3000 }));
      await page.waitForTimeout(250);
      continue;
    }
    return; // nothing left to accept
  }
}

// ─── Trivia (individual + team) ────────────────────────────────────────────

const ROUND1_ANSWERS = ["Paris", "Mars", "7"];
const ROUND2_ANSWERS = ["Steven Spielberg", "Queen"];

async function runTriviaFlow({ teamMode }) {
  const mode = teamMode ? "trivia-team" : "trivia-individual";
  log(`=== ${mode} ===`);
  const browser = await chromium.launch();
  try {
  const context = await browser.newContext({ reducedMotion: "reduce" });

  const host = await newPage(context, DESKTOP_VIEWPORT);
  await login(host);

  await host.click('button:has-text("Trivia")');
  await host.waitForURL("**/host/create/trivia");
  await shot(host, mode, "host-create-empty");

  if (teamMode) {
    await host.check("#team-play-enabled");
  }
  await host.click('button:has-text("Quick Start")');
  await host.check("#allow-audience"); // so the audience role can join below
  await host.waitForTimeout(300);
  await shot(host, mode, "host-create-filled");

  await host.click('button:has-text("Start Game")');
  await host.waitForURL(/\/host\/[A-Z0-9]+$/, { timeout: 20000 });
  const gameCode = host.url().split("/").pop();
  log(mode, "gameCode:", gameCode);
  await host.waitForTimeout(500);

  // ---------- Players join ----------
  const player = await newPage(context, PHONE_VIEWPORT);
  await player.goto(BASE + "/play/" + gameCode);
  await player.waitForSelector("#game-code");
  await shot(player, mode, "player-join");
  await fillRetry(player, "#display-name", "Alex");
  await clickRetry(player, "Join Game");

  if (teamMode) {
    await step("player team select wait", () =>
      player.waitForSelector("#team-name", { timeout: 10000 }),
    );
    await shot(player, mode, "player-team-select");
    await fillRetry(player, "#team-name", "Alpha Team");
    await clickRetry(player, "Join / Create Team");

    // Second player joins the same team so the lobby/team views show a
    // group. PlayerView persists playerId/displayName to localStorage per
    // game code for reconnect support (R9.5), so a page sharing player1's
    // browser context would auto-reconnect as player1 instead of joining
    // fresh — give player2 its own context, like a separate device.
    const player2Context = await browser.newContext({ reducedMotion: "reduce" });
    const player2 = await newPage(player2Context, PHONE_VIEWPORT);
    await player2.goto(BASE + "/play/" + gameCode);
    await player2.waitForSelector("#display-name");
    await fillRetry(player2, "#display-name", "Sam");
    await clickRetry(player2, "Join Game");
    await step("player2 team select wait", () =>
      player2.waitForSelector("#team-name", { timeout: 10000 }),
    );
    await fillRetry(player2, "#team-name", "Alpha Team");
    await clickRetry(player2, "Join / Create Team");
    await player2Context.close();
  }

  await step("player lobby wait", () =>
    player.waitForSelector("text=Waiting for the host", { timeout: 10000 }),
  );
  await shot(player, mode, "player-lobby");

  // ---------- Presentation ----------
  const presentation = await newPage(context, DESKTOP_VIEWPORT);
  await presentation.goto(BASE + "/present/" + gameCode);
  await presentation.waitForTimeout(1000);
  await shot(presentation, mode, "presentation-lobby");

  // ---------- Audience ----------
  const audience = await newPage(context, PHONE_VIEWPORT);
  await audience.goto(BASE + "/audience/" + gameCode);
  await audience.waitForSelector("#audience-name");
  await shot(audience, mode, "audience-join");
  await fillRetry(audience, "#audience-name", "Casey");
  await clickRetry(audience, "Watch Game");
  await step("audience lobby wait", () =>
    audience.waitForSelector("text=Waiting for the game to start", { timeout: 10000 }),
  );
  await shot(audience, mode, "audience-lobby");

  // ---------- Host lobby (now shows player/team) ----------
  await host.bringToFront();
  await host.waitForTimeout(500);
  await shot(host, mode, "host-lobby");

  // LOBBY -> ROUND_INTRO
  await host.click('button:has-text("Start Game")');
  await host.waitForTimeout(700);
  await shot(host, mode, "host-round-intro");
  await presentation.bringToFront();
  await presentation.waitForTimeout(500);
  await shot(presentation, mode, "presentation-round-intro");
  await audience.bringToFront();
  await audience.waitForTimeout(300);
  await shot(audience, mode, "audience-round-intro");
  await player.bringToFront();
  await player.waitForTimeout(500);
  await shot(player, mode, "player-round-intro");

  const roundAnswers = [ROUND1_ANSWERS, ROUND2_ANSWERS];
  let firstRound = true;

  for (let r = 0; r < roundAnswers.length; r++) {
    const answers = roundAnswers[r];

    if (teamMode) {
      // ROUND_INTRO -> ANSWERING (whole round at once, no QUESTION_DISPLAY)
      await host.bringToFront();
      await step("start round", () => host.click('button:has-text("Start Round")'));
      await host.waitForTimeout(700);
      if (firstRound) {
        await shot(host, mode, "host-answering");
        await presentation.bringToFront();
        await presentation.waitForTimeout(500);
        await shot(presentation, mode, "presentation-answering");
        await audience.bringToFront();
        await audience.waitForTimeout(300);
        await shot(audience, mode, "audience-answering");
        await player.bringToFront();
        await player.waitForTimeout(500);
        await shot(player, mode, "player-answering");
      }

      // The host reveals the round's questions one at a time; each one is
      // answerable (and stays editable) from the moment it appears.
      for (let q = 0; q < answers.length; q++) {
        if (q > 0) {
          await host.bringToFront();
          await step(`reveal team question ${q + 1}`, () =>
            host.click(`button:has-text("Reveal Question ${q + 1}")`),
          );
          await host.waitForTimeout(600);
          await player.bringToFront();
          await player.waitForTimeout(400);
        }
        await step(`fill team answer ${q + 1}`, async () => {
          const input = player.locator(`input[aria-label="Answer for question ${q + 1}"]`);
          await input.fill(answers[q]);
        });
      }
      await player.waitForTimeout(700); // debounce + submit

      if (firstRound) {
        // Mid-round, with a couple of questions revealed — the state the
        // reveal-one-at-a-time flow actually spends its time in.
        await shot(player, mode, "player-answering-revealed");
        await presentation.bringToFront();
        await presentation.waitForTimeout(500);
        await shot(presentation, mode, "presentation-answering-revealed");
        await host.bringToFront();
        await host.waitForTimeout(400);
        await shot(host, mode, "host-answering-revealed");
      }

      await host.bringToFront();
      await step("close round", () => host.click('button:has-text("Close Round")'));
      await host.waitForTimeout(700);
      if (firstRound) {
        await shot(host, mode, "host-reviewing");
        await presentation.bringToFront();
        await presentation.waitForTimeout(500);
        await shot(presentation, mode, "presentation-reviewing");
        await audience.bringToFront();
        await audience.waitForTimeout(300);
        await shot(audience, mode, "audience-reviewing");
        await player.bringToFront();
        await player.waitForTimeout(500);
        await shot(player, mode, "player-reviewing");
        await host.bringToFront();
      }
      await bulkAcceptAllReviews(host);
      await host.waitForTimeout(300);

      await step("reveal scores", () => host.click('button:has-text("Reveal Scores")'));
      await host.waitForTimeout(900);
      if (firstRound) {
        await shot(host, mode, "host-score-reveal");
        await presentation.bringToFront();
        await presentation.waitForTimeout(500);
        await shot(presentation, mode, "presentation-score-reveal");
        await audience.bringToFront();
        await audience.waitForTimeout(300);
        await shot(audience, mode, "audience-score-reveal");
        await player.bringToFront();
        await player.waitForTimeout(500);
        await shot(player, mode, "player-score-reveal");
        await host.bringToFront();
      }

      // SCORE_REVEAL always advances to ROUND_RESULTS via "End Round" — the
      // last round's actual end-game moment is one screen later, on
      // ROUND_RESULTS's own "End Game" button.
      const isLastRound = r === roundAnswers.length - 1;
      await step("end round", () => host.click('button:has-text("End Round")'));
      await host.waitForTimeout(700);
      if (!isLastRound) {
        await shot(host, mode, "host-round-results");
        await presentation.bringToFront();
        await presentation.waitForTimeout(500);
        await shot(presentation, mode, "presentation-round-results");
        await audience.bringToFront();
        await audience.waitForTimeout(300);
        await shot(audience, mode, "audience-round-results");
        await player.bringToFront();
        await player.waitForTimeout(500);
        await shot(player, mode, "player-round-results");
        await host.bringToFront();
        await step("next round", () => host.click('button:has-text("Next Round")'));
        await host.waitForTimeout(700);
      } else {
        await step("end game", () => host.click('button:has-text("End Game")'));
        await host.waitForTimeout(900);
        await shot(host, mode, "host-game-over");
        await presentation.bringToFront();
        await presentation.waitForTimeout(500);
        await shot(presentation, mode, "presentation-game-over");
        await audience.bringToFront();
        await audience.waitForTimeout(300);
        await shot(audience, mode, "audience-game-over");
        await player.bringToFront();
        await player.waitForTimeout(500);
        await shot(player, mode, "player-game-over");
      }
    } else {
      // Individual play: one question at a time.
      for (let q = 0; q < answers.length; q++) {
        const isFirstQuestionEver = firstRound && q === 0;

        await host.bringToFront();
        // Every round's first question starts from ROUND_INTRO ("Start First
        // Question"); later questions in the same round advance from
        // SCORE_REVEAL ("Next Question"). This holds for round 2+ as well —
        // "Next Round" always lands back on ROUND_INTRO.
        await step("start/next question", () =>
          q === 0
            ? host.click('button:has-text("Start First Question")')
            : host.click('button:has-text("Next Question")'),
        );
        await host.waitForTimeout(400); // catch QUESTION_DISPLAY before the 3s auto-advance
        if (isFirstQuestionEver) {
          await shot(host, mode, "host-question-display");
          await presentation.bringToFront();
          await presentation.waitForTimeout(300);
          await shot(presentation, mode, "presentation-question-display");
          await audience.bringToFront();
          await audience.waitForTimeout(300);
          await shot(audience, mode, "audience-question-display");
          await player.bringToFront();
          await player.waitForTimeout(300);
          await shot(player, mode, "player-question-display");
          await host.bringToFront();
        }

        await host.waitForTimeout(3200); // auto QUESTION_DISPLAY -> ANSWERING
        if (isFirstQuestionEver) {
          await shot(host, mode, "host-answering");
          await presentation.bringToFront();
          await presentation.waitForTimeout(400);
          await shot(presentation, mode, "presentation-answering");
          await audience.bringToFront();
          await audience.waitForTimeout(300);
          await shot(audience, mode, "audience-answering");
        }

        await player.bringToFront();
        await step("player answer input wait", () =>
          player.waitForSelector("#answer-input", { timeout: 10000 }),
        );
        if (isFirstQuestionEver) await shot(player, mode, "player-answering");
        await step("player submit answer", async () => {
          await player.fill("#answer-input", answers[q]);
          await player.click('button[type="submit"]');
        });
        await player.waitForTimeout(400);
        if (isFirstQuestionEver) await shot(player, mode, "player-submitted");

        await host.bringToFront();
        await step("close answers", () => host.click('button:has-text("Close Answers")'));
        await host.waitForTimeout(700);
        if (isFirstQuestionEver) {
          await shot(host, mode, "host-reviewing");
          await presentation.bringToFront();
          await presentation.waitForTimeout(400);
          await shot(presentation, mode, "presentation-reviewing");
          await audience.bringToFront();
          await audience.waitForTimeout(300);
          await shot(audience, mode, "audience-reviewing");
          await player.bringToFront();
          await player.waitForTimeout(400);
          await shot(player, mode, "player-reviewing");
          await host.bringToFront();
        }
        await bulkAcceptAllReviews(host);
        await host.waitForTimeout(300);

        await step("reveal scores", () => host.click('button:has-text("Reveal Scores")'));
        await host.waitForTimeout(900);
        if (isFirstQuestionEver) {
          await shot(host, mode, "host-score-reveal");
          await presentation.bringToFront();
          await presentation.waitForTimeout(400);
          await shot(presentation, mode, "presentation-score-reveal");
          await audience.bringToFront();
          await audience.waitForTimeout(300);
          await shot(audience, mode, "audience-score-reveal");
          await player.bringToFront();
          await player.waitForTimeout(400);
          await shot(player, mode, "player-score-reveal");
          await host.bringToFront();
        }
      }

      // SCORE_REVEAL always advances to ROUND_RESULTS via "End Round" — the
      // last round's actual end-game moment is one screen later, on
      // ROUND_RESULTS's own "End Game" button.
      const isLastRound = r === roundAnswers.length - 1;
      await step("end round", () => host.click('button:has-text("End Round")'));
      await host.waitForTimeout(700);
      if (!isLastRound) {
        await shot(host, mode, "host-round-results");
        await presentation.bringToFront();
        await presentation.waitForTimeout(400);
        await shot(presentation, mode, "presentation-round-results");
        await audience.bringToFront();
        await audience.waitForTimeout(300);
        await shot(audience, mode, "audience-round-results");
        await player.bringToFront();
        await player.waitForTimeout(400);
        await shot(player, mode, "player-round-results");
        await host.bringToFront();
        await step("next round", () => host.click('button:has-text("Next Round")'));
        await host.waitForTimeout(700);
      } else {
        await step("end game", () => host.click('button:has-text("End Game")'));
        await host.waitForTimeout(900);
        await shot(host, mode, "host-game-over");
        await presentation.bringToFront();
        await presentation.waitForTimeout(400);
        await shot(presentation, mode, "presentation-game-over");
        await audience.bringToFront();
        await audience.waitForTimeout(300);
        await shot(audience, mode, "audience-game-over");
        await player.bringToFront();
        await player.waitForTimeout(400);
        await shot(player, mode, "player-game-over");
      }
    }

    firstRound = false;
  }
  } finally {
    await browser.close();
  }
  log(`=== ${mode} done ===`);
}

// ─── Bingo ──────────────────────────────────────────────────────────────────

// 24 phrases = a 5x5 grid minus the default free space
const PHRASE_POOL = [
  "They fast-forward the trailers",
  "Someone quotes the movie before it happens",
  "A phone lights up during a quiet scene",
  "Someone asks \"wait, who's that again?\"",
  "The popcorn runs out before the movie ends",
  "Someone falls asleep",
  "A plot twist nobody saw coming",
  "Someone cries",
  "The remote gets lost in the couch",
  "Someone says \"the book was better\"",
  "A pet photobombs the screen",
  "Someone pauses for a bathroom break",
  "The stream buffers at the worst moment",
  "Someone recognizes an actor from another show",
  "A jump scare makes someone yell",
  "Someone starts humming the theme song",
  "The credits roll and everyone claps",
  "Someone spills a drink",
  "A character says the movie's title out loud",
  "Someone predicts the ending correctly",
  "The volume gets adjusted five times",
  "Someone asks for a recap of the last scene",
  "A sequel gets teased in the credits",
  "Everyone agrees on a 10/10 rating",
];

async function runBingoFlow({ mode, cardMode, playerName }) {
  log(`=== ${mode} ===`);
  const browser = await chromium.launch();
  try {
  const context = await browser.newContext({ reducedMotion: "reduce" });

  const host = await newPage(context, DESKTOP_VIEWPORT);
  await login(host);

  await host.click('button:has-text("Bingo")');
  await host.waitForURL("**/host/create/bingo");
  await host.waitForTimeout(400);

  if (cardMode === "phrasePool") {
    await host.click('label:has-text("Custom phrase pool")');
    await fillRetry(host, "#phrase-pool", PHRASE_POOL.join("\n"));
    await host.waitForTimeout(200);
  }
  await shot(host, mode, "host-create");

  await host.click('button:has-text("Start Game")');
  await host.waitForURL(/\/host\/[A-Z0-9]+$/, { timeout: 20000 });
  const gameCode = host.url().split("/").pop();
  log(mode, "gameCode:", gameCode);
  await host.waitForTimeout(500);

  const player = await newPage(context, PHONE_VIEWPORT);
  await player.goto(BASE + "/play/" + gameCode);
  await player.waitForSelector("#game-code");
  await shot(player, mode, "player-join");
  await fillRetry(player, "#display-name", playerName);
  await clickRetry(player, "Join Game");
  await step("player lobby wait", () =>
    player.waitForSelector("text=Waiting for the host", { timeout: 10000 }),
  );
  await shot(player, mode, "player-lobby");

  const presentation = await newPage(context, DESKTOP_VIEWPORT);
  await presentation.goto(BASE + "/present/" + gameCode);
  await presentation.waitForTimeout(1000);
  await shot(presentation, mode, "presentation-lobby");

  const audience = await newPage(context, PHONE_VIEWPORT);
  await audience.goto(BASE + "/audience/" + gameCode);
  await audience.waitForSelector("#audience-name");
  await shot(audience, mode, "audience-join");
  await fillRetry(audience, "#audience-name", "Casey");
  await clickRetry(audience, "Watch Game");
  await step("audience lobby wait", () =>
    audience.waitForSelector("text=Waiting for the game to start", { timeout: 10000 }),
  );
  await shot(audience, mode, "audience-lobby");

  await host.bringToFront();
  await host.waitForTimeout(500);
  await shot(host, mode, "host-lobby");

  // LOBBY -> BINGO_PLAYING
  await step("start bingo", () => host.click('button:has-text("Start Bingo")'));
  await host.waitForTimeout(700);
  await shot(host, mode, "host-playing");
  await presentation.bringToFront();
  await presentation.waitForTimeout(500);
  await shot(presentation, mode, "presentation-playing");
  await audience.bringToFront();
  await audience.waitForTimeout(300);
  await shot(audience, mode, "audience-playing");

  await player.bringToFront();
  await step("player card wait", () =>
    player.waitForSelector('[role="gridcell"]', { timeout: 10000 }),
  );
  await shot(player, mode, "player-card");

  // Mark the first three squares of row 0 — partial progress shot.
  await step("mark squares 0-2", async () => {
    const cells = player.locator('[role="gridcell"]');
    for (const i of [0, 1, 2]) {
      await cells.nth(i).click();
      await player.waitForTimeout(150);
    }
  });
  await shot(player, mode, "player-card-marking");

  // Complete the top row for a "line" win.
  await step("mark squares 3-4 for win", async () => {
    const cells = player.locator('[role="gridcell"]');
    for (const i of [3, 4]) {
      await cells.nth(i).click();
      await player.waitForTimeout(150);
    }
  });
  await player.waitForTimeout(500);
  await shot(player, mode, "player-card-win");

  await host.bringToFront();
  await host.waitForTimeout(500);
  await shot(host, mode, "host-playing-with-winner");

  // BINGO_PLAYING -> BINGO_ENDED
  await step("end bingo", () => host.click('button:has-text("End Game")'));
  await host.waitForTimeout(700);
  await shot(host, mode, "host-ended");
  await presentation.bringToFront();
  await presentation.waitForTimeout(500);
  await shot(presentation, mode, "presentation-ended");
  await audience.bringToFront();
  await audience.waitForTimeout(300);
  await shot(audience, mode, "audience-ended");
  await player.bringToFront();
  await player.waitForTimeout(500);
  await shot(player, mode, "player-ended");
  } finally {
    await browser.close();
  }
  log(`=== ${mode} done ===`);
}

// ─── Run all flows ──────────────────────────────────────────────────────────
// Each flow gets its own try/catch so a failure partway through one (a
// flaky click, a state-machine surprise) doesn't stop the others from
// running and capturing what they can.

async function runFlow(label, fn) {
  try {
    await fn();
  } catch (e) {
    log("FLOW FAILED:", label, "-", String(e.stack || e.message || e));
  }
}

await runFlow("trivia-individual", () => runTriviaFlow({ teamMode: false }));
await runFlow("trivia-team", () => runTriviaFlow({ teamMode: true }));
await runFlow("bingo", () =>
  runBingoFlow({ mode: "bingo", cardMode: "numbered", playerName: "Jamie" }),
);
await runFlow("bingo-phrases", () =>
  runBingoFlow({ mode: "bingo-phrases", cardMode: "phrasePool", playerName: "Riley" }),
);

log("all done");
