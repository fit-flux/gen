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
2. 各アイテムの種類と色を入力・選択します。初期値として英語の例文が入っています。
3. 「コーディネートを生成」ボタンを押します。
4. AI が 768×1344 の縦長全身写真を生成し、画面下部に表示されれば OK です。

画像生成には 20〜40 秒ほどかかることがあります。

## 利用可能なスクリプト

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | ローカル開発サーバーを `localhost:8788` で起動 |
| `npm run check` | TypeScript の型チェックを実行 |
| `npm run deploy` | Cloudflare Pages へデプロイ |

## トラブルシューティング

### `Address already in use (127.0.0.1:8788)`

既に `wrangler pages dev` または `workerd` が別のプロセスで動いています。以下で停止させてください。

```bash
pkill -f workerd
pkill -f "wrangler pages dev"
```

その後、再度 `npm run dev` を実行してください。別のポートで起動したい場合は以下のようにします。

```bash
npx wrangler pages dev . --port 8789
```

### DNS lookup failed / `api-inference.huggingface.co` に接続できない

Hugging Face の旧 Inference API エンドポイントは廃止されました。最新のコードでは `https://router.huggingface.co/hf-inference/models/{model_id}` を使用しているので、コードを更新してください。

## 本番デプロイ

```bash
npm run deploy
```

Cloudflare Pages へデプロイされます。初回は Cloudflare アカウントでの認証が必要です。本番では以下でシークレットを設定してください。

```bash
wrangler pages secret put HUGGINGFACE_TOKEN
```

## 補足

- `.dev.vars` はローカル開発用の環境変数ファイルです。本番環境では `wrangler pages secret put HUGGINGFACE_TOKEN` で設定してください。
- 使用するモデルは `wrangler.toml` のコメント、または `HF_MODEL` 環境変数で変更できます。デフォルトは `black-forest-labs/FLUX.1-schnell` です。
- 画像生成 API には Hugging Face Inference Providers の `router.huggingface.co` を使用しています。旧 `api-inference.huggingface.co` は廃止されているため注意してください。

## AI アシスタント向けメモ

- このプロジェクトは **Kimi-k2.7 (Kimi Code)** がコーディングを行います。
- 変更は最小限にとどめ、既存の構成・命名規則に合わせてください。
- 変更後は `npm run check` で型チェックを必ず実行してください。
- `HUGGINGFACE_TOKEN` は絶対にコードやログに出力しないでください。
- プロンプト構築ロジックを変更する場合は、`full body shot` / `head-to-toe` / 縦長 768×1344 という要件を維持してください。
- 詳細なプロジェクト規約は `.claude/skills/fitflux.md` と `architecture.md` を参照してください。

## ライセンス

本サービスで生成された画像は AI（FLUX.1-schnell など）による生成物です。画像の権利関係は各モデルのライセンスに従います。個人利用に限り自由に使用可能ですが、商用利用の可否は各モデルのライセンス条項をご確認ください。
