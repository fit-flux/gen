# FitFlux MVP 仕様書

## 1. サービス概要


| 項目      | 内容                                                                       |
| ------- | ------------------------------------------------------------------------ |
| サービス名   | **FitFlux**                                                              |
| 一言説明    | 帽子・アイウェア・アウター・トップス・パンツ・靴と色を選択すると、AI がそのコーディネートを着用した全身写真を生成するスマホ Web サービス |
| 対象デバイス  | スマートフォン（モバイルファースト）                                                       |
| 提供形態    | Web アプリ                                                                  |
| 利用料金    | 開発者・エンドユーザーともに無料                                                         |
| 画像生成モデル | FLUX.1-dev または FLUX.1-schnell（Hugging Face Inference API 無料枠）            |


## 2. 無料運用方針

本サービスは、開発者もユーザーも費用をかけずに利用できることを最優先とする。

### 2.1 画像生成コストの無料化

- **第 1 選択**: Hugging Face Serverless Inference API の無料枠を使用
  - モデル: `black-forest-labs/FLUX.1-dev` または `black-forest-labs/FLUX.1-schnell`
  - エンドポイント: `https://api-inference.huggingface.co/models/{model_id}`
  - 認証: Hugging Face Access Token（開発者が無料で発行）
- **Rate Limit 対策**:
  - 同一の組み合わせに対しては生成済み画像をキャッシュして再利用
  - 生成リクエストを簡易キューで順次処理
  - 超過時は「しばらくお待ちください」表示を出し、ポーリングで結果を待つ
- **フォールバック**: FLUX.1-dev の無料枠が厳しい場合、生成速度の速い **FLUX.1-schnell** に切り替え可能にする



### 2.2 ホスティング・インフラの無料化


| 用途              | 推奨サービス                                  | 理由                           |
| --------------- | --------------------------------------- | ---------------------------- |
| フロントエンド         | Cloudflare Pages または GitHub Pages       | 静的ホスティングが無料                  |
| バックエンド/API プロキシ | **Cloudflare Workers（Pages Functions）** | サーバーレス、無料枠あり、HF Token を秘匿できる |


**重要**: GitHub Pages だけでは API トークンを隠せないため、Hugging Face API をブラウザから直接呼び出す場合はトークンが露出する。MVP では **Cloudflare Pages + Cloudflare Workers（Pages Functions）** を採用し、HF Token は Workers の環境変数（シークレット）として管理する。

## 3. ユーザー体験（UX）



### 3.1 画面構成

1. **トップ画面**
  - サービス名「FitFlux」とキャッチコピー
  - 「コーディネートを作る」ボタン
2. **入力画面**
  - 6 アイテムそれぞれに対し、自由入力欄と色選択ドロップダウンを配置
  - カテゴリー順: 🧢 帽子 → 🕶 アイウェア → 🧥 アウター → 👕 トップス → 👖 パンツ → 👞 靴
3. **生成中画面**
  - ローディングアニメーションと「コーディネートを提案中…」メッセージ
4. **結果画面**
  - 生成された全身写真を中央に表示

### 3.2 入力方式

- 各アイテムは**自由入力テキスト**（例: `ma1 ジャケット`、`黒いデニム`）
- 色は**選択式ドロップダウン**から選ぶ
- 選択可能な色（日本語 UI / 内部英語タグ）:


| 日本語 | 英語タグ   |
| --- | ------ |
| 白   | white  |
| グレー | gray   |
| 黒   | black  |
| 赤   | red    |
| 茶   | brown  |
| 黄   | yellow |
| 緑   | green  |
| 青   | blue   |
| 紫   | purple |




### 3.3 生成画像の種類

- **人物が着用した全身写真**
- 背景はシンプルな単色またはスタジオ風
- モデル外見は MVP では固定:
  - `full body shot`

## 4. プロンプト設計



### 4.1 基本プロンプトテンプレート

```text
A full-body, wearing a {color_hat} {hat}, {color_eyewear} {eyewear}, {color_outer} {outer}, {color_tops} {tops}, {color_pants} {pants}, and {color_shoes} {shoes}. Clean background, high detail, realistic lighting, full body shot.
```



### 4.2 日本語入力の扱い

- フロントエンドでは日本語のまま入力・表示する
- バックエンドで日本語を英語タグに変換してプロンプトに埋め込む
- 色は内部で英語タグを持ち、そのままプロンプトに使用する
- 自由入力のテキストは、可能な範囲で英語に翻訳またはそのまま使用（FLUX は英語プロンプトを推奨）



### 4.3 サンプルプロンプト

入力例:

- 帽子: キャップ（赤）
- アイウェア: サングラス（黒）
- アウター: ma1 ジャケット（黒）
- トップス: t シャツ（白）
- パンツ: デニム（黒）
- 靴: スニーカー（白）

生成プロンプト:

```text
A full-body fashion photo of a slim East Asian person, neutral expression, wearing a red cap, black sunglasses, black MA-1 jacket, white t-shirt, black denim pants, and white sneakers. Clean background, high detail, realistic lighting, full body shot.
```



## 5. 技術構成



### 5.1 推奨スタック


| レイヤー       | 技術                                                  |
| ---------- | --------------------------------------------------- |
| フロントエンド    | HTML / Tailwind CSS / Vanilla JavaScript（または React） |
| バックエンド API | Cloudflare Workers（Pages Functions）                 |
| 画像生成 API   | Hugging Face Inference API                          |
| キャッシュ      | Cloudflare Workers KV（無料枠）                          |
| ホスティング     | Cloudflare Pages                                    |
| バージョン管理    | GitHub（無料プライベートリポジトリ）                               |




