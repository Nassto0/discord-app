import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

interface VoicePlayerProps {
  src: string;
  duration: number | null;
  isOwn: boolean;
}

export function VoicePlayer({ src, duration }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [waveform] = useState(() => Array.from({ length: 48 }, () => Math.random() * 0.8 + 0.2));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.addEventListener('loadedmetadata', () => { if (audio.duration !== Infinity) setTotalDuration(audio.duration); });
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('ended', () => { setIsPlaying(false); setCurrentTime(0); });
    return () => { audio.pause(); audio.remove(); };
  }, [src]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const activeBars = Math.floor((progress / 100) * waveform.length);

  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-secondary p-2.5 min-w-[240px]">
      <button onClick={togglePlay}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors">
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex h-5 items-end gap-[2px]">
          {waveform.map((h, i) => (
            <div key={i}
              className={`w-[2px] rounded-full transition-colors duration-100 ${i < activeBars ? 'bg-primary' : 'bg-white/20'}`}
              style={{ height: `${h * 20}px` }} />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {isPlaying ? formatDuration(currentTime) : formatDuration(totalDuration)}
        </span>
      </div>
    </div>
  );
}
