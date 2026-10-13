'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface CanvasSequenceProps {
  /** Total number of frames in the sequence (default: 960) */
  totalFrames?: number;
  /** Initial frames to preload before hiding preloader (default: 150) */
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

export const CanvasSequence: React.FC<CanvasSequenceProps> = ({
  totalFrames = 960,
  initialFramesToLoad = 150,
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

  // Cache for loaded HTMLImageElements (keyed by 1-based index)
  const imageCacheRef = useRef<Map<number, HTMLImageElement>>(new Map());
  // Set of frames currently being loaded or requested
  const loadingQueueRef = useRef<Set<number>>(new Set());

  // State for initial preloader
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

  // Canvas drawing routine
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
    if (!img) {
      // Find nearest loaded frame so canvas never flickers blank
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

    // Image fit calculation (cover or contain)
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

      // Re-render immediately on resize
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

  // Core frame loader
  const loadSingleFrame = useCallback((index: number): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const existing = imageCacheRef.current.get(index);
      if (existing && existing.complete && existing.naturalWidth > 0) {
        resolve(existing);
        return;
      }

      const img = new Image();
      img.decoding = 'async';

      img.onload = () => {
        imageCacheRef.current.set(index, img);
        loadingQueueRef.current.delete(index);
        resolve(img);
      };

      img.onerror = () => {
        loadingQueueRef.current.delete(index);
        reject(new Error(`Failed to load frame ${index}`));
      };

      loadingQueueRef.current.add(index);
      img.src = getFramePath(index);
    });
  }, [getFramePath]);

  // Initial Preloading & Background Loading Orchestrator
  useEffect(() => {
    let isCancelled = false;
    const initialTarget = Math.min(initialFramesToLoad, totalFrames);
    let initialCount = 0;
    let totalCount = 0;

    // Concurrency pool helper
    const runWorkerPool = async (
      indices: number[],
      concurrency: number,
      onFrameLoaded: (index: number) => void,
      isBackground: boolean = false
    ) => {
      let currentIndex = 0;

      const worker = async () => {
        while (currentIndex < indices.length) {
          if (isCancelled) return;
          const frameIdx = indices[currentIndex++];

          try {
            await loadSingleFrame(frameIdx);
            if (isCancelled) return;
            onFrameLoaded(frameIdx);

            // If background task, add slight micro-yield to keep UI ultra responsive
            if (isBackground && currentIndex % 4 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 8));
            }
          } catch {
            // Soft ignore frame error; will fallback to adjacent frames
          }
        }
      };

      const workers = Array.from({ length: Math.min(concurrency, indices.length) }, () => worker());
      await Promise.all(workers);
    };

    // Phase 1: Preload initial 150 frames with 6 parallel streams
    const initialIndices: number[] = [];
    for (let i = 1; i <= initialTarget; i++) {
      initialIndices.push(i);
    }

    const startLoadingPipeline = async () => {
      await runWorkerPool(initialIndices, 6, (idx) => {
        initialCount++;
        totalCount++;
        setInitialLoadedCount(initialCount);
        setTotalLoadedCount(totalCount);
        onProgressUpdate?.(initialCount, totalCount);

        // Once frame 1 loads, render it right away
        if (idx === 1 || renderedFrameRef.current === -1) {
          queueRender(1);
        }
      });

      if (isCancelled) return;

      // Initial preloader threshold reached!
      setIsInitialReady(true);
      onInitialLoadComplete?.();
      queueRender(getTargetFrame());

      // Preloader fade transition timeout (700ms)
      setTimeout(() => {
        if (!isCancelled) {
          setIsPreloaderHidden(true);
        }
      }, 750);

      // Phase 2: Background preload remaining frames (e.g. 151 to 960) without blocking UI
      if (initialTarget < totalFrames) {
        const remainingIndices: number[] = [];
        for (let i = initialTarget + 1; i <= totalFrames; i++) {
          remainingIndices.push(i);
        }

        // Run background worker pool with low concurrency (4)
        runWorkerPool(
          remainingIndices,
          4,
          () => {
            totalCount++;
            setTotalLoadedCount(totalCount);
            onProgressUpdate?.(initialCount, totalCount);
          },
          true
        );
      }
    };

    startLoadingPipeline();

    return () => {
      isCancelled = true;
    };
  }, [initialFramesToLoad, totalFrames, loadSingleFrame, onInitialLoadComplete, onProgressUpdate, queueRender, getTargetFrame]);

  // Priority On-Demand Frame Loader: if user jumps to an unloaded frame, prioritize it
  useEffect(() => {
    const target = getTargetFrame();
    if (!imageCacheRef.current.has(target) && !loadingQueueRef.current.has(target)) {
      // Prioritize target frame and immediate neighbors
      loadSingleFrame(target)
        .then(() => {
          queueRender(target);
        })
        .catch(() => {});
      
      // Also pre-fetch adjacent frames in direction of scrub
      const next1 = Math.min(totalFrames, target + 1);
      const prev1 = Math.max(1, target - 1);
      if (!imageCacheRef.current.has(next1)) loadSingleFrame(next1).catch(() => {});
      if (!imageCacheRef.current.has(prev1)) loadSingleFrame(prev1).catch(() => {});
    }

    queueRender(target);
  }, [currentFrame, progress, getTargetFrame, queueRender, loadSingleFrame, totalFrames]);

  // Loading percentage calculation (0% to 100% of initial frames)
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
          className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#070707] text-white transition-all duration-700 ease-out ${
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