### 5.2 システム構成図

```
[スマホブラウザ]
       │
       ▼
[Cloudflare Pages] ── 静的ファイル配信
       │
       ▼
[Cloudflare Workers] ── API プロキシ
       │
       ├── Hugging Face Token（シークレット）
       ├── KV キャッシュ（同じ組み合わせの画像 URL を保存）
       │
       ▼
[Hugging Face Inference API]
       │
       ▼
[FLUX.1-dev / FLUX.1-schnell]
```



### 5.3 API エンドポイント



#### POST `/api/generate`

リクエスト:

```json
{
  "hat": "cap",
  "hat_color": "red",
  "eyewear": "sunglasses",
  "eyewear_color": "black",
  "outer": "MA-1 jacket",
  "outer_color": "black",
  "tops": "t-shirt",
  "tops_color": "white",
  "pants": "denim pants",
  "pants_color": "black",
  "shoes": "sneakers",
  "shoes_color": "white"
}
```

レスポンス:

```json
{
  "image_url": "https://.../generated.png",
  "prompt": "A full-body fashion photo of ..."
}
```

内部処理:

1. リクエストからプロンプトを構築
2. KV キャッシュに同じプロンプトの画像があればそれを返す
3. なければ Hugging Face Inference API を呼び出し
4. 生成された画像を一時的なストレージに保存（Base64 または一時 URL）
5. 結果を KV にキャッシュし、画像 URL を返す



### 5.4 キャッシュ戦略（MVP）

- MVP では画像の永続保存は行わず、生成された画像を Base64 データ URL としてフロントエンドに直接返す。
- これにより KV などのストレージを用意せずに動作させ、コストと実装工数を抑える。
- 将来的な拡張として、同じプロンプトに対しては KV キャッシュ（キー: SHA-256 ハッシュ、有効期限 24 時間）で画像 URL を保持し再利用する方針とする。



### 5.5 本番環境 URL

- **本番環境**: `https://gen.fitflux.workers.dev/`
- フロントエンド・バックエンド API ともに本番環境として運用する。



### 5.6 参考実装

- 本サービスの実装にあたっては、`/home/masasikatano/project/tarot` を参考にする。



## 6. 機能外の項目（MVP では対応しない）

- ユーザー認証・アカウント機能
- 生成履歴の永続化
- 画像のダウンロード機能（ブラウザの長押し保存で代替）
- 複数モデル選択
- モデル外見のカスタマイズ
- 課金・クレジット制



## 7. 法務・表記



### 7.1 画面下部に必ず表示する免責事項

```text
本サービスで生成された画像は AI（FLUX.1-dev / FLUX.1-schnell）による生成物です。
画像の権利関係は各モデルのライセンスに従います。
個人利用に限り自由に使用可能ですが、商用利用の可否は各モデルのライセンス条項をご確認ください。
```



### 7.2 ライセンス確認


| モデル            | ライセンス                               | 商用利用         |
| -------------- | ----------------------------------- | ------------ |
| FLUX.1-dev     | FLUX.1 [dev] Non-Commercial License | 非商用（個人・研究用途） |
| FLUX.1-schnell | Apache 2.0                          | 商用利用可        |


MVP では、無料かつ個人利用を想定し **FLUX.1-dev** を使うが、将来的な商用展開を見据えて **FLUX.1-schnell** への切り替えを容易にしておく。

## 8. 開発マイルストーン


| フェーズ  | 期間目安 | 内容                                        |
| ----- | ---- | ----------------------------------------- |
| Day 1 | 数時間  | プロトタイプ UI 作成、Cloudflare Pages デプロイ        |
| Day 2 | 数時間  | Workers 経由で Hugging Face API 連携、プロンプト生成実装 |
| Day 3 | 数時間  | KV キャッシュ、ローディング表示、エラーハンドリング実装             |
| Day 4 | 数時間  | スマホ表示調整、免責事項追加、軽微な修正                      |
| Day 5 | 数時間  | 動作確認、Rate Limit テスト、ドキュメント整備              |




## 9. リスクと対策


| リスク                 | 内容                  | 対策                          |
| ------------------- | ------------------- | --------------------------- |
| Hugging Face 無料枠の制限 | Rate Limit や待ち時間が発生 | キャッシュ、キュー、schnell へのフォールバック |
| 画像生成の品質ブレ           | 自由入力によりプロンプトが不安定    | プロンプト例を UI に表示、固定モデル表現を使用   |
| API トークンの漏洩         | ブラウザに露出すると危険        | Cloudflare Workers で秘匿管理    |
| モバイル表示の崩れ           | 各種スマホサイズへの対応        | Tailwind CSS でレスポンシブ設計      |
| 法的リスク               | AI 生成物の権利           | 免責事項・ライセンス表記を明確化            |




## 10. 次のフェーズでの拡張案（MVP スコープ外）

- 性別・体型の選択
- 生成画像のダウンロードボタン
- 生成履歴の保存（認証導入後）
- プリセットコーディネート機能
- SNS シェア機能
- 広告収益化またはサブスクモデル

---

**作成日**: 2026-07-06  
**サービス名**: FitFlux  
**目的**: FLUX.1-dev / schnell を使った無料 AI コーディネート画像生成 Web サービスの MVP 仕様