'use client';

import React, { useEffect, useState, useRef } from 'react';
import Lenis from 'lenis';
import Image from 'next/image';
import CanvasSequence from '@/components/CanvasSequence';

export default function Home() {
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [currentFrameNum, setCurrentFrameNum] = useState<number>(1);
  const [isInSequence, setIsInSequence] = useState<boolean>(true);

  const totalFrames = 960;
  const initialFramesToLoad = 150;
  const lenisRef = useRef<Lenis | null>(null);
  const sequenceContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Initialize balanced smooth scrolling with Lenis
    const lenis = new Lenis({
      duration: 1.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 0.65,
      touchMultiplier: 1.0,
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    const onScroll = () => {
      const container = sequenceContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const totalScrollable = container.offsetHeight - window.innerHeight;
      const currentScroll = -rect.top;

      if (totalScrollable > 0) {
        const p = Math.max(0, Math.min(1, currentScroll / totalScrollable));
        setScrollProgress(p);
        const f = Math.max(1, Math.min(totalFrames, Math.round(p * (totalFrames - 1)) + 1));
        setCurrentFrameNum(f);
        setIsInSequence(currentScroll < totalScrollable + 80);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    let rafId: number;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [totalFrames]);

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frame = parseInt(e.target.value, 10);
    const progress = (frame - 1) / (totalFrames - 1);
    setCurrentFrameNum(frame);
    setScrollProgress(progress);

    const container = sequenceContainerRef.current;
    if (lenisRef.current && container) {
      const totalScrollable = container.offsetHeight - window.innerHeight;
      lenisRef.current.scrollTo(progress * totalScrollable, { immediate: true });
    }
  };

  return (
    <div className="relative min-h-screen bg-[#070707] text-white selection:bg-amber-400 selection:text-black">
      {/* Cinematic Top Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-6 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
          <span className="text-xs font-mono tracking-[0.25em] uppercase text-white/90 font-semibold">
            Villa Horizon
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-8 text-[11px] font-mono tracking-widest uppercase text-white/70 pointer-events-auto">
          <span className="hover:text-amber-400 transition-colors cursor-pointer">Architecture</span>
          <span className="hover:text-amber-400 transition-colors cursor-pointer">Amenities</span>
          <span className="hover:text-amber-400 transition-colors cursor-pointer">Vision</span>
          <span className="text-amber-400 hover:text-white transition-colors cursor-pointer">Enquire</span>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 1. PINNED 3D CANVAS SEQUENCE SECTION */}
      {/* ========================================================================= */}
      <div ref={sequenceContainerRef} className="relative h-[900vh]">
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          {/* HTML5 Canvas Component */}
          <CanvasSequence
            totalFrames={totalFrames}
            initialFramesToLoad={initialFramesToLoad}
            progress={scrollProgress}
            fit="cover"
          />

          {/* Floating Narrative Overlays Driven by Sequence Progress (5 Slides) */}
          <div className="absolute inset-0 z-20 pointer-events-none">
            {/* Slide 1: The Sanctuary (0.00 - 0.18) */}
            <div
              className={`absolute inset-0 flex flex-col justify-start pt-28 md:pt-36 px-8 md:px-20 max-w-4xl transition-all duration-700 ease-out ${
                scrollProgress <= 0.18
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 -translate-y-8 pointer-events-none'
              }`}
            >
              <div className="space-y-4">
                <span className="inline-block text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400/90 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 backdrop-blur-sm">
                  01 / The Sanctuary
                </span>
                <h1 className="text-4xl md:text-7xl font-normal tracking-tight text-white leading-tight">
                  Monolithic Elegance, <br />
                  <span className="font-serif italic text-neutral-300">Carved in Light.</span>
                </h1>
                <p className="max-w-md text-sm md:text-base font-light text-neutral-300 leading-relaxed pt-2">
                  Scroll downward to tour through the continuous volumetric spaces, panoramic glazed apertures, and private terraces.
                </p>
              </div>
            </div>

            {/* Slide 2: Spatial Harmony (0.22 - 0.38) */}
            <div
              className={`absolute inset-0 flex flex-col justify-center items-end px-8 md:px-20 text-right transition-all duration-700 ease-out ${
                scrollProgress > 0.22 && scrollProgress <= 0.38
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8 pointer-events-none'
              }`}
            >
              <div className="max-w-md space-y-3">
                <span className="inline-block text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400/90 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 backdrop-blur-sm">
                  02 / Spatial Harmony
                </span>
                <h2 className="text-3xl md:text-5xl font-normal text-white leading-tight">
                  Indoor & Outdoor <br />
                  <span className="font-serif italic text-neutral-300">Dissolved Borders</span>
                </h2>
                <p className="text-sm font-light text-neutral-400 leading-relaxed">
                  Floor-to-ceiling glass envelopes allow the sun-drenched courtyard and reflective water pools to integrate seamlessly with interior living.
                </p>
              </div>
            </div>

            {/* Slide 3: Geometric Precision (0.42 - 0.58) */}
            <div
              className={`absolute inset-0 flex flex-col justify-center px-8 md:px-20 max-w-xl transition-all duration-700 ease-out ${
                scrollProgress > 0.42 && scrollProgress <= 0.58
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8 pointer-events-none'
              }`}
            >
              <div className="space-y-3">
                <span className="inline-block text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400/90 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 backdrop-blur-sm">
                  03 / Structural Defiance
                </span>
                <h2 className="text-3xl md:text-5xl font-normal text-white leading-tight">
                  Cantilevered Volumes, <br />
                  <span className="font-serif italic text-neutral-300">Suspended in Air</span>
                </h2>
                <p className="text-sm font-light text-neutral-400 leading-relaxed">
                  Sculptural overhanging concrete eaves create bold shade geometries while framing vertical perspectives through double-height atriums.
                </p>
              </div>
            </div>

            {/* Slide 4: Material Purity (0.62 - 0.78) */}
            <div
              className={`absolute inset-0 flex flex-col justify-center items-end px-8 md:px-20 text-right transition-all duration-700 ease-out ${
                scrollProgress > 0.62 && scrollProgress <= 0.78
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8 pointer-events-none'
              }`}
            >
              <div className="max-w-md space-y-3">
                <span className="inline-block text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400/90 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 backdrop-blur-sm">
                  04 / Material Purity
                </span>
                <h2 className="text-3xl md:text-5xl font-normal text-white leading-tight">
                  Travertine & Bronze, <br />
                  <span className="font-serif italic text-neutral-300">A Timeless Touch</span>
                </h2>
                <p className="text-sm font-light text-neutral-400 leading-relaxed">
                  Hand-quarried limestone and fluted teak accents establish an organic tactile warmth across every corridor and open terrace.
                </p>
              </div>
            </div>

            {/* Slide 5: The Horizon (0.82 - 1.00) */}
            <div
              className={`absolute inset-0 flex flex-col justify-center px-8 md:px-20 max-w-xl transition-all duration-700 ease-out ${
                scrollProgress > 0.82
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8 pointer-events-none'
              }`}
            >
              <div className="space-y-3">
                <span className="inline-block text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400/90 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 backdrop-blur-sm">
                  05 / The Horizon
                </span>
                <h2 className="text-3xl md:text-5xl font-normal text-white leading-tight">
                  Panoramic <br />
                  <span className="font-serif italic text-neutral-300">Twilight View</span>
                </h2>
                <p className="text-sm font-light text-neutral-400 leading-relaxed">
                  Ascend to the cantilevered upper pavilion as dusk settles over the estate, revealing sweeping 360-degree vistas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sequence Scrubber HUD Bar (Fades out when leaving sequence) */}
      <footer
        className={`fixed bottom-0 left-0 right-0 z-40 px-6 md:px-12 py-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent backdrop-blur-[2px] transition-all duration-500 ease-out ${
          isInSequence ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-6'
        }`}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[11px] font-mono text-neutral-400 tracking-wider">
            <span className="text-amber-400">FRAME</span>
            <span className="text-white font-medium tabular-nums">
              {String(currentFrameNum).padStart(4, '0')}
            </span>
            <span className="text-neutral-600">/</span>
            <span className="text-neutral-500">{totalFrames}</span>
          </div>

          <div className="w-full md:max-w-md flex items-center gap-3">
            <span className="text-[10px] font-mono text-neutral-500">01</span>
            <input
              type="range"
              min={1}
              max={totalFrames}
              value={currentFrameNum}
              onChange={handleScrubberChange}
              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:bg-neutral-700 transition-colors"
            />
            <span className="text-[10px] font-mono text-neutral-500">{totalFrames}</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-neutral-400 tracking-widest uppercase">
            <span className="animate-bounce">↓</span>
            <span>Scroll To Continue</span>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 2. SECTION 01: ARCHITECTURAL VISION (From Screenshot 1) */}
      {/* ========================================================================= */}
      <section className="relative z-30 bg-[#070707] py-32 px-6 md:px-16 lg:px-24 border-t border-neutral-900">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Heading, Bio & Key Metrics */}
          <div className="lg:col-span-6 space-y-8">
            <div className="space-y-4">
              <span className="text-[11px] font-mono tracking-[0.25em] uppercase text-amber-400 font-semibold block">
                01 / ARCHITECTURAL VISION
              </span>
              <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl text-white font-normal leading-[1.12]">
                Framing Nature <br />
                Through Floor-to-Ceiling Glass
              </h2>
            </div>

            <p className="text-neutral-400 text-sm md:text-base font-light leading-relaxed max-w-lg">
              Designed by world-renowned architects, Villa Horizon integrates sustainable cantilevered structures with seamless panoramic glass facades, merging indoor elegance with raw outdoor majesty.
            </p>

            {/* Metrics Row */}
            <div className="pt-6 grid grid-cols-2 gap-8 border-t border-white/[0.08] max-w-md">
              <div>
                <span className="text-3xl md:text-4xl font-bold font-mono tracking-tight text-amber-400 block mb-1">
                  12,500 sq ft
                </span>
                <span className="text-[11px] font-mono tracking-[0.2em] text-neutral-500 uppercase">
                  LIVING AREA
                </span>
              </div>
              <div>
                <span className="text-3xl md:text-4xl font-bold font-mono tracking-tight text-amber-400 block mb-1">
                  360°
                </span>
                <span className="text-[11px] font-mono tracking-[0.2em] text-neutral-500 uppercase">
                  PANORAMIC SKYLINE
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Featured Minimalist Card */}
          <div className="lg:col-span-6">
            <div className="rounded-3xl bg-[#0e0e0e] border border-white/[0.08] p-4 sm:p-6 flex flex-col gap-6 shadow-2xl overflow-hidden hover:border-amber-400/30 transition-all duration-300">
              <div className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-neutral-900">
                <Image
                  src="/images/living-room.jpg"
                  alt="Minimalist Perfection Living Room"
                  fill
                  className="object-cover transition-transform duration-700 hover:scale-105"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>

              <div className="space-y-3 px-2 pb-2">
                <div className="w-8 h-8 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 text-xs">
                  ✦
                </div>
                <h3 className="font-serif text-2xl md:text-3xl font-medium text-amber-50">
                  Minimalist Perfection
                </h3>
                <p className="text-neutral-400 text-xs sm:text-sm font-light leading-relaxed">
                  Natural travertine stone finishes, hand-burnished brass accents, and smart ambient lighting zones craft an ambiance of serene sophistication.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. SECTION 02: BESPOKE FEATURES / UNRIVALED ESTATE AMENITIES (From Screenshot 2) */}
      {/* ========================================================================= */}
      <section className="relative z-30 bg-[#070707] py-32 px-6 md:px-12 lg:px-20 border-t border-neutral-900">
        <div className="max-w-7xl mx-auto">
          {/* Section Heading */}
          <div className="text-center space-y-4 mb-20">
            <span className="text-[11px] font-mono tracking-[0.3em] uppercase text-amber-400 font-semibold block">
              BESPOKE FEATURES
            </span>
            <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl text-white font-normal">
              Unrivaled Estate Amenities
            </h2>
          </div>

          {/* 3-Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Amenity Card 1: Infinity Edge Pool */}
            <div className="rounded-3xl bg-[#0e0e0e] border border-white/[0.08] p-4 pb-8 flex flex-col gap-6 shadow-xl hover:border-amber-400/30 transition-all duration-300 group">
              <div className="relative rounded-2xl overflow-hidden aspect-[16/11] bg-neutral-900">
                <Image
                  src="/images/infinity-pool.jpg"
                  alt="Infinity Edge Pool"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-white font-mono text-xs">
                  01
                </div>
              </div>

              <div className="px-2 space-y-2">
                <h3 className="font-serif text-2xl font-normal text-white group-hover:text-amber-200 transition-colors">
                  Infinity Edge Pool
                </h3>
                <p className="text-neutral-400 text-xs sm:text-sm font-light leading-relaxed">
                  Temperature-controlled heated pool seamlessly blurring the horizon line with automated cover system.
                </p>
              </div>
            </div>

            {/* Amenity Card 2: Private Wellness Spa (Highlighted with Amber accent border) */}
            <div className="rounded-3xl bg-[#0e0e0e] border border-amber-400/40 p-4 pb-8 flex flex-col gap-6 shadow-[0_0_35px_rgba(251,191,36,0.08)] transition-all duration-300 group">
              <div className="relative rounded-2xl overflow-hidden aspect-[16/11] bg-neutral-900">
                <Image
                  src="/images/wellness-spa.jpg"
                  alt="Private Wellness Spa"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-400/40 text-amber-300 font-mono text-xs">
                  02
                </div>
              </div>

              <div className="px-2 space-y-2">
                <h3 className="font-serif text-2xl font-normal text-amber-300">
                  Private Wellness Spa
                </h3>
                <p className="text-neutral-400 text-xs sm:text-sm font-light leading-relaxed">
                  Finnish cedar sauna, marble steam room, cold plunge pool, and dedicated therapy suite.
                </p>
              </div>
            </div>

            {/* Amenity Card 3: Sommelier Cellar */}
            <div className="rounded-3xl bg-[#0e0e0e] border border-white/[0.08] p-4 pb-8 flex flex-col gap-6 shadow-xl hover:border-amber-400/30 transition-all duration-300 group">
              <div className="relative rounded-2xl overflow-hidden aspect-[16/11] bg-neutral-900">
                <Image
                  src="/images/wine-cellar.jpg"
                  alt="Sommelier Cellar"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-white font-mono text-xs">
                  03
                </div>
              </div>

              <div className="px-2 space-y-2">
                <h3 className="font-serif text-2xl font-normal text-white group-hover:text-amber-200 transition-colors">
                  Sommelier Cellar
                </h3>
                <p className="text-neutral-400 text-xs sm:text-sm font-light leading-relaxed">
                  Climate-controlled glass wine vault accommodating up to 2,000 rare vintage bottles.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SECTION 03: PRIVATE ENQUIRIES / SCHEDULE YOUR PRIVATE TOUR (From Screenshot 3) */}
      {/* ========================================================================= */}
      <section className="relative z-30 bg-[#070707] py-36 px-6 text-center border-t border-neutral-900">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-8">
          {/* Badge with Circular Target Glow */}
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full border border-amber-400/40 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
            </div>
            <span className="text-xs font-mono tracking-[0.25em] uppercase text-amber-400 font-semibold">
              PRIVATE ENQUIRIES
            </span>
          </div>

          {/* Heading */}
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl text-white font-normal leading-tight">
            Schedule Your Private Tour
          </h2>

          {/* Subtitle */}
          <p className="text-neutral-400 text-sm md:text-base font-light max-w-lg">
            Experience Villa Horizon in person. Contact our exclusive real estate advisors.
          </p>

          {/* Glowing CTA Button */}
          <div className="pt-4">
            <button className="px-10 py-4 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs tracking-widest uppercase transition-all duration-300 shadow-[0_0_35px_rgba(251,191,36,0.35)] hover:shadow-[0_0_45px_rgba(251,191,36,0.55)] cursor-pointer">
              CONTACT SALES GALLERY
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-30 bg-[#050505] border-t border-white/[0.06] py-12 px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-neutral-500">
        <div className="flex items-center gap-2">
          <span className="text-amber-400">✦</span>
          <span>VILLA HORIZON — ARCHITECTURAL RESIDENCE</span>
        </div>
        <div>© 2026 ALL RIGHTS RESERVED</div>
      </footer>
    </div>
  );
}
