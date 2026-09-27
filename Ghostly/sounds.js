const STORAGE_KEY = "ghostly.sound-effects.v1";
let audioContext = null;

export function soundEffectsEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) !== "off"; }
  catch { return true; }
}

export function setSoundEffectsEnabled(enabled) {
  try { localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off"); }
  catch { /* Sound preference applies for this visit when storage is unavailable. */ }
}

export function playUiSound(kind = "tap") {
  if (!soundEffectsEnabled()) return;
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType) return;
  try {
    audioContext ||= new AudioContextType();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    const patterns = {
      tap: [[520, 0, .045, .018]],
      toggle: [[420, 0, .055, .016], [620, .045, .065, .014]],
      navigation: [[620, 0, .045, .014], [790, .045, .07, .012]],
      favorite: [[520, 0, .07, .018], [780, .055, .11, .016]],
      sparkle: [[740, 0, .055, .014], [990, .045, .1, .012]],
      theme: [[460, 0, .075, .014], [690, .065, .11, .014]],
      download: [[660, 0, .055, .015], [880, .05, .095, .014]],
      success: [[440, 0, .11, .018], [587, .085, .12, .016], [784, .17, .16, .014]]
    };
    for (const [frequency, offset, duration, volume] of patterns[kind] || patterns.tap) {
      const start = audioContext.currentTime + .012 + offset;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + .02);
    }
  } catch { /* Unsupported or blocked audio never interrupts a gallery action. */ }
}
