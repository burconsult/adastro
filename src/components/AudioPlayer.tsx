import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';

type AudioPlayerProps = {
  src: string;
  type?: string;
  label?: string;
};

const PLAYBACK_RATES = [0.85, 1, 1.25, 1.5];

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
  const [playbackRate, setPlaybackRate] = useState(1);

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
    const handleRateChange = () => setPlaybackRate(audio.playbackRate || 1);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleDuration);
    audio.addEventListener('durationchange', handleDuration);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('ratechange', handleRateChange);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleDuration);
      audio.removeEventListener('durationchange', handleDuration);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('ratechange', handleRateChange);
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

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
        audio.playbackRate = playbackRate;
        await audio.play();
      } catch {
        return;
      }
    } else {
      audio.pause();
    }
  };

  const seekBy = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    ensureSource();
    const nextTime = Math.max(0, Math.min(duration || Number.MAX_SAFE_INTEGER, (audio.currentTime || 0) + seconds));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handlePlaybackRateChange = (nextRate: number) => {
    const audio = audioRef.current;
    setPlaybackRate(nextRate);
    if (audio) {
      audio.playbackRate = nextRate;
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

      <div className="rounded-[1.75rem] border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => seekBy(-15)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted"
              aria-label="Skip back 15 seconds"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={togglePlayback}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-foreground/10 bg-foreground text-background shadow-sm transition hover:bg-foreground/90"
              aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" aria-hidden="true" fill="currentColor" />
              ) : (
                <Play className="h-5 w-5" aria-hidden="true" fill="currentColor" />
              )}
            </button>

            <button
              type="button"
              onClick={() => seekBy(30)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted"
              aria-label="Skip forward 30 seconds"
            >
              <RotateCw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-foreground">Narrated article playback</div>
              <div className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {playbackRate.toFixed(2).replace(/\.00$/, '')}x
              </div>
            </div>

            <div className="relative h-2.5">
              <div className="h-2.5 rounded-full bg-muted" />
              <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${progress}%` }} />
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
                className="absolute inset-0 h-2.5 w-full cursor-pointer appearance-none bg-transparent opacity-0"
                aria-label="Seek audio"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Skip 15s back or 30s forward without leaving the article.</span>
              <label className="flex items-center gap-2">
                <span>Speed</span>
                <select
                  value={playbackRate}
                  onChange={(event) => handlePlaybackRateChange(Number(event.target.value))}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                >
                  {PLAYBACK_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate.toFixed(2).replace(/\.00$/, '')}x
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <audio ref={audioRef} preload="none" controlsList="nodownload" className="hidden" />
      </div>
    </div>
  );
};

export default AudioPlayer;
