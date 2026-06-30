// src/client/utils/soundEffects.ts — Web Audio synthesized notification sounds
// No shipped audio assets — short tones generated via OscillatorNode.
// Gated by a sound-enabled preference persisted to localStorage (default on).

const SOUND_PREF_KEY = "janedeck_sound_enabled";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextCtor =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {
      // Autoplay policy may still block resume — ignore, next user gesture will unlock it.
    });
  }
  return audioContext;
}

export function isSoundEnabled(): boolean {
  try {
    const stored = localStorage.getItem(SOUND_PREF_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_PREF_KEY, String(enabled));
  } catch {
    // localStorage may be unavailable — preference just won't persist
  }
}

/** Play a single tone for the given duration (seconds) at the given frequency (Hz). */
function playTone(frequency: number, startOffset: number, duration: number, gain = 0.15): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  const startTime = ctx.currentTime + startOffset;
  const endTime = startTime + duration;

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02);
  gainNode.gain.linearRampToValueAtTime(0, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(startTime);
  oscillator.stop(endTime + 0.02);
}

/** Short ding for "someone marked a square" — single ~600Hz tone. */
export function playMarkSound(): void {
  if (!isSoundEnabled()) return;
  playTone(600, 0, 0.15, 0.12);
}

/** Ascending 3-note chime for "someone won" — celebratory. */
export function playWinSound(): void {
  if (!isSoundEnabled()) return;
  playTone(523.25, 0, 0.18, 0.16); // C5
  playTone(659.25, 0.15, 0.18, 0.16); // E5
  playTone(783.99, 0.3, 0.3, 0.18); // G5
}
