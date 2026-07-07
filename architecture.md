# FitFlux アーキテクチャ

## サービス概要

FitFlux は、ユーザーが選んだトップスとパンツの色に合わせて、AI が着用した全身写真を即座に表示するスマホ向け Web サービスです。

現在の実装は **静的 HTML のみ** で構成されており、実行時のバックエンド API はありません。すべてのコーディネート画像は `generated/` にあらかじめ生成済みです。

## システム構成図

```
[スマホブラウザ]
       │
       ▼
[Cloudflare Pages] ── 静的ファイル配信（HTML + generated/）
```

## レイヤー構成

| レイヤー | 責務 | 実装 |
| --- | --- | --- |
| フロントエンド | 入力フォーム、画像表示、ローディング UI | `men/index.html`, `women/index.html` |
| 画像素材 | あらかじめ生成した縦長全身写真の静的配信 | `generated/*.webp`, `generated/women/*.webp` |
| 画像生成 | Gemini API で全パターンを生成・加工 | `scripts/generate-outfits.mjs` |
| 設定・プロンプト | カテゴリー、色、プロンプト、ファイル名の単一情報源 | `scripts/outfit-config.mjs` |
| ホスティング | 静的ファイルの配信 | Cloudflare Pages |
| リダイレクト | `/` → `/men` へ転送 | `_redirects` |

## ファイル構成

```
.
├── _redirects                        # / → /men 301 リダイレクト
├── index.html                        # リダイレクト元（または従来のランディング）
├── men/
│   └── index.html                    # メンズ版フロントエンド UI
├── women/
│   └── index.html                    # レディース版フロントエンド UI
├── scripts/
│   ├── outfit-config.mjs             # カテゴリー / 色 / プロンプト / ファイル名
│   └── generate-outfits.mjs          # Gemini による画像生成スクリプト
├── generated/
│   ├── *.webp                        # メンズ版生成済みコーディネート画像（49 枚）
│   ├── manifest.json                 # メンズ版メタデータ
│   ├── failed.json                   # メンズ版生成失敗記録
│   └── women/
│       ├── *.webp                    # レディース版生成済みコーディネート画像（49 枚）
│       ├── manifest.json             # レディース版メタデータ
│       └── failed.json               # レディース版生成失敗記録
├── wrangler.toml                     # Cloudflare Pages 設定
├── package.json                      # npm スクリプト
└── tsconfig.json                     # scripts/**/*.mjs の型チェック
```

## ルーティング

| URL | 実ファイル | 内容 |
| --- | --- | --- |
| `/` | `_redirects` により `/men` へ 301 | — |
| `/men` | `men/index.html` | メンズ版コーディネートページ |
| `/women` | `women/index.html` | レディース版コーディネートページ |

Cloudflare Pages は `/{dir}/index.html` を `/{dir}` でも配信します。

## 入力と画像の対応

### メンズ版

| カテゴリー | 項目 | 選択可能な色 |
| --- | --- | --- |
| トップス | T-shirt | white, gray, beige, brown, black, blue, green |
| パンツ | short chino pants | white, gray, beige, brown, black, blue, green |

### レディース版

| カテゴリー | 項目 | 選択可能な色 |
| --- | --- | --- |
| トップス | blouse | white, gray, beige, brown, black, blue, green |
| パンツ | wide pants | white, gray, beige, brown, black, blue, green |

どちらも組み合わせは 7 × 7 = **49 通り** です。
ファイル名は `{topsColor}-{pantsColor}.webp`、レディース版は `generated/women/{topsColor}-{pantsColor}.webp` に保存されます。

## プロンプト設計

基本テンプレートは `scripts/outfit-config.mjs` の `buildPromptForGender()` で構築します。

### メンズ版

```text
A full-body photo of a young man standing straight, facing the camera,
shot from head to toe,
wearing a {topsColor} T-shirt and {pantsColor} short chino pants.
Summer outfit, clean light background, natural lighting, realistic.
Full body, head to toe, entire head and hair visible,
do not crop the head or feet, male model.
```

### レディース版

```text
A full-body photo of a young woman standing straight, facing the camera,
shot from head to toe,
wearing a {topsColor} blouse and {pantsColor} wide pants.
Summer outfit, clean light background, natural lighting, realistic.
Full body, head to toe, entire head and hair visible,
do not crop the head or feet, female model.
```

必須キーワードは維持します。

- `full body` / `head to toe` / `standing straight`
- `facing the camera`
- `entire head and hair visible`
- `do not crop the head or feet`

## 画像生成フロー

`npm run generate` または `npm run generate:women` の実行時のみ動作します。

1. `scripts/outfit-config.mjs` から全 49 通りの組み合わせを取得
2. Gemini (`gemini-2.5-flash-image`) にプロンプトを送信
3. 返却された画像を `sharp` で 9:16（576×1024）にクロップ・リサイズ
4. `generated/{topsColor}-{pantsColor}.webp`（または `generated/women/...`）として保存
5. `generated/manifest.json` / `generated/failed.json`（または `generated/women/...`）を更新

本番環境ではこのスクリプトは実行されず、`generated/` 内の画像が静的ファイルとして配信されます。

## ローカル開発

```bash
npm install
cp .dev.vars.example .dev.vars
# .dev.vars に GEMINI_API_KEY を記入（画像生成時のみ必要）
npm run dev
```

デフォルトは `http://localhost:8788` です。`/men` と `/women` の両方を確認してください。

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

- 体型の選択
- アイテムカテゴリーの追加（帽子・アイウェア・アウター・靴）
- 複数バリエーション画像の表示
- プリセットコーディネート
- SNS シェア

## 関連ドキュメント

- `README.md` — プロジェクト概要・開発手順
- `spec.md` — サービス仕様書（MVP 策定時のドキュメント）
- `spec_woman.md` — レディース版追加仕様書
- `.claude/skills/fitflux.md` — AI アシスタント向けの作業ガイド
- `scripts/outfit-config.mjs` — 衣装・プロンプト定義
