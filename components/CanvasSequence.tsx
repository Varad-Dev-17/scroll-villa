'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface CanvasSequenceProps {
  /** Total number of frames in the sequence (default: 960) */
  totalFrames?: number;
  /** Initial frames to preload before hiding preloader (default: 24 for instant <1s start) */
  initialFramesToLoad?: number;
  /** Function resolving frame index (1-based) to image URL */
  getFramePath?: (index: number) => string;
  /** Explicit 1-based frame to display (takes priority over progress if set) */
  currentFrame?: number;
  /** Normalized scrub progress from 0.0 to 1.0 */
  progress?: number;
  /** How the image fits within the canvas ('cover' or 'contain') */
  fit?: 'cover' | 'contain';
  /** Additional CSS classes for canvas container */
  className?: string;
  /** Callback fired when the initial batch of frames has fully loaded */
  onInitialLoadComplete?: () => void;
  /** Callback for frame loading updates */
  onProgressUpdate?: (loadedInitial: number, loadedTotal: number) => void;
  /** Optional custom preloader override */
  customPreloader?: (progressPercent: number, isLoaded: boolean) => React.ReactNode;
  /** Whether to show the default built-in preloader */
  showPreloader?: boolean;
}

const defaultGetFramePath = (index: number) => {
  const padded = String(index).padStart(4, '0');
  return `/frames/frame_${padded}.jpg`;
};

const CACHE_NAME = 'villa-sequence-v1';

