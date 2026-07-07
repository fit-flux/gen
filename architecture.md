# FitFlux アーキテクチャ

## サービス概要

FitFlux は、ユーザーが選んだトップスとパンツの色に合わせて、AI が着用した全身写真を即座に表示するスマホ向け Web サービスです。

現在の実装は **静的 HTML のみ** で構成されており、実行時のバックエンド API はありません。すべてのコーディネート画像は `generated/` にあらかじめ生成済みです。

## システム構成図

```
[スマホブラウザ]
       │
       ▼
[Cloudflare Pages] ── 静的ファイル配信（index.html + generated/）
```

## レイヤー構成

| レイヤー | 責務 | 実装 |
| --- | --- | --- |
| フロントエンド | 入力フォーム、画像表示、ローディング UI | `index.html` |
| 画像素材 | あらかじめ生成した縦長全身写真の静的配信 | `generated/*.webp` |
| 画像生成 | Gemini API で全パターンを生成・加工 | `scripts/generate-outfits.mjs` |
| 設定・プロンプト | カテゴリー、色、プロンプト、ファイル名の単一情報源 | `scripts/outfit-config.mjs` |
| ホスティング | 静的ファイルの配信 | Cloudflare Pages |

## ファイル構成

```
.
├── index.html              # フロントエンド UI
├── scripts/
│   ├── outfit-config.mjs   # カテゴリー / 色 / プロンプト / ファイル名
│   └── generate-outfits.mjs # Gemini による画像生成スクリプト
├── generated/
│   ├── *.webp              # 生成済みコーディネート画像（49 枚）
│   ├── manifest.json       # 生成済み画像のメタデータ
│   └── failed.json         # 生成失敗したパターンの記録
├── wrangler.toml           # Cloudflare Pages 設定
├── package.json            # npm スクリプト
└── tsconfig.json           # scripts/**/*.mjs の型チェック
```

## 入力と画像の対応

フロントエンドでは以下の 2 カテゴリーの色を選択できます。

| カテゴリー | 項目 | 選択可能な色 |
| --- | --- | --- |
| トップス | T-shirt | white, gray, beige, brown, black, blue, green |
| パンツ | short chino pants | white, gray, beige, brown, black, blue, green |

組み合わせは 7 × 7 = **49 通り**。ファイル名は `{topsColor}-{pantsColor}.webp` です。

## プロンプト設計

基本テンプレートは `scripts/outfit-config.mjs` の `buildPrompt()` で構築します。

```text
A full-body photo of a young man standing straight, facing the camera,
shot from head to toe,
wearing a {topsColor} T-shirt and {pantsColor} short chino pants.
Summer outfit, clean light background, natural lighting, realistic.
Full body, head to toe, entire head and hair visible,
do not crop the head or feet, male model.
```

必須キーワードは維持します。

- `full body shot` / `head to toe` / `standing straight`
- `do not crop the head or feet`

## 画像生成フロー

`npm run generate` の実行時のみ動作します。

1. `scripts/outfit-config.mjs` から全 49 通りの組み合わせを取得
2. Gemini (`gemini-2.5-flash-image`) にプロンプトを送信
3. 返却された画像を `sharp` で 9:16（576×1024）にクロップ・リサイズ
4. `generated/{topsColor}-{pantsColor}.webp` として保存
5. `generated/manifest.json` / `generated/failed.json` を更新

本番環境ではこのスクリプトは実行されず、`generated/` 内の画像が静的ファイルとして配信されます。

## ローカル開発

```bash
npm install
cp .dev.vars.example .dev.vars
# .dev.vars に GEMINI_API_KEY を記入（画像生成時のみ必要）
npm run dev
```

デフォルトは `http://localhost:8788` です。

## 本番デプロイ

```bash
npm run deploy
```

Cloudflare Pages へ静的サイトとしてデプロイされます。本番では API Key 等のシークレット設定は不要です。

## セキュリティとコスト

- `GEMINI_API_KEY` は画像生成スクリプトのみが使用します。`.dev.vars` でローカル管理し、ブラウザやコミットに含めません。
- 本番では外部 API を呼び出さないため、シークレット設定は不要です。
- 画像は `generated/` に永続保存し、同じパターンの再生成を防ぎます。

## 今後の拡張（現スコープ外）

- 性別・体型の選択
- アイテムカテゴリーの追加（帽子・アイウェア・アウター・靴）
- 複数バリエーション画像の表示
- プリセットコーディネート
- SNS シェア

## 関連ドキュメント

- `README.md` — プロジェクト概要・開発手順
- `spec.md` — サービス仕様書（MVP 策定時のドキュメント）
- `.claude/skills/fitflux.md` — AI アシスタント向けの作業ガイド
- `index.html` — フロントエンド実装
- `scripts/outfit-config.mjs` — 衣装・プロンプト定義
