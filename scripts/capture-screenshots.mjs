// scripts/capture-screenshots.mjs — README screenshot capture
//
// Drives a live JaneDeck dev server with Playwright and captures every major
// screen for all four roles (host, player, presentation, audience) across
// all four game modes (trivia individual, trivia team, bingo numbered,
// bingo phrase pool), writing PNGs into docs/screenshots/<mode>/<role>-<state>.png.
//
// Both trivia flows also attach an image to one question, so every question
// screen is captured twice: once plain and once with media (`-media` suffix).
// A fifth flow captures the frame and filter catalog into
// docs/screenshots/media/.
//
// Media capture needs two things: an R2 bucket bound as MEDIA (`npm run dev`
// emulates one locally) and reachable placecats.com/placekittens.com for the
// sample photo. Without either, the media steps log a warning and skip rather
// than failing the run.
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
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
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

// ─── Sample question image ──────────────────────────────────────────────────
//
// The media flows need a real photo to upload — real photographic detail is
// what makes the filters legible (grain, halftone and pixelate all read as
// nothing on a flat synthetic image). These come from placecats.com, which
// serves a named cat at any size, so a given name always yields the same
// picture and re-runs are reproducible. placekittens.com is the fallback if
// placecats is unreachable.
//
// This is the script's only network dependency beyond the dev server. If both
// services are down, the media steps log a warning and skip, exactly as they
// do when no R2 bucket is bound — the rest of the capture still runs.

const SAMPLE_IMAGE_WIDTH = 800;
const SAMPLE_IMAGE_HEIGHT = 533;

/**
 * Named placecats subjects, one per flow, so the docs aren't four copies of
 * the same cat. Any name placecats.com knows works here.
 */
const CAT_NAMES = {
  "trivia-individual": "neo",
  "trivia-team": "millie",
  media: "bella",
};

function sampleImageSources(name) {
  return [
    `https://placecats.com/${name}/${SAMPLE_IMAGE_WIDTH}/${SAMPLE_IMAGE_HEIGHT}`,
    `https://placecats.com/${SAMPLE_IMAGE_WIDTH}/${SAMPLE_IMAGE_HEIGHT}`,
    `https://placekittens.com/${SAMPLE_IMAGE_WIDTH}/${SAMPLE_IMAGE_HEIGHT}`,
  ];
}

/** Downloaded images, cached per cat name for the life of the run. */
const sampleImageCache = new Map();

/**
 * Download the sample photo for a flow and return its local path, or null if
 * every source is unreachable (callers skip their media screenshots).
 */
async function sampleImage(mode) {
  const name = CAT_NAMES[mode] ?? CAT_NAMES.media;
  if (sampleImageCache.has(name)) return sampleImageCache.get(name);

  const dir = path.join(os.tmpdir(), "janedeck-screenshots");
  mkdirSync(dir, { recursive: true });

  for (const url of sampleImageSources(name)) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) continue;
      const type = response.headers.get("content-type") ?? "";
      const extension = type.includes("png") ? "png" : "jpg";
      const file = path.join(dir, `sample-${name}.${extension}`);
      writeFileSync(file, Buffer.from(await response.arrayBuffer()));
      log("downloaded sample image", url);
      sampleImageCache.set(name, file);
      return file;
    } catch {
      // try the next source
    }
  }

  log("SKIP media: could not download a sample image from placecats or placekittens");
  sampleImageCache.set(name, null);
  return null;
}

// ─── Attaching media to a question ──────────────────────────────────────────

/** Which question of round 1 carries the image, 0-based. */
const MEDIA_QUESTION_INDEX = 1;

/**
 * The media question's own wording. The Quick Start template's second question
 * is about planets, and a cat photo pinned to it makes for a confusing
 * screenshot — so attaching an image rewrites the question into a real picture
 * round, which is what a host would actually do.
 */
const MEDIA_QUESTION = {
  text: "What breed is the cat in this picture?",
  correctAnswer: "Tabby",
  acceptableAnswers: "tabby, tabby cat, brown tabby",
  /** What the player types, so the round still scores as correct */
  playerAnswer: "Tabby",
};

// Pose-neutral: each flow gets a different cat, so the description has to fit
// all of them.
const MEDIA_ALT = "A tabby cat looking straight at the camera";
const MEDIA_CAPTION = "The office cat, 2026";

