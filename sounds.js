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

// Short, soft synthesized tones keep the gallery responsive without external audio files.
const cues = {
  tap:        [[523, 0, .07, .012, "sine"]],
  toggle:     [[440, 0, .075, .012, "sine"], [659, .055, .11, .010, "sine"]],
  navigation: [[587, 0, .08, .011, "sine"], [784, .055, .13, .009, "sine"]],
  favorite:   [[523, 0, .09, .012, "sine"], [659, .055, .12, .010, "triangle"], [784, .105, .17, .008, "sine"]],
  sparkle:    [[784, 0, .07, .009, "sine"], [1047, .045, .13, .007, "sine"], [1319, .1, .16, .005, "sine"]],
  theme:      [[392, 0, .11, .009, "sine"], [523, .065, .12, .009, "sine"], [659, .13, .16, .007, "triangle"]],
  download:   [[659, 0, .08, .009, "sine"], [880, .06, .13, .009, "sine"], [1175, .12, .16, .006, "sine"]],
  success:    [[440, 0, .13, .010, "sine"], [554, .08, .15, .009, "sine"], [659, .16, .18, .007, "triangle"]],
  open:       [[392, 0, .09, .008, "sine"], [587, .05, .12, .008, "sine"]],
  close:      [[587, 0, .07, .007, "sine"], [392, .045, .10, .006, "sine"]],
  filter:     [[659, 0, .07, .008, "sine"], [784, .04, .09, .007, "triangle"]],
  search:     [[740, 0, .045, .005, "sine"]],
  sort:       [[523, 0, .06, .008, "sine"], [659, .04, .09, .007, "sine"]]
};

export function playUiSound(kind = "tap") {
  if (!soundEffectsEnabled()) return;
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType) return;
  try {
    audioContext ||= new AudioContextType();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    for (const [frequency, offset, duration, volume, waveform] of cues[kind] || cues.tap) {
      const start = audioContext.currentTime + .012 + offset;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + .018);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + .025);
    }
  } catch { /* Unsupported or blocked audio never interrupts a gallery action. */ }
}
