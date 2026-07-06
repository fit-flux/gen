# FitFlux アーキテクチャ

## サービス概要

FitFlux は、ユーザーが選んだ帽子・アイウェア・アウター・トップス・パンツ・靴と色をもとに、AI がそのコーディネートを着用した全身写真を生成するスマホ向け Web サービスです。

## システム構成図

```
[スマホブラウザ]
       │
       ▼
[Cloudflare Pages] ── 静的ファイル配信（index.html）
       │
       ▼
[Cloudflare Pages Functions] ── /api/generate
       │
       ├── HUGGINGFACE_TOKEN（Wrangler Secret / .dev.vars）
       │
       ▼
[Hugging Face Inference Providers]
       │
       ▼
[FLUX.1-schnell]
```

## レイヤー構成

| レイヤー | 責務 | 実装 |
| --- | --- | --- |
| フロントエンド | 入力フォーム、生成結果表示、ローディング UI | `index.html` |
| API プロキシ | リクエスト検証、プロンプト構築、HF API 呼び出し、トークン秘匿 | `functions/api/generate.ts` |
| 画像生成 | 縦長全身写真の生成 | Hugging Face `black-forest-labs/FLUX.1-schnell` |
| ホスティング | 静的ファイル + サーバーレス関数の配信 | Cloudflare Pages |

## API エンドポイント

### `POST /api/generate`

リクエストボディ例:

```json
{
  "hat": "cap",
  "hat_color": "black",
  "eyewear": "sunglasses",
  "eyewear_color": "black",
  "outer": "MA-1 jacket",
  "outer_color": "black",
  "tops": "T-shirt",
  "tops_color": "white",
  "pants": "denim",
  "pants_color": "blue",
  "shoes": "sneakers",
  "shoes_color": "white"
}
```

レスポンス例:

```json
{
  "image_url": "data:image/jpeg;base64,...",
  "prompt": "A full-body fashion photo of ..."
}
```

内部処理:

1. リクエストをバリデーション
2. プロンプトを構築
3. Hugging Face Inference Providers を呼び出し（縦長 768×1344）
4. 生成された画像を Base64 データ URL として返却

## プロンプト設計

基本テンプレート:

```text
A full-body fashion photo of a person standing straight with a neutral expression,
shot from head to toe in a vertical portrait composition,
wearing {組み立てた衣装列}.
Clean background, high detail, realistic lighting, full body shot.
Do not crop the head, legs, or feet. No close-up, no upper-body only.
```

必須アイテムは `tops`, `pants`, `shoes` で、`hat`, `eyewear`, `outer` は任意です。

## セキュリティとコスト

- `HUGGINGFACE_TOKEN` は Cloudflare Pages Functions の環境変数（シークレット）として管理し、ブラウザに露出させません。
- MVP では画像を永続保存せず、Base64 データ URL で直接返却します。これにより KV 等のストレージコストを回避します。
- Rate Limit 対策はシンプルなエラーメッセージ表示に留め、キューイングやキャッシュは MVP では導入しません。

## 今後の拡張（MVP スコープ外）

- KV キャッシュによる同じプロンプトの画像再利用
- ユーザー認証と生成履歴の永続化
- 性別・体型の選択
- プリセットコーディネート
- SNS シェア

## 関連ドキュメント

- `spec.md` — サービス仕様書
- `README.md` — プロジェクト概要・開発手順
- `functions/api/generate.ts` — API 実装
- `index.html` — フロントエンド実装
