# FitFlux

選んだ帽子・アイウェア・アウター・トップス・パンツ・靴を AI が着用した全身写真を生成する、AI コーディネート試着室です。

Cloudflare Pages Functions を使っており、フロントエンドは静的 HTML、バックエンド API は `functions/api/generate.ts` で構成されています。

## 必要なもの

- Node.js（プロジェクトに合う LTS 版を推奨）
- npm
- [Pollinations](https://pollinations.ai/) アカウントと API Key（オプションだが本番では推奨）

## ローカル環境での動作確認

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.dev.vars.example` を `.dev.vars` にコピーし、Pollinations API Key を設定します（キーがなくても無料で動作します）。

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` を開いて、必要な環境変数を記入してください。

```text
POLLINATIONS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
POLLINATIONS_TIMEOUT_MS=300000
```

- `POLLINATIONS_API_KEY` は [enter.pollinations.ai](https://enter.pollinations.ai) から取得できます。キーなしでも FLUX 画像生成は無料で利用できますが、IP ベースのレート制限がかかります。
- `POLLINATIONS_TIMEOUT_MS` は Pollinations への画像生成待ち時間（ミリ秒）です。デフォルトは 60 秒ですが、混雑時にタイムアウトする場合は 300000（5 分）などに延ばしてください。

### 3. ローカルサーバーの起動

```bash
npm run dev
```

デフォルトでは `http://localhost:8788` で起動します。ターミナルに表示された URL をブラウザで開いてください。

### 4. 動作確認

1. ブラウザで `http://localhost:8788` を開きます。
2. 各アイテムの種類と色を入力・選択します。初期値として英語の例文が入っています。
3. 「コーディネートを生成」ボタンを押します。
4. AI が 384×672 の縦長全身写真を生成し、画面下部に表示されれば OK です。

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

### `429 Too Many Requests`

Pollinations の無料エンドポイントは IP ベースのレート制限があります。しばらく経ってからお試しください。本番運用では `POLLINATIONS_API_KEY` を設定することを推奨します。

### `502 Bad Gateway`（Pollinations から `402 Payment Required`）

API Key に紐づく Pollinations アカウントの pollen 残高が不足していると、画像生成時に `502 Bad Gateway` が返されます。これは Worker が Pollinations からの `402 Payment Required` をプロキシしている状態です。

Pollinations の無料 tier では pollen が**毎時間自動でリロード**されます（Microbe/Spore tier では 0.01 pollen/時間）。リクエスト 1 件あたりのコストを抑えるため、必要に応じて `functions/api/generate.ts` の画像サイズ（`PORTRAIT_WIDTH` / `PORTRAIT_HEIGHT`）を小さくしてください。サイズを小さくすると 1 リクエストの pollen 消費量が減り、無料枠内でより多く生成できます。

また、以下のいずれかでも対応可能です。

- `.dev.vars` から `POLLINATIONS_API_KEY` を削除し、IP ベースの無料モードに戻す
- [enter.pollinations.ai](https://enter.pollinations.ai) でアカウントに pollen をチャージする

## 本番デプロイ

```bash
npm run deploy
```

Cloudflare Pages へデプロイされます。初回は Cloudflare アカウントでの認証が必要です。本番では以下でシークレットを設定してください（必須ではありませんが推奨）。

```bash
wrangler pages secret put POLLINATIONS_API_KEY
wrangler pages secret put POLLINATIONS_TIMEOUT_MS
# 値の例: 300000（5 分）
```

## 補足

- `.dev.vars` はローカル開発用の環境変数ファイルです。本番環境では `wrangler pages secret put POLLINATIONS_API_KEY` で設定してください。
- 画像生成 API には Pollinations の `gen.pollinations.ai` を使用しています。
- Pollinations の FLUX 画像生成は無料で利用できますが、本番運用では `POLLINATIONS_API_KEY` を使用してレート制限を緩和することを推奨します。

## AI アシスタント向けメモ

- このプロジェクトは **Kimi-k2.7 (Kimi Code)** がコーディングを行います。
- 変更は最小限にとどめ、既存の構成・命名規則に合わせてください。
- 変更後は `npm run check` で型チェックを必ず実行してください。
- `POLLINATIONS_API_KEY` は絶対にコードやログに出力しないでください。
- プロンプト構築ロジックを変更する場合は、`full body shot` / `head-to-toe` / 縦長 384×672 という要件を維持してください。
- 詳細なプロジェクト規約は `.claude/skills/fitflux.md` と `architecture.md` を参照してください。

## ライセンス

本サービスで生成された画像は AI（FLUX.1-schnell）による生成物です。画像の権利関係は各モデルのライセンスに従います。個人利用に限り自由に使用可能ですが、商用利用の可否は各モデルのライセンス条項をご確認ください。
