import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Volume2, Square, Activity } from 'lucide-react';

interface AudioDevice {
  deviceId: string;
  label: string;
}

export function AudioSettings() {
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [selectedInput, setSelectedInput] = useState('default');
  const [selectedOutput, setSelectedOutput] = useState('default');
  const [inputVolume, setInputVolume] = useState(100);
  const [outputVolume, setOutputVolume] = useState(80);
  const [micLevel, setMicLevel] = useState(0);
  const [testing, setTesting] = useState(false);
  const [sensitivity, setSensitivity] = useState(() => Number(localStorage.getItem('audio-sensitivity') || '50'));
  const [audioQuality, setAudioQuality] = useState(() => localStorage.getItem('audio-quality') || 'high');
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    loadDevices();
    const saved = localStorage.getItem('audio-settings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.inputDevice) setSelectedInput(s.inputDevice);
        if (s.outputDevice) setSelectedOutput(s.outputDevice);
        if (s.inputVolume !== undefined) setInputVolume(s.inputVolume);
        if (s.outputVolume !== undefined) setOutputVolume(s.outputVolume);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('audio-settings', JSON.stringify({
      inputDevice: selectedInput, outputDevice: selectedOutput,
      inputVolume, outputVolume,
    }));
  }, [selectedInput, selectedOutput, inputVolume, outputVolume]);

  const loadDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      setInputDevices(devices.filter((d) => d.kind === 'audioinput').map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` })));
      setOutputDevices(devices.filter((d) => d.kind === 'audiooutput').map((d) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 8)}` })));
    } catch {}
  };

  const startMicTest = useCallback(async () => {
    if (testing) { stopMicTest(); return; }
    try {
      // Use 'ideal' instead of 'exact' to prevent OverconstrainedError if device is unplugged
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedInput !== 'default' ? { ideal: selectedInput } : undefined },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      setTesting(true);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel(Math.min(100, (avg / 128) * 100 * (inputVolume / 100)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  }, [testing, selectedInput, inputVolume]);

  const stopMicTest = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setTesting(false);
    setMicLevel(0);
  };

  useEffect(() => () => { stopMicTest(); }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Volume2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">Voice & Audio</h2>
          <p className="text-sm text-muted-foreground">Manage your microphone and speaker settings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Input Device</label>
          <select value={selectedInput} onChange={(e) => {
            setSelectedInput(e.target.value);
            // Apply to live call immediately
            window.dispatchEvent(new CustomEvent('audio-settings-changed', { detail: { type: 'input-device', value: e.target.value } }));
          }}
            className="h-11 w-full rounded-xl border border-border bg-card/50 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/50 cursor-pointer">
            <option value="default">Default Device</option>
            {inputDevices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Output Device</label>
          <select value={selectedOutput} onChange={(e) => {
            setSelectedOutput(e.target.value);
            window.dispatchEvent(new CustomEvent('audio-settings-changed', { detail: { type: 'output-device', value: e.target.value } }));
          }}
            className="h-11 w-full rounded-xl border border-border bg-card/50 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/50 cursor-pointer">
            <option value="default">Default Device</option>
            {outputDevices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Input Volume</label>
            <span className="text-xs font-medium text-foreground bg-secondary px-2 py-0.5 rounded-md">{inputVolume}%</span>
          </div>
          <input type="range" min={0} max={100} value={inputVolume} onChange={(e) => {
            const val = Number(e.target.value);
            setInputVolume(val);
            window.dispatchEvent(new CustomEvent('audio-settings-changed', { detail: { type: 'input-volume', value: val } }));
          }}
            className="w-full accent-primary h-2 rounded-full appearance-none bg-secondary cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 transition-all" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Output Volume</label>
            <span className="text-xs font-medium text-foreground bg-secondary px-2 py-0.5 rounded-md">{outputVolume}%</span>
          </div>
          <input type="range" min={0} max={100} value={outputVolume} onChange={(e) => {
            const val = Number(e.target.value);
            setOutputVolume(val);
            // Apply immediately to active call audio element
            window.dispatchEvent(new CustomEvent('audio-settings-changed', { detail: { type: 'output-volume', value: val } }));
          }}
            className="w-full accent-primary h-2 rounded-full appearance-none bg-secondary cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 transition-all" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/30 p-5">
        <label className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Activity className="h-4 w-4" /> Mic Test
        </label>
        <div className="flex items-center gap-4">
          <button onClick={startMicTest}
            className={`group flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all active:scale-95 shadow-sm ${
              testing ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}>
            {testing ? <><Square className="h-4 w-4 fill-current" /> Stop Test</> : <><Mic className="h-4 w-4 transition-transform group-hover:scale-110" /> Let's Check</>}
          </button>
          <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden relative border border-border">
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-75 ease-out"
              style={{ width: `${micLevel}%` }} />
          </div>
        </div>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />

      <div>
        <h3 className="text-sm font-bold text-foreground mb-4">Voice Processing</h3>
        <div className="space-y-2">
          <ToggleSetting label="Echo Cancellation" description="Reduces echo from speakers bleeding into mic." defaultChecked={false} storageKey="echo-cancel" />
          <ToggleSetting label="Noise Suppression" description="Filters background noise for clearer audio." defaultChecked={false} storageKey="noise-suppress" />
          <ToggleSetting label="Auto Gain Control" description="Automatically adjusts mic volume for consistent levels." defaultChecked={false} storageKey="auto-gain" />
        </div>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />

      <div>
        <h3 className="text-sm font-bold text-foreground mb-4">Advanced Audio Settings</h3>
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card/30 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="text-sm font-semibold text-foreground">Mic Sensitivity Threshold</label>
                <p className="mt-1 text-xs text-muted-foreground">Lower values pick up less background noise but may cut off quiet speech</p>
              </div>
              <span className="text-xs font-medium text-foreground bg-secondary px-2 py-0.5 rounded-md">{sensitivity}%</span>
            </div>
            <input type="range" min={0} max={100} value={sensitivity} onChange={(e) => {
              const val = Number(e.target.value);
              setSensitivity(val);
              localStorage.setItem('audio-sensitivity', String(val));
            }}
              className="w-full accent-primary h-2 rounded-full appearance-none bg-secondary cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 transition-all" />
          </div>

          <div className="rounded-xl border border-border bg-card/30 p-5">
            <p className="text-sm font-semibold text-foreground mb-1">Audio Quality</p>
            <p className="text-xs text-muted-foreground mb-4">Higher quality uses more bandwidth but sounds clearer</p>
            <select value={audioQuality} onChange={(e) => {
              setAudioQuality(e.target.value);
              localStorage.setItem('audio-quality', e.target.value);
            }}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/50 cursor-pointer">
              <option value="low">Low (Opus 24kbps)</option>
              <option value="medium">Medium (Opus 48kbps)</option>
              <option value="high">High (Opus 96kbps)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSetting({ label, description, defaultChecked, storageKey }: { label: string; description: string; defaultChecked: boolean; storageKey: string }) {
  const [enabled, setEnabled] = useState(() => {
    const saved = localStorage.getItem(`audio-${storageKey}`);
    return saved !== null ? saved === 'true' : defaultChecked;
  });

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(`audio-${storageKey}`, String(next));
    // Dispatch to useWebRTC so live calls apply the constraint immediately
    window.dispatchEvent(new CustomEvent('audio-settings-changed', { detail: { type: 'toggle', key: storageKey, value: next } }));
  };

  return (
    <button onClick={toggle} className="group flex w-full items-center justify-between rounded-xl border border-transparent bg-card/30 p-4 hover:border-border hover:bg-card/50 transition-all active:scale-[0.99] text-left">
      <div className="pr-4">
        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{label}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
      <div className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${enabled ? 'bg-primary' : 'bg-zinc-600'}`}>
        <div className={`absolute left-[2px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? 'translate-x-[20px]' : 'translate-x-0'}`} />
      </div>
    </button>
  );
}
