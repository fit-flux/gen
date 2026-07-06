import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  HUGGINGFACE_TOKEN: string;
  HF_MODEL?: string;
  HF_TIMEOUT_MS?: string;
}

interface GenerateRequest {
  hat?: string;
  hat_color?: string;
  eyewear?: string;
  eyewear_color?: string;
  outer?: string;
  outer_color?: string;
  tops: string;
  tops_color: string;
  pants: string;
  pants_color: string;
  shoes: string;
  shoes_color: string;
}

const ALLOWED_COLORS = [
  'white',
  'gray',
  'black',
  'red',
  'brown',
  'yellow',
  'green',
  'blue',
  'purple',
];

const DEFAULT_MODEL = 'black-forest-labs/FLUX.1-schnell';
const DEFAULT_TIMEOUT_MS = 60_000;
const PORTRAIT_WIDTH = 768;
const PORTRAIT_HEIGHT = 1344;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(JSON.stringify(body), { ...init, headers });
}

function validateRequest(body: unknown): GenerateRequest | { error: string } {
  if (typeof body !== 'object' || body === null) {
    return { error: 'リクエストの形式が正しくありません。' };
  }

  const requiredFields = ['tops', 'tops_color', 'pants', 'pants_color', 'shoes', 'shoes_color'] as const;
  const optionalFields = ['hat', 'hat_color', 'eyewear', 'eyewear_color', 'outer', 'outer_color'] as const;

  const b = body as Record<string, unknown>;

  for (const field of requiredFields) {
    if (typeof b[field] !== 'string' || b[field].trim() === '') {
      return { error: `「${field}」の入力が正しくありません。` };
    }
  }

  for (const field of requiredFields) {
    if (field.endsWith('_color') && !ALLOWED_COLORS.includes(b[field] as string)) {
      return { error: `「${field}」は対応していない色です。` };
    }
  }

  for (const field of optionalFields) {
    if (field.endsWith('_color')) continue;
    const value = b[field];
    if (value === undefined || value === '') {
      b[field] = '';
      b[`${field}_color`] = '';
      continue;
    }
    if (typeof value !== 'string') {
      return { error: `「${field}」の入力が正しくありません。` };
    }
    const trimmed = value.trim();
    if (trimmed === '') {
      b[field] = '';
      b[`${field}_color`] = '';
      continue;
    }
    b[field] = trimmed;
    const colorField = `${field}_color`;
    const color = b[colorField];
    if (typeof color !== 'string' || !ALLOWED_COLORS.includes(color)) {
      return { error: `「${colorField}」は対応していない色です。` };
    }
  }

  return b as unknown as GenerateRequest;
}

function buildPrompt(body: GenerateRequest): string {
  const pieces: string[] = [];

  if (body.hat?.trim()) {
    pieces.push(`a ${body.hat_color} ${body.hat}`);
  }
  if (body.eyewear?.trim()) {
    pieces.push(`${body.eyewear_color} ${body.eyewear} on the face`);
  }
  if (body.outer?.trim()) {
    pieces.push(`a ${body.outer_color} ${body.outer}`);
  }

  // 必須アイテム
  pieces.push(`a ${body.tops_color} ${body.tops}`);
  pieces.push(`${body.pants_color} ${body.pants}`);
  pieces.push(`${body.shoes_color} ${body.shoes}`);

  const wearing = pieces.join(', ').replace(/, ([^,]+)$/, ', and $1');

  return (
    `A full-body fashion photo of a person standing straight with a neutral expression, ` +
    `shot from head to toe in a vertical portrait composition, ` +
    `wearing ${wearing}. ` +
    `Clean background, high detail, realistic lighting, full body shot. ` +
    `Do not crop the head, legs, or feet. No close-up, no upper-body only.`
  );
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onAbort);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onAbort);
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const token = env.HUGGINGFACE_TOKEN;
  if (!token) {
    console.error('HUGGINGFACE_TOKEN is not configured');
    return jsonResponse(
      { error: 'サーバーの準備ができていません。しばらくしてからお試しください。' },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'リクエストの形式が正しくありません。' }, { status: 400 });
  }

  const validated = validateRequest(body);
  if ('error' in validated) {
    return jsonResponse({ error: validated.error }, { status: 400 });
  }

  const prompt = buildPrompt(validated);
  const model = env.HF_MODEL || DEFAULT_MODEL;
  const timeoutMs = Number(env.HF_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const endpoint = `https://router.huggingface.co/hf-inference/models/${model}`;

  try {
    const upstreamRes = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            width: PORTRAIT_WIDTH,
            height: PORTRAIT_HEIGHT,
            num_inference_steps: 4,
          },
        }),
      },
      timeoutMs,
      request.signal,
    );

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text().catch(() => '');
      console.error('Hugging Face upstream error', {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        body: errorText.slice(0, 500),
        model,
      });

      if (upstreamRes.status === 429 || upstreamRes.status === 503) {
        let retryAfter = 60;
        try {
          const errBody = JSON.parse(errorText) as { estimated_time?: number };
          if (typeof errBody.estimated_time === 'number' && errBody.estimated_time > 0) {
            retryAfter = Math.ceil(errBody.estimated_time);
          }
        } catch {
          // ignore parse errors
        }
        return jsonResponse(
          { error: '画像生成サービスが混雑しています。しばらく経ってからお試しください。' },
          { status: 503, headers: { 'Retry-After': String(retryAfter) } },
        );
      }

      return jsonResponse(
        { error: '画像の生成に失敗しました。もう一度お試しください。' },
        { status: 502 },
      );
    }

    const imageBuffer = await upstreamRes.arrayBuffer();
    const bytes = new Uint8Array(imageBuffer);
    const base64 = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
    const contentType = upstreamRes.headers.get('content-type') || 'image/png';
    const dataUrl = `data:${contentType};base64,${btoa(base64)}`;

    return jsonResponse({ image_url: dataUrl, prompt });
  } catch (err: unknown) {
    const error = err as { name?: string; message?: string };
    console.error('Generate proxy error', { name: error?.name, message: error?.message, model });
    if (error?.name === 'AbortError') {
      return jsonResponse(
        { error: '画像生成が時間内に終わりませんでした。もう一度お試しください。' },
        { status: 504 },
      );
    }
    return jsonResponse(
      { error: '予期せぬエラーが発生しました。時間をおいてからお試しください。' },
      { status: 500 },
    );
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  if (context.request.method === 'OPTIONS') {
    return onRequestOptions(context);
  }
  return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 });
};
