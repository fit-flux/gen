# FitFlux

選んだ帽子・アイウェア・アウター・トップス・パンツ・靴を AI が着用した全身写真を生成する、AI コーディネート試着室です。

Cloudflare Pages Functions を使っており、フロントエンドは静的 HTML、バックエンド API は `functions/api/generate.ts` で構成されています。

## 必要なもの

- Node.js（プロジェクトに合う LTS 版を推奨）
- npm
- [Hugging Face](https://huggingface.co/) アカウントと Access Token

## ローカル環境での動作確認

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.dev.vars.example` を `.dev.vars` にコピーし、Hugging Face の Access Token を設定します。

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` を開いて、トークンを記入してください。

```text
HUGGINGFACE_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

トークンは [Hugging Face Settings > Access Tokens](https://huggingface.co/settings/tokens) から取得できます。

### 3. ローカルサーバーの起動

```bash
npm run dev
```

デフォルトでは `http://localhost:8788` で起動します。ターミナルに表示された URL をブラウザで開いてください。

### 4. 動作確認

1. ブラウザで `http://localhost:8788` を開きます。
2. 各アイテムの種類と色を入力・選択します。
3. 「コーディネートを生成」ボタンを押します。
4. AI が画像を生成し、画面下部に表示されれば OK です。

画像生成には 20〜40 秒ほどかかることがあります。

## 補足

- `.dev.vars` はローカル開発用の環境変数ファイルです。本番環境では `wrangler pages secret put HUGGINGFACE_TOKEN` で設定してください。
- 使用するモデルは `wrangler.toml` のコメント、または `HF_MODEL` 環境変数で変更できます。デフォルトは `black-forest-labs/FLUX.1-schnell` です。
