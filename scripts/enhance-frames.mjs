#!/usr/bin/env node
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * High Performance Batch Frame Enhancer & Upscaler
 * 
 * Usage:
 *   node scripts/enhance-frames.mjs [options]
 * 
 * Options:
 *   --mode=sharpen    Keep original 720p, apply unsharp mask & clarity (default)
 *   --mode=upscale    Upscale to 1920x1080 (Lanczos3) + sharpen for crisp 1080p
 *   --format=jpg      Keep .jpg format (default)
 *   --format=webp     Convert to modern high-efficiency .webp
 *   --quality=90      JPEG/WebP output quality (default: 90)
 *   --overwrite       Directly overwrite public/frames/ (default saves to public/frames_enhanced/)
 *   --sample=5        Only process first N frames for quick preview
 */

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.replace(/^--/, '').split('=');
  acc[key] = val === undefined ? true : val;
  return acc;
}, {});

const MODE = args.mode || 'upscale'; // 'sharpen' or 'upscale'
const FORMAT = args.format || 'jpg'; // 'jpg' or 'webp'
const QUALITY = parseInt(args.quality || (FORMAT === 'webp' ? '88' : '90'), 10);
const OVERWRITE = Boolean(args.overwrite);
const SAMPLE = args.sample ? parseInt(args.sample, 10) : null;
const CONCURRENCY = 8; // Number of parallel worker threads

const INPUT_DIR = path.resolve('public/frames');
const OUTPUT_DIR = OVERWRITE ? INPUT_DIR : path.resolve('public/frames_enhanced');

async function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Input directory not found: ${INPUT_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let files = fs.readdirSync(INPUT_DIR)
    .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();

  if (SAMPLE) {
    files = files.slice(0, SAMPLE);
  }

  const total = files.length;
  console.log('='.repeat(60));
  console.log(`🖼️  FRAME SEQUENCE QUALITY ENHANCER`);
  console.log('='.repeat(60));
  console.log(`📁 Source:       ${INPUT_DIR}`);
  console.log(`📂 Destination:  ${OUTPUT_DIR}`);
  console.log(`⚙️  Mode:         ${MODE === 'upscale' ? '1080p Upscale + Sharpen (1920x1080)' : '720p Direct Sharpen & Clarity'}`);
  console.log(`🎯 Format:       ${FORMAT.toUpperCase()} (Quality: ${QUALITY}%)`);
  console.log(`🔢 Total frames: ${total}`);
  console.log(`⚡ Concurrency:  ${CONCURRENCY} parallel workers`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  let completed = 0;
  let fileIndex = 0;

  async function processFile(filename) {
    const srcPath = path.join(INPUT_DIR, filename);
    const outFilename = FORMAT === 'webp' 
      ? filename.replace(/\.(jpe?g|png)$/i, '.webp')
      : filename;
    const destPath = path.join(OUTPUT_DIR, outFilename);

    let pipeline = sharp(srcPath);

    if (MODE === 'upscale') {
      pipeline = pipeline.resize(1920, 1080, {
        kernel: sharp.kernel.lanczos3,
        fit: 'cover'
      }).sharpen({
        sigma: 1.0,
        m1: 1.4,
        m2: 0.6
      });
    } else {
      pipeline = pipeline.sharpen({
        sigma: 1.2,
        m1: 1.6,
        m2: 0.8
      });
    }

    if (FORMAT === 'webp') {
      pipeline = pipeline.webp({ quality: QUALITY, effort: 4 });
    } else {
      pipeline = pipeline.jpeg({ quality: QUALITY, mozjpeg: true });
    }

    // Save to temp file if overwriting same path to avoid lock collision
    if (srcPath === destPath) {
      const buffer = await pipeline.toBuffer();
      await fs.promises.writeFile(destPath, buffer);
    } else {
      await pipeline.toFile(destPath);
    }
  }

  async function worker() {
    while (fileIndex < files.length) {
      const current = files[fileIndex++];
      try {
        await processFile(current);
      } catch (err) {
        console.error(`\n❌ Error processing ${current}:`, err.message);
      }
      completed++;

      if (completed % 25 === 0 || completed === total) {
        const percent = ((completed / total) * 100).toFixed(1);
        const elapsedSec = (Date.now() - startTime) / 1000;
        const fps = (completed / elapsedSec).toFixed(1);
        const remainingSec = Math.round((total - completed) / (completed / elapsedSec));
        process.stdout.write(`\r⏳ Progress: [${completed}/${total}] ${percent}% | Speed: ${fps} frames/s | ETA: ${remainingSec}s  `);
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker());
  await Promise.all(workers);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n✅ Done! Processed ${completed} frames in ${totalTime}s.`);
  console.log(`📂 Enhanced frames saved to: ${OUTPUT_DIR}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
