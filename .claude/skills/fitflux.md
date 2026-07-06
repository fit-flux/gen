---
name: fitflux
description: FitFlux プロジェクトの技術スタック、構成、および作業上の注意
version: 1.0.0
---

# FitFlux プロジェクトスキル

## 概要

FitFlux は、ユーザーが選択した帽子・アイウェア・アウター・トップス・パンツ・靴と色から、AI が着用した全身写真を生成するスマホ向け Web サービスです。

## 技術スタック

| レイヤー | 技術 |
| --- | --- |
| フロントエンド | HTML / Tailwind CSS / Vanilla JavaScript |
| バックエンド API | Cloudflare Pages Functions (`functions/api/generate.ts`) |
| 画像生成 API | Pollinations (`gen.pollinations.ai`) |
| ホスティング | Cloudflare Pages |
| 言語 | TypeScript |

## 主要ファイル

- `index.html` — フロントエンド UI（モバイルファースト）
- `functions/api/generate.ts` — `/api/generate` エンドポイント
- `spec.md` — サービス仕様書
- `architecture.md` — システム構成ドキュメント
- `wrangler.toml` — Cloudflare Wrangler 設定
- `tsconfig.json` — TypeScript 設定（`functions/**/*.ts` のみ対象）
- `package.json` — スクリプト: `npm run dev`, `npm run check`, `npm run deploy`

## 作業上の注意

1. **無料枠優先**: 本プロジェクトは開発者・エンドユーザーも無料で利用できることを最優先します。有料サービスや有料モデルの導入は避けてください。
2. **API Key の秘匿**: `POLLINATIONS_API_KEY` は `.dev.vars`（ローカル）または Wrangler Secret（本番）で管理し、フロントエンドやコミットに含めないでください。キーがなくても FLUX 画像生成は無料で動作します。
3. **プロンプトの一貫性**: 画像生成プロンプトは `buildPrompt()` 関数で構築します。`full body shot`、`head-to-toe`、`standing straight` 等のキーワードは維持してください。
4. **縦長画像**: 出力サイズは `768×1344`（9:16）を標準とします。
5. **色の許可リスト**: `white`, `gray`, `black`, `red`, `brown`, `yellow`, `green`, `blue`, `purple` のみを有効とします（`ALLOWED_COLORS`）。
6. **最小変更**: バグ修正や機能追加は、目的を達成する最小の範囲にとどめてください。
7. **型チェック**: 変更後は必ず `npm run check` を実行してください。

## ローカル開発

```bash
npm install
cp .dev.vars.example .dev.vars
# .dev.vars に POLLINATIONS_API_KEY を記入（オプション）
npm run dev
```

## 本番デプロイ

```bash
npm run deploy
```

本番では `wrangler pages secret put POLLINATIONS_API_KEY` でシークレットを設定してください（必須ではありませんが推奨）。
