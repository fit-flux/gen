---
name: fitflux
description: FitFlux プロジェクトの技術スタック、構成、および作業上の注意
version: 1.0.0
---

# FitFlux プロジェクトスキル

## 概要

FitFlux は、ユーザーが選んだトップスとパンツの色に合わせて、あらかじめ生成済みの AI 着用全身写真を即座に表示するスマホ向け Web サービスです。

## 技術スタック

| レイヤー | 技術 |
| --- | --- |
| フロントエンド | HTML / Tailwind CSS / Vanilla JavaScript |
| 画像素材 | `generated/` 内の WebP 画像（あらかじめ生成済み） |
| 画像生成 | Gemini (`gemini-2.5-flash-image`) |
| 生成スクリプト | Node.js + `@google/genai` + `sharp` (`scripts/generate-outfits.mjs`) |
| ホスティング | Cloudflare Pages（静的サイト） |
| 言語 | JavaScript（`scripts/**/*.mjs` を TypeScript で型チェック） |

## 主要ファイル

- `index.html` — フロントエンド UI（モバイルファースト）
- `scripts/outfit-config.mjs` — カテゴリー・色・プロンプト・ファイル名の単一情報源
- `scripts/generate-outfits.mjs` — 全 49 パターンの画像を Gemini で生成するスクリプト
- `generated/` — 生成済み画像、`manifest.json`、`failed.json`
- `architecture.md` — システム構成ドキュメント
- `README.md` — プロジェクト概要・開発手順
- `package.json` — スクリプト: `npm run dev`, `npm run check`, `npm run deploy`, `npm run generate`
- `wrangler.toml` — Cloudflare Pages 設定（`pages_build_output_dir = "."`）

## 作業上の注意

1. **バックエンドは存在しません**: フロントエンドは静的 HTML のみです。API エンドポイントを追加する場合は、別途要件を確認してください。
2. **単一情報源**: 衣装・色・プロンプトは `scripts/outfit-config.mjs` で一元管理します。フロントエンドも生成スクリプトも同じモジュールを import します。
3. **プロンプトの一貫性**: 生成プロンプトは `buildPrompt()` で構築します。`full body shot`、`head-to-toe`、`standing straight`、`do not crop the head or feet` 等のキーワードは維持してください。
4. **縦長画像**: 出力サイズは `576×1024`（9:16）です。Gemini から得た画像は `sharp` でクロップ・リサイズして WebP 化します。
5. **色の許可リスト**: `white`, `gray`, `beige`, `brown`, `black`, `blue`, `green` の 7 色のみを有効とします（`COLORS`）。
6. **全パターン数**: 7 色 × 7 色 = 49 通り。ファイル名は `{topsColor}-{pantsColor}.webp` です。
7. **最小変更**: バグ修正や機能追加は、目的を達成する最小の範囲にとどめてください。
8. **型チェック**: 変更後は必ず `npm run check` を実行してください。
9. **API Key の秘匿**: `GEMINI_API_KEY` は `.dev.vars`（ローカル）でのみ使用します。コードやログ、コミットに含めないでください。

## ローカル開発

```bash
npm install
cp .dev.vars.example .dev.vars
# .dev.vars に GEMINI_API_KEY を記入（画像生成時のみ必要）
npm run dev
```

## 画像の生成

```bash
# 全 49 パターンを生成
npm run generate

# 1 枚だけテスト生成
npm run generate -- --limit 1

# 既存画像を上書き
npm run generate -- --force
```

## 本番デプロイ

```bash
npm run deploy
```

Cloudflare Pages へ静的サイトとしてデプロイされます。本番では API Key 等のシークレットは不要です。
