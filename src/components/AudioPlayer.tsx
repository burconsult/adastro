import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

type AudioPlayerProps = {
  src: string;
  type?: string;
  label?: string;
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, type, label = 'Audio version' }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const ensureSource = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.querySelector('source')) return;
    const source = document.createElement('source');
    source.src = src;
    if (type) {
      source.type = type;
    }
    audio.appendChild(source);
    audio.load();
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleDuration = () => setDuration(audio.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleDuration);
    audio.addEventListener('durationchange', handleDuration);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleDuration);
      audio.removeEventListener('durationchange', handleDuration);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.querySelectorAll('source').forEach((source) => source.remove());
    audio.load();
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [src, type]);

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        ensureSource();
        await audio.play();
      } catch {
        return;
      }
    } else {
      audio.pause();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono tracking-normal text-muted-foreground/80">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
      <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={togglePlayback}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-foreground text-background transition hover:bg-foreground/90"
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden="true" fill="currentColor" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" fill="currentColor" />
            )}
          </button>

          <div className="flex-1">
            <div className="relative h-2">
              <div className="h-2 rounded-full bg-muted"></div>
              <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progress}%` }}></div>
              <input
                type="range"
                min={0}
                max={Math.max(1, duration)}
                step={1}
                value={currentTime}
                onChange={(event) => {
                  const audio = audioRef.current;
                  if (!audio) return;
                  const nextTime = Number(event.target.value);
                  audio.currentTime = nextTime;
                  setCurrentTime(nextTime);
                }}
                className="absolute inset-0 h-2 w-full cursor-pointer opacity-0"
                aria-label="Seek audio"
              />
            </div>
          </div>

          <span className="text-xs font-medium text-muted-foreground">HQ</span>
        </div>
        <audio ref={audioRef} preload="none" controlsList="nodownload noplaybackrate" className="hidden" />
      </div>
    </div>
  );
};

export default AudioPlayer;