/**
 * Attach the sample image to one question and give it a frame + filters.
 *
 * Returns false (having logged why) when this server has no R2 bucket bound —
 * the media controls hide themselves in that case, and the caller skips its
 * media screenshots rather than failing the whole flow.
 */
async function attachSampleImage(
  page,
  mode,
  qid,
  { frame = "polaroid", filters = ["Sepia", "Film grain"] } = {},
) {
  const fileInput = page.locator(`#${qid}-media-file`);
  if ((await fileInput.count()) === 0) {
    log("SKIP media: no upload control on this server (is an R2 bucket bound as MEDIA?)");
    return false;
  }

  const file = await sampleImage(mode);
  if (!file) return false;

  // Rewrite the question to match the picture before uploading it.
  await fillRetry(page, `#${qid}-text`, MEDIA_QUESTION.text);
  await fillRetry(page, `#${qid}-answer`, MEDIA_QUESTION.correctAnswer);
  await fillRetry(page, `#${qid}-alts`, MEDIA_QUESTION.acceptableAnswers);

  await fileInput.setInputFiles(file);
  try {
    await page.waitForSelector(`#${qid}-media-alt`, { timeout: 20000 });
  } catch {
    log("SKIP media: the upload did not complete");
    return false;
  }

  await fillRetry(page, `#${qid}-media-alt`, MEDIA_ALT);
  await page.locator(`input[name="${qid}-media-frame"][value="${frame}"]`).check({ force: true });
  await page.waitForTimeout(200);

  const caption = page.locator(`#${qid}-media-caption`);
  if (await caption.count()) await caption.fill(MEDIA_CAPTION);

  for (const label of filters) {
    await step(`apply filter ${label}`, () =>
      page.locator(`label.qm-chip:has-text("${label}")`).first().click(),
    );
    await page.waitForTimeout(150);
  }

  await page.waitForTimeout(300);
  return true;
}

async function shot(page, mode, name) {
  const dir = path.join(OUT_ROOT, mode);
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
  log(`[${mode}]`, "captured", name);
}

/** Screenshot a single element rather than the viewport — used for the
 *  frame/filter catalog tiles and the media editor panel. */
