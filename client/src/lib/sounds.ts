function createMultiTone(freqs: { f: number; delay: number; dur: number }[], volume = 0.2): () => void {
  return () => {
    try {
      const ctx = new AudioContext();
      for (const { f, delay, dur } of freqs) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.value = volume;
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + dur);
      }
    } catch {}
  };
}

export const sounds = {
  messageSent: createMultiTone([
    { f: 600, delay: 0, dur: 0.08 },
    { f: 900, delay: 0.06, dur: 0.1 },
  ], 0.12),

  messageReceived: createMultiTone([
    { f: 800, delay: 0, dur: 0.1 },
    { f: 600, delay: 0.08, dur: 0.12 },
  ], 0.12),

  callRinging: createMultiTone([
    { f: 440, delay: 0, dur: 0.4 },
    { f: 520, delay: 0, dur: 0.4 },
    { f: 440, delay: 0.6, dur: 0.4 },
    { f: 520, delay: 0.6, dur: 0.4 },
    { f: 440, delay: 1.2, dur: 0.4 },
    { f: 520, delay: 1.2, dur: 0.4 },
  ], 0.15),

  callEnd: createMultiTone([
    { f: 400, delay: 0, dur: 0.15 },
    { f: 300, delay: 0.15, dur: 0.25 },
  ], 0.15),

  notification: createMultiTone([
    { f: 523, delay: 0, dur: 0.1 },
    { f: 659, delay: 0.1, dur: 0.1 },
    { f: 784, delay: 0.2, dur: 0.15 },
  ], 0.12),
};

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function showNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    new Notification(title, { body, icon: '/icon.png' });
  }
}
