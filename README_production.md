# FitFlux 本番環境設定ガイド

このドキュメントでは、FitFlux を Cloudflare Pages へ本番デプロイする手順と、本番環境特有の設定・運用についてまとめています。

## 必要なもの

- [Cloudflare](https://dash.cloudflare.com/) アカウント
- このリポジトリのクローンまたはソースコード
- Node.js（プロジェクトに合う LTS 版を推奨）と npm
- [Hugging Face](https://huggingface.co/) アカウントと Access Token

## 1. ローカルでビルド・型チェックを確認

本番に出す前に、必ず型チェックをパスさせてください。

```bash
npm install
npm run check
```

エラーが出た場合は `npm run check` の出力を確認し、修正してから先に進んでください。

## 2. Cloudflare 認証の確認

`wrangler` CLI が Cloudflare アカウントと連携されていることを確認します。`wrangler` はローカル devDependency としてインストールされているため、`npx wrangler` を使って実行してください（グローバルインストール済みの場合は `wrangler` でも動作します）。

```bash
npx wrangler whoami
```

未ログインの場合は以下で認証してください。

```bash
npx wrangler login
```

## 3. Cloudflare Pages プロジェクトの作成（初回のみ）

シークレットを設定する前に、Cloudflare Pages 上にプロジェクトが存在している必要があります。以下のいずれかの方法で作成してください。

### 方法 A: wrangler CLI から作成（推奨）

```bash
npm run deploy
```

初回は「Create a new project?」の確認が表示されるので `yes` を選択してください。デプロイが完了すると、Cloudflare Pages ダッシュボードで確認できます。

`wrangler.toml` の `name` が認識されない場合は、`--project-name` を明示的に指定します。

```bash
npx wrangler pages deploy . --project-name fitflux
```

### 方法 B: Cloudflare ダッシュボードから作成

1. [Cloudflare Pages ダッシュボード](https://dash.cloudflare.com/) を開く
2. 「Create a project」または「Pages」>「Create a project」を選択
3. 「Upload assets」を選択
4. プロジェクト名を `fitflux`（または任意の名前）で作成

ダッシュボードで作成した場合、プロジェクト名と `wrangler.toml` の `name` を一致させるか、以降のコマンドで `--project-name` に実際のプロジェクト名を指定してください。

## 4. 本番シークレットの設定

本番環境では `.dev.vars` は使われません。プロジェクト作成後に `npx wrangler pages secret put` で `HUGGINGFACE_TOKEN` を登録してください。プロジェクト名は `wrangler.toml` の `name` と一致させるか、`--project-name` で明示的に指定します。

```bash
npx wrangler pages secret put HUGGINGFACE_TOKEN --project-name fitflux
```

プロンプトに従って Hugging Face Access Token を入力します。入力内容は端末に表示されません。

### Hugging Face Access Token の取得

1. [Hugging Face Settings > Access Tokens](https://huggingface.co/settings/tokens) を開く
2. 「Create new token」を選択
3. 権限は `Make calls to the serverless Inference API` が必要です
4. 生成されたトークンをコピーして `npx wrangler pages secret put HUGGINGFACE_TOKEN --project-name fitflux` で登録

## 5. 使用モデルの確認・変更

デフォルトでは `black-forest-labs/FLUX.1-schnell` を使用します。必要に応じて `wrangler.toml` の環境変数で変更できます。

```toml
[vars]
HF_MODEL = "black-forest-labs/FLUX.1-schnell"
```

または、本番用シークレット/変数として個別に設定することも可能です。

```bash
npx wrangler pages secret put HF_MODEL --project-name fitflux
```

その他のオプション変数:

| 変数名 | 用途 | デフォルト |
| --- | --- | --- |
| `HF_MODEL` | Hugging Face 上のモデル ID | `black-forest-labs/FLUX.1-schnell` |
| `HF_TIMEOUT_MS` | 画像生成 API のタイムアウト（ミリ秒） | `60000` |

## 6. 本番デプロイ

```bash
npm run deploy
```

初回のみ Cloudflare Pages プロジェクトの作成確認や認証フローが入ります。2 回目以降は `wrangler.toml` の設定を使って既存プロジェクトにデプロイされます。

`wrangler.toml` の `name` が認識されない場合は以下のように `--project-name` を付けてください。

```bash
npx wrangler pages deploy . --project-name fitflux
```

## 7. デプロイ後の確認

1. ターミナルまたは Cloudflare ダッシュボードで本番 URL を確認します
2. ブラウザで本番 URL を開き、各アイテムを入力・選択します
3. 「コーディネートを生成」を押し、768×1344 の縦長全身写真が表示されることを確認します

画像生成には 20〜40 秒ほどかかることがあります。エラーが出た場合は [トラブルシューティング](#トラブルシューティング) を参照してください。

## 7. カスタムドメインの設定（オプション）

Cloudflare Pages ダッシュボードからカスタムドメインを紐づけることができます。

1. [Cloudflare Pages ダッシュボード](https://dash.cloudflare.com/) を開く
2. 該当プロジェクトを選択
3. 「Custom domains」タブからドメインを追加
4. DNS レコードの設定指示に従う

## トラブルシューティング

### デプロイは成功したが画像が生成されない

`HUGGINGFACE_TOKEN` が本番環境に正しく設定されているか確認してください。

```bash
npx wrangler pages secret list --project-name fitflux
```

トークンが未登録・不正な場合は再度登録し直してください。

### `Unauthorized` / `401` エラー

Hugging Face Access Token が無効、期限切れ、または必要な権限が付与されていない可能性があります。新しいトークンを発行し、本番シークレットを更新してください。

```bash
npx wrangler pages secret put HUGGINGFACE_TOKEN --project-name fitflux
```

### `DNS lookup failed` / `router.huggingface.co` に接続できない

Cloudflare Workers/Pages Functions から外部 API への接続がブロックされていないか確認してください。通常は追加設定は不要ですが、Enterprise プランなどで明示的なアウトバウンド制限をかけている場合は `router.huggingface.co` への HTTPS アクセスを許可してください。

### タイムアウトが頻発する

画像生成に時間がかかるモデルの場合、`HF_TIMEOUT_MS` を大きくしてください。

```bash
npx wrangler pages secret put HF_TIMEOUT_MS --project-name fitflux
# 例: 120000
```

ただし、Cloudflare Workers/Pages Functions の実行時間上限（無料プランは 50 秒、有料プランは 5 分など）を超えることはできません。

### 画像が途中で切れている / 全身ではない

プロンプト構築ロジックに変更を加えた場合、`full body shot` / `head-to-toe` / 縦長 768×1344 という要件が維持されているか確認してください。

## セキュリティと運用

- `HUGGINGFACE_TOKEN` は絶対にクライアント側やリポジトリに含めないでください。本番では必ず `npx wrangler pages secret` 経由で管理してください。
- `.dev.vars` はローカル開発専用です。`.gitignore` に含まれていることを確認してください。
- 本番 URL を公開する場合、Hugging Face の利用料・レート制限に注意してください。必要に応じてアクセス制限や監視を検討してください。
- MVP では画像を永続保存しません。生成結果を保持したい場合は、別途ストレージ（R2/KV など）への保存機能を追加してください。

## 更新・ロールバック

コード修正後は以下で本番に反映します。

```bash
npm run check
npm run deploy
```

緊急時は Cloudflare Pages ダッシュボードから過去のデプロイにロールバックできます。

## 関連ドキュメント

- `README.md` — プロジェクト概要・開発手順
- `README_local.md` — ローカル開発用の簡易ガイド
- `architecture.md` — システム構成と API 仕様
- `wrangler.toml` — 本番環境変数と compatibility 設定
- `functions/api/generate.ts` — API 実装
