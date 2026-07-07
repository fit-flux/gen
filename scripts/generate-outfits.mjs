#!/usr/bin/env node
/**
 * 全コーディネートパターンの画像を Gemini API で生成するスクリプト。
 *
 * 使い方:
 *   npm run generate
 *   npm run generate -- --limit 1
 *   npm run generate -- --force
 *   npm run generate:women
 *   npm run generate:women -- --limit 1
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
  getFileNameForGender,
  buildPromptForGender,
} from './outfit-config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

/** @typedef {import('./outfit-config.mjs').Gender} Gender */

// Gemini から取得した正方形画像を縦長 9:16 にクロップ・リサイズする際の目標サイズ
const TARGET_WIDTH = 576;
const TARGET_HEIGHT = 1024;

/**
 * @typedef {object} CliArgs
 * @property {number} limit
 * @property {boolean} force
 * @property {number} variations
 * @property {boolean} women
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
    women: args.includes('--women'),
  };
}

/**
 * @param {CliArgs} args
 * @returns {Gender}
 */
function getGenderFromArgs(args) {
  return args.women ? 'women' : 'men';
}

/**
 * @param {Gender} gender
 */
function getOutputDir(gender) {
  return path.join(PROJECT_ROOT, 'generated', gender === 'women' ? 'women' : '');
}

/**
 * @param {Gender} gender
 */
function getManifestPath(gender) {
  return path.join(getOutputDir(gender), 'manifest.json');
}

/**
 * @param {Gender} gender
 */
function getFailedPath(gender) {
  return path.join(getOutputDir(gender), 'failed.json');
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

/**
 * @param {Gender} gender
 */
async function ensureOutputDir(gender) {
  await fs.mkdir(getOutputDir(gender), { recursive: true });
}

/**
 * @param {Gender} gender
 */
async function loadManifest(gender) {
  const manifestPath = getManifestPath(gender);
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { version: 1, images: /** @type {Record<string, ManifestImage>} */ ({}) };
  }
}

/**
 * @param {Gender} gender
 * @param {Manifest} manifest
 */
async function saveManifest(gender, manifest) {
  await fs.writeFile(getManifestPath(gender), JSON.stringify(manifest, null, 2));
}

/**
 * @param {Gender} gender
 */
async function loadFailed(gender) {
  const failedPath = getFailedPath(gender);
  try {
    const raw = await fs.readFile(failedPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return /** @type {FailedEntry[]} */ ([]);
  }
}

/**
 * @param {Gender} gender
 * @param {FailedEntry[]} failed
 */
async function saveFailed(gender, failed) {
  await fs.writeFile(getFailedPath(gender), JSON.stringify(failed, null, 2));
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
 * @param {Gender} gender
 * @param {{ manifest: Manifest; failed: FailedEntry[]; force: boolean; variations: number }} ctx
 */
async function processCombination(combination, gender, { manifest, failed, force, variations }) {
  const { topsColor, pantsColor } = combination;
  const outputDir = getOutputDir(gender);
  const baseFileName = getFileNameForGender(gender, topsColor, pantsColor);
  const basePrompt = buildPromptForGender(gender, topsColor, pantsColor);
  const results = [];

  for (let i = 1; i <= variations; i++) {
    const fileName = variations > 1 ? `${topsColor}-${pantsColor}-v${i}.webp` : path.basename(baseFileName);
    const outputPath = path.join(outputDir, fileName);
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

      const relativePath = gender === 'women' ? `/generated/women/${fileName}` : `/generated/${fileName}`;
      manifest.images[fileName] = {
        topsColor,
        pantsColor,
        prompt,
        path: relativePath,
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
  const args = parseArgs();
  const gender = getGenderFromArgs(args);
  const { limit, force, variations } = args;
  await loadEnv();

  await ensureOutputDir(gender);

  const manifest = await loadManifest(gender);
  const failed = await loadFailed(gender);
  const combinations = getAllCombinations(gender);
  const targetCombinations = limit > 0 ? combinations.slice(0, limit) : combinations;

  console.log(`生成対象: ${targetCombinations.length} 組 × ${variations} バリエーション (${gender})`);

  const throttle = pLimit(2);
  const nestedResults = await Promise.all(
    targetCombinations.map((combination) =>
      throttle(() => processCombination(combination, gender, { manifest, failed, force, variations }))
    )
  );

  const results = nestedResults.flat();
  const generated = results.filter((r) => r.status === 'generated').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;

  await saveManifest(gender, manifest);
  await saveFailed(gender, failed);

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