export const CanvasSequence: React.FC<CanvasSequenceProps> = ({
  totalFrames = 960,
  initialFramesToLoad = 24,
  getFramePath = defaultGetFramePath,
  currentFrame,
  progress,
  fit = 'cover',
  className = '',
  onInitialLoadComplete,
  onProgressUpdate,
  customPreloader,
  showPreloader = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // In-memory cache for fast canvas draws
  const imageCacheRef = useRef<Map<number, HTMLImageElement>>(new Map());
  // In-flight loading promises to prevent duplicate fetches
  const pendingLoadsRef = useRef<Map<number, Promise<HTMLImageElement>>>(new Map());
  // High-priority queue for frames right at the user's scroll position
  const priorityQueueRef = useRef<number[]>([]);

  // State for initial preloader and loading metrics
  const [initialLoadedCount, setInitialLoadedCount] = useState<number>(0);
  const [totalLoadedCount, setTotalLoadedCount] = useState<number>(0);
  const [isInitialReady, setIsInitialReady] = useState<boolean>(false);
  const [isPreloaderHidden, setIsPreloaderHidden] = useState<boolean>(false);

  // Active rendering frame ref to prevent redundant draws
  const renderedFrameRef = useRef<number>(-1);
  const rafIdRef = useRef<number | null>(null);

  // Determine current active target frame (1 to totalFrames)
  const getTargetFrame = useCallback((): number => {
    if (typeof currentFrame === 'number') {
      return Math.max(1, Math.min(totalFrames, Math.round(currentFrame)));
    }
    if (typeof progress === 'number') {
      const clamped = Math.max(0, Math.min(1, progress));
      return Math.max(1, Math.min(totalFrames, Math.round(clamped * (totalFrames - 1)) + 1));
    }
    return 1;
  }, [currentFrame, progress, totalFrames]);

  // Canvas drawing routine with nearest-loaded-frame fallback
  const renderFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const cache = imageCacheRef.current;

    // Find requested image or closest loaded fallback
    let img: HTMLImageElement | undefined = cache.get(frameIndex);
    if (!img || !img.complete || img.naturalWidth === 0) {
      let closestDiff = Infinity;
      let closestFrame = -1;
      for (const [key, loadedImg] of cache.entries()) {
        const diff = Math.abs(key - frameIndex);
        if (diff < closestDiff && loadedImg.complete && loadedImg.naturalWidth > 0) {
          closestDiff = diff;
          closestFrame = key;
        }
      }
      if (closestFrame !== -1) {
        img = cache.get(closestFrame);
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) {
      return;
    }

    const { width: cWidth, height: cHeight } = canvas;
    const { naturalWidth: iWidth, naturalHeight: iHeight } = img;

    if (cWidth === 0 || cHeight === 0 || iWidth === 0 || iHeight === 0) return;

    let drawWidth: number;
    let drawHeight: number;
    let dx: number;
    let dy: number;

    const canvasAspect = cWidth / cHeight;
    const imgAspect = iWidth / iHeight;

    if (fit === 'cover') {
      if (canvasAspect > imgAspect) {
        drawWidth = cWidth;
        drawHeight = cWidth / imgAspect;
        dx = 0;
        dy = (cHeight - drawHeight) / 2;
      } else {
        drawHeight = cHeight;
        drawWidth = cHeight * imgAspect;
        dx = (cWidth - drawWidth) / 2;
        dy = 0;
      }
    } else {
      // contain
      if (canvasAspect > imgAspect) {
        drawHeight = cHeight;
        drawWidth = cHeight * imgAspect;
        dx = (cWidth - drawWidth) / 2;
        dy = 0;
      } else {
        drawWidth = cWidth;
        drawHeight = cWidth / imgAspect;
        dx = 0;
        dy = (cHeight - drawHeight) / 2;
      }
    }

    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, cWidth, cHeight);
    ctx.drawImage(img, Math.round(dx), Math.round(dy), Math.round(drawWidth), Math.round(drawHeight));
    renderedFrameRef.current = frameIndex;
  }, [fit]);

  // Request a frame render via requestAnimationFrame
  const queueRender = useCallback((frameIndex: number) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      renderFrame(frameIndex);
      rafIdRef.current = null;
    });
  }, [renderFrame]);

  // Handle canvas sizing with high-DPI scaling
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = container.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    if (width === 0 || height === 0) return;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const target = getTargetFrame();
      renderFrame(target);
    }
  }, [getTargetFrame, renderFrame]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [resizeCanvas]);

  // Single Frame Loader with Memory Deduplication and Persistent Cache Warming
  const loadSingleFrame = useCallback((index: number): Promise<HTMLImageElement> => {
    const existing = imageCacheRef.current.get(index);
    if (existing && existing.complete && existing.naturalWidth > 0) {
      return Promise.resolve(existing);
    }

    const pending = pendingLoadsRef.current.get(index);
    if (pending) {
      return pending;
    }

    const frameUrl = getFramePath(index);

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';

      img.onload = () => {
        imageCacheRef.current.set(index, img);
        pendingLoadsRef.current.delete(index);

        // Persistent disk cache warming: saves to window.caches so refreshes are 0ms
        if (typeof window !== 'undefined' && 'caches' in window) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.match(frameUrl).then((match) => {
              if (!match) {
                fetch(frameUrl, { cache: 'force-cache' }).then((res) => {
                  if (res.ok) cache.put(frameUrl, res);
                }).catch(() => {});
              }
            });
          }).catch(() => {});
        }

        resolve(img);
      };

      img.onerror = (err) => {
        pendingLoadsRef.current.delete(index);
        reject(err);
      };

      img.src = frameUrl;
    });

    pendingLoadsRef.current.set(index, promise);
    return promise;
  }, [getFramePath]);

  // Progressive Multi-Pass Stride Orchestrator
  useEffect(() => {
    let isCancelled = false;
    const initialTarget = Math.min(initialFramesToLoad, totalFrames);
    let initialCount = 0;
    let totalCount = 0;

    // Helper to generate progressive stride passes
    const buildProgressiveQueue = (): number[] => {
      const added = new Set<number>();
      const queue: number[] = [];

      const addIndex = (idx: number) => {
        if (idx >= 1 && idx <= totalFrames && !added.has(idx)) {
          added.add(idx);
          queue.push(idx);
        }
      };

      // Pass 0: Initial batch (1 to initialTarget)
      for (let i = 1; i <= initialTarget; i++) {
        addIndex(i);
      }

      // Pass 1: Global Backbone (Stride 8) - covers 100% of website timeline in ~120 frames
      for (let i = 1; i <= totalFrames; i += 8) {
        addIndex(i);
      }
      addIndex(totalFrames); // ensure last frame is present

      // Pass 2: Medium Detail (Stride 4)
      for (let i = 5; i <= totalFrames; i += 8) {
        addIndex(i);
      }

      // Pass 3: Fine Detail (Stride 2)
      for (let i = 3; i <= totalFrames; i += 4) {
        addIndex(i);
      }

      // Pass 4: Complete Sequence (Stride 1 - all remaining)
      for (let i = 1; i <= totalFrames; i++) {
        addIndex(i);
      }

      return queue;
    };

    const fullQueue = buildProgressiveQueue();
    let queuePointer = 0;

    const onFrameSuccess = (idx: number) => {
      totalCount++;
      setTotalLoadedCount(totalCount);

      if (idx <= initialTarget) {
        initialCount++;
        setInitialLoadedCount(initialCount);
        if (initialCount >= initialTarget && !isInitialReady) {
          setIsInitialReady(true);
          onInitialLoadComplete?.();
          queueRender(getTargetFrame());

          setTimeout(() => {
            if (!isCancelled) {
              setIsPreloaderHidden(true);
            }
          }, 400);
        }
      }

      onProgressUpdate?.(initialCount, totalCount);

      // Render frame 1 immediately when ready
      if (idx === 1 || renderedFrameRef.current === -1) {
        queueRender(1);
      }
    };

    // Worker pool with dynamic priority scheduling
    const CONCURRENCY = 8;
    const worker = async () => {
      while (!isCancelled) {
        let frameIdx: number | undefined;

        // 1. Give absolute priority to the user's active scrub window
        if (priorityQueueRef.current.length > 0) {
          frameIdx = priorityQueueRef.current.shift();
        } else if (queuePointer < fullQueue.length) {
          // 2. Otherwise take next progressive stride frame
          frameIdx = fullQueue[queuePointer++];
        } else {
          // All frames queued and finished
          break;
        }

        if (frameIdx === undefined) break;

        // Skip if already in memory
        if (imageCacheRef.current.has(frameIdx)) {
          continue;
        }

        try {
          await loadSingleFrame(frameIdx);
          if (isCancelled) return;
          onFrameSuccess(frameIdx);

          // If this was a priority frame close to current scrub, render it now
          const currentTgt = getTargetFrame();
          if (Math.abs(currentTgt - frameIdx) <= 2) {
            queueRender(currentTgt);
          }
        } catch {
          // Soft ignore error; nearest-frame fallback will handle it
        }
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    Promise.all(workers);

    return () => {
      isCancelled = true;
    };
  }, [initialFramesToLoad, totalFrames, loadSingleFrame, onInitialLoadComplete, onProgressUpdate, queueRender, getTargetFrame]);

  // Active Scrub Priority: When user scrolls, immediately fetch surrounding frames
  useEffect(() => {
    const target = getTargetFrame();

    // Priority window: target and next 12 frames, plus previous 4
    const priorityIndices: number[] = [];
    for (let offset = 0; offset <= 12; offset++) {
      const nextIdx = target + offset;
      if (nextIdx <= totalFrames && !imageCacheRef.current.has(nextIdx)) {
        priorityIndices.push(nextIdx);
      }
    }
    for (let offset = 1; offset <= 4; offset++) {
      const prevIdx = target - offset;
      if (prevIdx >= 1 && !imageCacheRef.current.has(prevIdx)) {
        priorityIndices.push(prevIdx);
      }
    }

    if (priorityIndices.length > 0) {
      // Prepend to priority queue so workers pick them immediately
      priorityQueueRef.current = [
        ...priorityIndices,
        ...priorityQueueRef.current.filter((id) => !priorityIndices.includes(id)),
      ].slice(0, 30);

      // Trigger immediate fetch of the exact target frame
      if (!imageCacheRef.current.has(target)) {
        loadSingleFrame(target)
          .then(() => queueRender(target))
          .catch(() => {});
      }
    }

    queueRender(target);
  }, [currentFrame, progress, getTargetFrame, queueRender, loadSingleFrame, totalFrames]);

  // Loading percentage calculation (0% to 100% of initial starter batch)
  const initialPercent = Math.min(
    100,
    Math.round((initialLoadedCount / Math.max(1, initialFramesToLoad)) * 100)
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-neutral-950 ${className}`}
    >
      {/* HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full object-cover"
        style={{ imageRendering: 'auto' }}
      />

      {/* Built-in Luxury Preloader */}
      {showPreloader && !isPreloaderHidden && (
        <div
          className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#070707] text-white transition-all duration-500 ease-out ${
            isInitialReady ? 'opacity-0 pointer-events-none scale-98' : 'opacity-100 scale-100'
          }`}
        >
          {customPreloader ? (
            customPreloader(initialPercent, isInitialReady)
          ) : (
            <div className="relative flex flex-col items-center max-w-sm w-full px-8">
              {/* Subtle Ambient Backlight Glow */}
              <div className="absolute -top-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Title & Badge */}
              <div className="flex items-center gap-2 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[11px] font-mono tracking-[0.3em] uppercase text-neutral-400">
                  Villa Architectural Experience
                </span>
              </div>

              {/* Minimalist Modern Numerical Percentage */}
              <div className="relative mb-6 text-center">
                <span className="text-7xl font-extralight tracking-tighter tabular-nums text-white">
                  {initialPercent}
                </span>
                <span className="text-xl font-light text-amber-400/80 ml-1">%</span>
              </div>

              {/* Clean Sleek Progress Bar */}
              <div className="w-full h-[2px] bg-neutral-800 rounded-full overflow-hidden mb-5">
                <div
                  className="h-full bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 transition-all duration-150 ease-out shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                  style={{ width: `${initialPercent}%` }}
                />
              </div>

              {/* Status info */}
              <div className="flex justify-between w-full text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                <span>Buffering Initial Sequence</span>
                <span>
                  {initialLoadedCount} / {initialFramesToLoad}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Background Cache Floating Pill Badge (Unobtrusive & Elegant) */}
      {isInitialReady && totalLoadedCount < totalFrames && (
        <div className="absolute bottom-4 right-4 z-30 pointer-events-none transition-opacity duration-500">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-neutral-400 text-[10px] font-mono tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Background caching: {totalLoadedCount}/{totalFrames}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasSequence;
