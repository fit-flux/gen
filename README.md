# FitFlux

選んだトップスとパンツの色に合わせて、AI が着用した全身写真を即座に表示する、AI コーディネート試着室です。

静的 HTML のみで構成されており、各コーディネートの画像は `generated/` にあらかじめ生成済みです。バックエンド API はありません。

## 必要なもの

- Node.js（プロジェクトに合う LTS 版を推奨）
- npm
- [Gemini](https://aistudio.google.com/app/apikey) API Key（画像生成時のみ必要）

## ローカル環境での動作確認

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.dev.vars.example` を `.dev.vars` にコピーし、Gemini API Key を設定します（画像を生成しない場合は不要です）。

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` を開いて、必要な環境変数を記入してください。

```text
GEMINI_API_KEY=AIzaSy...
```

- `GEMINI_API_KEY` は [Google AI Studio](https://aistudio.google.com/app/apikey) から取得できます。
- 画像生成スクリプトのみがこのキーを使用します。フロントエンドや本番サーバーでは API Key を使用しません。

### 3. 画像の生成（初回または再生成時）

#### メンズ版

全 49 パターンの画像を `generated/` に生成します。

```bash
npm run generate
```

生成には数分〜数十分かかることがあります。`--limit 1` を付けると 1 枚だけテスト生成できます。

```bash
npm run generate -- --limit 1
```

既存の画像を上書きしたい場合は `--force` を付けてください。

```bash
npm run generate -- --force
```

#### レディース版

全 49 パターンの画像を `generated/women/` に生成します。

```bash
npm run generate:women
```

テスト生成・強制再生成も同様に `--limit` / `--force` が使えます。

```bash
npm run generate:women -- --limit 1
npm run generate:women -- --force
```

### 4. ローカルサーバーの起動

```bash
npm run dev
```

デフォルトでは `http://localhost:8788` で起動します。ターミナルに表示された URL をブラウザで開いてください。

### 5. 動作確認

1. ブラウザで `http://localhost:8788/men` を開きます（`/` から `/men` へリダイレクトされます）。
2. トップスとパンツの色を選びます。
3. 選んだ組み合わせに対応した 576×1024 の縦長全身写真が即座に表示されれば OK です。
4. 同様に `http://localhost:8788/women` でもレディース版が表示されることを確認します。

## 利用可能なスクリプト

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | ローカル開発サーバーを `localhost:8788` で起動 |
| `npm run check` | TypeScript の型チェックを実行 |
| `npm run deploy` | Cloudflare Pages へデプロイ |
| `npm run generate` | Gemini API でメンズ版コーディネート画像を生成 |
| `npm run generate:women` | Gemini API でレディース版コーディネート画像を生成 |

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

### 画像生成が失敗する

- `.dev.vars` に正しい `GEMINI_API_KEY` が設定されているか確認してください。
- Gemini API の無料枠を超えている場合は、しばらく経ってからお試しください。
- `generated/failed.json`（または `generated/women/failed.json`）に失敗したパターンが記録されます。原因を確認し、必要に応じて再生成してください。

## 本番デプロイ

```bash
npm run deploy
```

Cloudflare Pages へデプロイされます。初回は Cloudflare アカウントでの認証が必要です。

本番では Cloudflare Pages Functions や外部 API を呼び出さないため、API Key のシークレット設定は不要です。`generated/` にある画像が静的ファイルとして配信されます。

## 補足

- `.dev.vars` はローカル開発用の環境変数ファイルです。本番環境では使用しません。
- 画像生成には Gemini (`gemini-2.5-flash-image`) を使用しています。
- 生成した画像は `generated/` に保存され、リポジトリにコミットして静的配信します。

## AI アシスタント向けメモ

- このプロジェクトは **Kimi-k2.7 (Kimi Code)** がコーディングを行います。
- 変更は最小限にとどめ、既存の構成・命名規則に合わせてください。
- 変更後は `npm run check` で型チェックを必ず実行してください。
- `GEMINI_API_KEY` は絶対にコードやログに出力しないでください。
- プロンプト構築ロジックを変更する場合は、`full body shot` / `head-to-toe` / 縦長 576×1024 という要件を維持してください。
- 詳細なプロジェクト規約は `.claude/skills/fitflux.md` と `architecture.md` を参照してください。

## ライセンス

本サービスで表示される画像は AI（Gemini）による生成物です。画像の権利関係は各モデルのライセンスに従います。個人利用に限り自由に使用可能ですが、商用利用の可否は各モデルのライセンス条項をご確認ください。
