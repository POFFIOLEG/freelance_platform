/**
 * Звук удара по сковородке (синтез Web Audio: металлический «дзынь», низкий удар, короткий шум).
 * Без внешних файлов — работает после unlockNotificationAudio.
 */

let sharedCtx = null;

function getContext() {
  const Ctor = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!Ctor) return null;
  if (!sharedCtx) sharedCtx = new Ctor();
  return sharedCtx;
}

/** Вызвать после жеста пользователя (клик по колокольчику и т.д.), чтобы браузер не блокировал звук. */
export function unlockNotificationAudio() {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
}

function connectToDestination(ctx, ...nodes) {
  let last = nodes[0];
  for (let i = 1; i < nodes.length; i++) {
    last.connect(nodes[i]);
    last = nodes[i];
  }
  last.connect(ctx.destination);
}

export function playNotificationSound() {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    const dur = 0.22;

    // «Бряц» металла: отфильтрованный шум с быстрым затуханием
    const nSamples = Math.floor(ctx.sampleRate * dur);
    const noiseBuf = ctx.createBuffer(1, nSamples, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < nSamples; i++) {
      const env = Math.exp(-(i / nSamples) * 5.2);
      ch[i] = (Math.random() * 2 - 1) * env;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(3200, t0);
    bp.frequency.exponentialRampToValueAtTime(1400, t0 + 0.06);
    bp.Q.value = 1.1;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0001, t0);
    nGain.gain.exponentialRampToValueAtTime(0.42, t0 + 0.003);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    connectToDestination(ctx, noiseSrc, bp, nGain);
    noiseSrc.start(t0);
    noiseSrc.stop(t0 + dur);

    // Низкий «стук» по дну сковороды
    const thud = ctx.createOscillator();
    thud.type = "triangle";
    thud.frequency.setValueAtTime(220, t0);
    thud.frequency.exponentialRampToValueAtTime(55, t0 + 0.1);
    const thudG = ctx.createGain();
    thudG.gain.setValueAtTime(0.0001, t0);
    thudG.gain.exponentialRampToValueAtTime(0.2, t0 + 0.008);
    thudG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    connectToDestination(ctx, thud, thudG);
    thud.start(t0);
    thud.stop(t0 + 0.21);

    // Высокий затухающий перезвон
    const ring = ctx.createOscillator();
    ring.type = "sine";
    ring.frequency.setValueAtTime(780, t0);
    ring.frequency.exponentialRampToValueAtTime(380, t0 + 0.1);
    const ringG = ctx.createGain();
    ringG.gain.setValueAtTime(0.0001, t0);
    ringG.gain.exponentialRampToValueAtTime(0.11, t0 + 0.002);
    ringG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    connectToDestination(ctx, ring, ringG);
    ring.start(t0);
    ring.stop(t0 + 0.19);
  } catch {
    /* автовоспроизведение может быть запрещено до unlock */
  }
}