async function shotElement(locator, mode, name) {
  const dir = path.join(OUT_ROOT, mode);
  mkdirSync(dir, { recursive: true });
  await locator.page().waitForTimeout(150);
  await locator.screenshot({ path: path.join(dir, `${name}.png`) });
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

  // Attach an image to round 1's second question. Doing it to the *second*
  // question rather than the first is deliberate: the first question still
  // produces the plain text-only screenshots, so one run captures both the
  // with-media and without-media version of every question screen.
  const hasMedia = await attachSampleImage(host, mode, `round-0-q${MEDIA_QUESTION_INDEX}`);
  if (hasMedia) {
    await shot(host, mode, "host-create-media");
    // The media editor on its own — the frame picker, filter chips, strength
    // slider, alt text and caption fields, with the live preview.
    await step("media editor panel", async () => {
      const panel = host
        .locator(`#round-0-q${MEDIA_QUESTION_INDEX}-media-file`)
        .locator("xpath=..");
      await panel.scrollIntoViewIfNeeded();
      await host.waitForTimeout(250);
      await shotElement(panel, mode, "host-create-media-editor");
    });
  }

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

  // Round 1's media question was rewritten by attachSampleImage, so the
  // answer the player types has to change with it.
  const round1Answers = hasMedia
    ? ROUND1_ANSWERS.map((a, i) =>
        i === MEDIA_QUESTION_INDEX ? MEDIA_QUESTION.playerAnswer : a,
      )
    : ROUND1_ANSWERS;
  const roundAnswers = [round1Answers, ROUND2_ANSWERS];
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

        // The question carrying the image, at the moment it's revealed and
        // takes focus on the shared screen. Captured here rather than after
        // the loop because a later reveal moves the focus off it.
        if (hasMedia && firstRound && q === MEDIA_QUESTION_INDEX) {
          await presentation.bringToFront();
          await presentation.waitForTimeout(600);
          await shot(presentation, mode, "presentation-answering-media");
          await player.bringToFront();
          await player.waitForTimeout(400);
          await shot(player, mode, "player-answering-media");
          await audience.bringToFront();
          await audience.waitForTimeout(300);
          await shot(audience, mode, "audience-answering-media");
          await host.bringToFront();
          await host.waitForTimeout(400);
          await shot(host, mode, "host-answering-media");
          await player.bringToFront();
          await player.waitForTimeout(300);
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
        // Round 1's second question is the one carrying an image.
        const isMediaQuestion = hasMedia && firstRound && q === MEDIA_QUESTION_INDEX;

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
        // QUESTION_DISPLAY is transient — it auto-advances after 3s — so these
        // fire immediately rather than waiting on a settled condition.
        if (isFirstQuestionEver || isMediaQuestion) {
          const suffix = isMediaQuestion ? "-media" : "";
          await shot(host, mode, `host-question-display${suffix}`);
          await presentation.bringToFront();
          await presentation.waitForTimeout(300);
          await shot(presentation, mode, `presentation-question-display${suffix}`);
          await audience.bringToFront();
          await audience.waitForTimeout(300);
          await shot(audience, mode, `audience-question-display${suffix}`);
          await player.bringToFront();
          await player.waitForTimeout(300);
          await shot(player, mode, `player-question-display${suffix}`);
          await host.bringToFront();
        }

        await host.waitForTimeout(3200); // auto QUESTION_DISPLAY -> ANSWERING
        const answeringSuffix = isMediaQuestion ? "-media" : "";
        if (isFirstQuestionEver || isMediaQuestion) {
          await shot(host, mode, `host-answering${answeringSuffix}`);
          await presentation.bringToFront();
          await presentation.waitForTimeout(400);
          await shot(presentation, mode, `presentation-answering${answeringSuffix}`);
          await audience.bringToFront();
          await audience.waitForTimeout(300);
          await shot(audience, mode, `audience-answering${answeringSuffix}`);
        }

        await player.bringToFront();
        await step("player answer input wait", () =>
          player.waitForSelector("#answer-input", { timeout: 10000 }),
        );
        if (isFirstQuestionEver || isMediaQuestion) {
          await shot(player, mode, `player-answering${answeringSuffix}`);
        }
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

// ─── Media catalog ──────────────────────────────────────────────────────────
//
// Not a gameplay flow — a reference sheet. Uploads one photo and photographs
// it once per frame and once per filter, plus the two host-facing states that
// only the media feature has: the editor panel, and a question whose image the
// server can't find.

const CATALOG_FRAMES = ["none", "polaroid", "tv", "slide", "gallery", "phone"];

// Chip label -> filename slug. Labels are what the host clicks; slugs match
// the filter ids in src/shared/media.ts.
const CATALOG_FILTERS = [
  ["Black & white", "bw"],
  ["Sepia", "sepia"],
  ["Halftone", "halftone"],
  ["Film grain", "grain"],
  ["Vignette", "vignette"],
  ["VHS", "vhs"],
  ["Blur", "blur"],
  ["Pixelate", "pixelate"],
];

async function runMediaCatalogFlow() {
  const mode = "media";
  log(`=== ${mode} ===`);
  const browser = await chromium.launch();
  try {
    // Twice the pixel density for the catalog tiles: they're shown small in
    // the README, and the filter textures (grain, halftone dots, scanlines)
    // vanish at 1x. The full-page shots later get their own 1x context —
    // at 2x they'd be ~800KB each for no benefit at the size they're shown.
    const context = await browser.newContext({
      reducedMotion: "reduce",
      deviceScaleFactor: 2,
    });

    const host = await newPage(context, { width: 1280, height: 1100 });
    await login(host);
    await host.click('button:has-text("Trivia")');
    await host.waitForURL("**/host/create/trivia");
    await host.click('button:has-text("Quick Start")');
    await host.waitForTimeout(300);

    const qid = "round-0-q0";
    const attached = await attachSampleImage(host, mode, qid, {
      frame: "none",
      filters: [],
    });
    if (!attached) {
      log(`=== ${mode} skipped ===`);
      return;
    }

    const figure = host.locator("figure.qm").first();

    // The editor panel itself — frame picker, filter chips, alt text, caption.
    await step("media editor panel", async () => {
      const panel = host.locator(`#${qid}-media-file`).locator("xpath=..");
      await panel.scrollIntoViewIfNeeded();
      await host.waitForTimeout(250);
      await shotElement(panel, mode, "editor");
    });

    // One tile per frame. The caption field only exists on frames that have a
    // caption slot, so fill it whenever it appears.
    for (const frame of CATALOG_FRAMES) {
      await host.locator(`input[name="${qid}-media-frame"][value="${frame}"]`).check({ force: true });
      await host.waitForTimeout(200);
      const caption = host.locator(`#${qid}-media-caption`);
      if (await caption.count()) {
        await caption.fill(MEDIA_CAPTION);
        await host.waitForTimeout(200);
      }
      await shotElement(figure, mode, `frame-${frame}`);
    }

    // One tile per filter, each on its own against an unframed image.
    await host.locator(`input[name="${qid}-media-frame"][value="none"]`).check({ force: true });
    await host.waitForTimeout(200);
    for (const [label, slug] of CATALOG_FILTERS) {
      const chip = host.locator(`label.qm-chip:has-text("${label}")`).first();
      await chip.click();
      await host.waitForTimeout(250);
      await shotElement(figure, mode, `filter-${slug}`);
      await chip.click(); // back off before the next one
      await host.waitForTimeout(150);
    }

    // And one showing that they stack.
    for (const label of ["Sepia", "Film grain", "Vignette"]) {
      await host.locator(`label.qm-chip:has-text("${label}")`).first().click();
      await host.waitForTimeout(150);
    }
    await shotElement(figure, mode, "filter-stacked");

    // The reference-not-found state. A CSV carries the media id, not the
    // bytes, so importing one onto a server that never had the upload has to
    // fail visibly at setup rather than on the projector. Easiest way to
    // stage it: import a sheet pointing at an id that was never uploaded.
    await step("missing media reference", async () => {
      const pageContext = await browser.newContext({ reducedMotion: "reduce" });
      const importer = await newPage(pageContext, { width: 1280, height: 1100 });
      await login(importer);
      await importer.click('button:has-text("Trivia")');
      await importer.waitForURL("**/host/create/trivia");
      await importer.waitForSelector('button:has-text("Quick Start")');

      importer.on("dialog", (d) => d.accept().catch(() => {}));
      await importer
        .locator('input[type="file"][accept*="csv"]')
        .setInputFiles({
          name: "questions-with-a-missing-image.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(MISSING_MEDIA_CSV, "utf8"),
        });
      // The lookup that decides this is batched and debounced client-side, so
      // give it a beat to come back before expecting the notice.
      await importer.waitForSelector("text=This image isn't on the server", {
        timeout: 15000,
      });
      await importer.locator("text=This image isn't on the server").first().scrollIntoViewIfNeeded();
      await importer.waitForTimeout(300);
      await shot(importer, mode, "missing-reference");

      // ...and the guard that stops the game starting while it's unresolved.
      await importer.click('button:has-text("Start Game")');
      await importer.waitForSelector("text=/isn't on this server/", { timeout: 10000 });
      await importer.locator("text=/isn't on this server/").first().scrollIntoViewIfNeeded();
      await importer.waitForTimeout(300);
      await shot(importer, mode, "missing-reference-blocked");
      await pageContext.close();
    });
  } finally {
    await browser.close();
  }
  log(`=== ${mode} done ===`);
}

/**
 * A minimal import whose "Media ID" points at an object no server has. The id
 * is well-formed (it has to pass validation to reach the not-found state) but
 * was never uploaded.
 */
const MISSING_MEDIA_CSV = [
  "Round Name,Round Points,Question,Correct Answer,Acceptable Answers,Time Limit (seconds),Media,Media File,Media ID,Media Kind,Media Frame,Media Filters,Media Intensity,Media Alt,Media Caption",
  'Picture Round,150,Which breed is this?,Tabby,tabby,30,yes,office-cat.jpg,neverUploadedAAAAAAAAAA,image,polaroid,sepia; grain,40,A tabby cat looking at the camera,The office cat',
  "Picture Round,150,What year was this taken?,2026,,30,,,,,,,,,",
].join("\r\n") + "\r\n";

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
await runFlow("media", () => runMediaCatalogFlow());

log("all done");
