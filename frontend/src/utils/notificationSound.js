let sharedCtx = null;

function getContext() {
  const Ctor = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!Ctor) return null;
  if (!sharedCtx) sharedCtx = new Ctor();
  return sharedCtx;
}

export function unlockNotificationAudio() {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
}

function scheduleTone(ctx, startTime, frequency, durationSec, peakGain) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, startTime);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(peakGain, 0.0002), startTime + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + durationSec + 0.04);
}

export function playNotificationSound() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    scheduleTone(ctx, t0, 1046.5, 0.14, 0.09);
    scheduleTone(ctx, t0 + 0.07, 1568.0, 0.16, 0.075);
  } catch {
    /* без unlock звук может не сыграть */
  }
}
