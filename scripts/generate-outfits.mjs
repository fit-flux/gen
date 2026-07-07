#!/usr/bin/env node
/**
 * 全コーディネートパターンの画像を Gemini API で生成するスクリプト。
 *
 * 使い方:
 *   npm run generate
 *   npm run generate -- --limit 1
 *   npm run generate -- --force
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import pLimit from 'p-limit';
import sharp from 'sharp';
import {
  getAllCombinations,
  getFileName,
  buildPrompt,
} from './outfit-config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'generated');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const FAILED_PATH = path.join(OUTPUT_DIR, 'failed.json');

// Gemini から取得した正方形画像を縦長 9:16 にクロップ・リサイズする際の目標サイズ
const TARGET_WIDTH = 576;
const TARGET_HEIGHT = 1024;

/**
 * @typedef {object} CliArgs
 * @property {number} limit
 * @property {boolean} force
 * @property {number} variations
 */

/**
 * @typedef {object} Combination
 * @property {string} topsColor
 * @property {string} pantsColor
 */

/**
 * @typedef {object} ManifestImage
 * @property {string} topsColor
 * @property {string} pantsColor
 * @property {string} prompt
 * @property {string} path
 * @property {string} updatedAt
 */

/**
 * @typedef {object} Manifest
 * @property {number} version
 * @property {Record<string, ManifestImage>} images
 */

/**
 * @typedef {object} FailedEntry
 * @property {string} fileName
 * @property {string} topsColor
 * @property {string} pantsColor
 * @property {string} prompt
 * @property {string} error
 * @property {string} failedAt
 */

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    limit: Number(args.find((/** @type {string} */ _, /** @type {number} */ i) => args[i - 1] === '--limit')) || 0,
    force: args.includes('--force'),
    variations: Number(args.find((/** @type {string} */ _, /** @type {number} */ i) => args[i - 1] === '--variations')) || 1,
  };
}

async function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  const devVarsPath = path.join(PROJECT_ROOT, '.dev.vars');

  const envExists = await fs.access(envPath).then(() => true).catch(() => false);
  if (envExists) {
    config({ path: envPath });
  }

  const devVarsExists = await fs.access(devVarsPath).then(() => true).catch(() => false);
  if (devVarsExists) {
    config({ path: devVarsPath });
  }
}

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function loadManifest() {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { version: 1, images: /** @type {Record<string, ManifestImage>} */ ({}) };
  }
}

/**
 * @param {Manifest} manifest
 */
async function saveManifest(manifest) {
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function loadFailed() {
  try {
    const raw = await fs.readFile(FAILED_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return /** @type {FailedEntry[]} */ ([]);
  }
}

/**
 * @param {FailedEntry[]} failed
 */
async function saveFailed(failed) {
  await fs.writeFile(FAILED_PATH, JSON.stringify(failed, null, 2));
}

/**
 * Gemini API から画像を生成する。
 * @param {string} prompt
 * @returns {Promise<Buffer>}
 */
async function generateImage(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY が設定されていません。');
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: prompt,
    config: {
      responseModalities: ['image'],
    },
  });

  const candidate = response?.candidates?.[0];
  if (!candidate) {
    throw new Error('Gemini から画像が返されませんでした。');
  }

  const imagePart = candidate.content?.parts?.find((part) => part.inlineData);
  if (!imagePart?.inlineData?.data) {
    throw new Error('Gemini のレスポンスに画像データが含まれていません。');
  }

  return Buffer.from(imagePart.inlineData.data, 'base64');
}

/**
 * 正方形に近い画像を 9:16 に中心クロップし、WebP で保存する。
 * @param {Buffer} inputBuffer
 * @param {string} outputPath
 */
async function cropAndSave(inputBuffer, outputPath) {
  await sharp(inputBuffer)
    .resize({
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      fit: 'cover',
      position: 'centre',
    })
    .webp({ quality: 85 })
    .toFile(outputPath);
}

/**
 * @param {Combination} combination
 * @param {{ manifest: Manifest; failed: FailedEntry[]; force: boolean; variations: number }} ctx
 */
async function processCombination(combination, { manifest, failed, force, variations }) {
  const { topsColor, pantsColor } = combination;
  const baseFileName = getFileName(topsColor, pantsColor);
  const basePrompt = buildPrompt(topsColor, pantsColor);
  const results = [];

  for (let i = 1; i <= variations; i++) {
    const fileName = variations > 1 ? `${topsColor}-${pantsColor}-v${i}.webp` : baseFileName;
    const outputPath = path.join(OUTPUT_DIR, fileName);
    const prompt = variations > 1 ? `${basePrompt} (variation ${i})` : basePrompt;

    if (!force) {
      try {
        await fs.access(outputPath);
        console.log(`skip ${fileName}`);
        results.push({ status: 'skipped', fileName });
        continue;
      } catch {
        // ファイルが存在しないので続行
      }
    }

    try {
      console.log(`generate ${fileName}: ${prompt}`);
      const imageBuffer = await generateImage(prompt);
      await cropAndSave(imageBuffer, outputPath);

      manifest.images[fileName] = {
        topsColor,
        pantsColor,
        prompt,
        path: `/generated/${fileName}`,
        updatedAt: new Date().toISOString(),
      };

      console.log(`done ${fileName}`);
      results.push({ status: 'generated', fileName });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`failed ${fileName}: ${message}`);
      failed.push({
        fileName,
        topsColor,
        pantsColor,
        prompt,
        error: message,
        failedAt: new Date().toISOString(),
      });
      results.push({ status: 'failed', fileName, error: message });
    }
  }

  return results;
}

async function main() {
  const { limit, force, variations } = parseArgs();
  await loadEnv();

  await ensureOutputDir();

  const manifest = await loadManifest();
  const failed = await loadFailed();
  const combinations = getAllCombinations();
  const targetCombinations = limit > 0 ? combinations.slice(0, limit) : combinations;

  console.log(`生成対象: ${targetCombinations.length} 組 × ${variations} バリエーション`);

  const throttle = pLimit(2);
  const nestedResults = await Promise.all(
    targetCombinations.map((combination) =>
      throttle(() => processCombination(combination, { manifest, failed, force, variations }))
    )
  );

  const results = nestedResults.flat();
  const generated = results.filter((r) => r.status === 'generated').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;

  await saveManifest(manifest);
  await saveFailed(failed);

  console.log('');
  console.log(`生成: ${generated} 枚`);
  console.log(`スキップ: ${skipped} 枚`);
  console.log(`失敗: ${failedCount} 枚`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
