# FitFlux MVP 仕様書

## 1. サービス概要


| 項目      | 内容                                                                       |
| ------- | ------------------------------------------------------------------------ |
| サービス名   | **FitFlux**                                                              |
| 一言説明    | 帽子・アイウェア・アウター・トップス・パンツ・靴と色を選択すると、AI がそのコーディネートを着用した全身写真を生成するスマホ Web サービス |
| 対象デバイス  | スマートフォン（モバイルファースト）                                                       |
| 提供形態    | Web アプリ                                                                  |
| 利用料金    | 開発者・エンドユーザーともに無料                                                         |
| 画像生成モデル | FLUX.1-schnell（Hugging Face Inference Providers / hf-inference）            |


## 2. 無料運用方針

本サービスは、開発者もユーザーも費用をかけずに利用できることを最優先とする。

### 2.1 画像生成コストの無料化

- **採用 API**: Hugging Face Inference Providers の無料枠を使用
  - モデル: `black-forest-labs/FLUX.1-schnell`
  - エンドポイント: `https://router.huggingface.co/hf-inference/models/{model_id}`
  - 認証: Hugging Face Access Token（開発者が無料で発行）
- **Rate Limit 対策**:
  - 生成リクエストを単純な順次処理とし、超過時は「しばらくお待ちください」表示を出す
  - MVP ではキャッシュ・キューは導入しない
- **フォールバック**: `HF_MODEL` 環境変数で別のモデルに切り替え可能



### 2.2 ホスティング・インフラの無料化


| 用途              | 推奨サービス                                  | 理由                           |
| --------------- | --------------------------------------- | ---------------------------- |
| フロントエンド         | Cloudflare Pages       | 静的ホスティングが無料                  |
| バックエンド/API プロキシ | **Cloudflare Pages Functions** | サーバーレス、無料枠あり、HF Token を秘匿できる |


**重要**: GitHub Pages だけでは API トークンを隠せないため、Hugging Face API はブラウザから直接呼び出さず、Cloudflare Pages Functions 経由で呼び出す。HF Token は Workers の環境変数（シークレット）として管理する。

## 3. ユーザー体験（UX）



### 3.1 画面構成

1. **トップ画面**
  - サービス名「FitFlux」とキャッチコピー
  - 入力フォームを同一画面に配置
2. **入力画面**
  - 6 アイテムそれぞれに対し、自由入力欄と色選択ドロップダウンを配置
  - カテゴリー順: 🧢 帽子 → 🕶 アイウェア → 🧥 アウター → 👕 トップス → 👖 パンツ → 👞 靴
  - 初期値は英語の例文をあらかじめ入力済み
3. **生成中画面**
  - ローディングアニメーションと「コーディネートを提案中…」メッセージ
4. **結果画面**
  - 生成された全身写真を中央に表示
  - プロンプトを表示

### 3.2 入力方式

- 各アイテムは**自由入力テキスト**（英語入力を推奨。例: `cap`、`sunglasses`、`MA-1 jacket`）
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
- アスペクト比は縦長 9:16（768×1344）で生成
- プロンプトで `full body shot`、`head-to-toe`、`standing straight` を強調

## 4. プロンプト設計



### 4.1 基本プロンプトテンプレート

```text
A full-body fashion photo of a person standing straight with a neutral expression, shot from head to toe in a vertical portrait composition, wearing a {hat_color} {hat}, {eyewear_color} {eyewear} on the face, {outer_color} {outer}, {tops_color} {tops}, {pants_color} {pants}, and {shoes_color} {shoes}. Clean background, high detail, realistic lighting, full body shot. Do not crop the head, legs, or feet. No close-up, no upper-body only.
```



### 4.2 日本語入力の扱い

- フロントエンドでは日本語ラベルで表示する
- ユーザー入力はプロンプトにそのまま埋め込む
- 色は内部で英語タグを持ち、そのままプロンプトに使用する
- FLUX は英語プロンプトを推奨するため、placeholder と初期値は英語とする



### 4.3 サンプルプロンプト

入力例:

- 帽子: cap（黒）
- アイウェア: sunglasses（黒）
- アウター: MA-1 jacket（黒）
- トップス: T-shirt（白）
- パンツ: denim（青）
- 靴: sneakers（白）

生成プロンプト:

```text
A full-body fashion photo of a person standing straight with a neutral expression, shot from head to toe in a vertical portrait composition, wearing a black cap, black sunglasses on the face, black MA-1 jacket, white T-shirt, blue denim, and white sneakers. Clean background, high detail, realistic lighting, full body shot. Do not crop the head, legs, or feet. No close-up, no upper-body only.
```



## 5. 技術構成



### 5.1 推奨スタック


| レイヤー       | 技術                                                  |
| ---------- | --------------------------------------------------- |
| フロントエンド    | HTML / Tailwind CSS / Vanilla JavaScript |
| バックエンド API | Cloudflare Pages Functions                 |
| 画像生成 API   | Hugging Face Inference Providers（hf-inference）  |
| ホスティング     | Cloudflare Pages                                    |
| バージョン管理    | Git                                |




### 5.2 システム構成図

```
[スマホブラウザ]
       │
       ▼
[Cloudflare Pages] ── 静的ファイル配信
       │
       ▼
[Cloudflare Pages Functions] ── API プロキシ
       │
       ├── Hugging Face Token（シークレット）
       │
       ▼
[Hugging Face Inference Providers]
       │
       ▼
[FLUX.1-schnell]
```



### 5.3 API エンドポイント



#### POST `/api/generate`

リクエスト:

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

レスポンス:

```json
{
  "image_url": "data:image/jpeg;base64,...",
  "prompt": "A full-body fashion photo of ..."
}
```

内部処理:

1. リクエストをバリデーション
2. プロンプトを構築
3. Hugging Face Inference Providers を呼び出し（縦長 768×1344 で生成）
4. 生成された画像を Base64 データ URL としてフロントエンドに返す



### 5.4 キャッシュ戦略（MVP）

- MVP では画像の永続保存は行わず、生成された画像を Base64 データ URL としてフロントエンドに直接返す
- これにより KV などのストレージを用意せずに動作させ、コストと実装工数を抑える
- 将来的な拡張として、同じプロンプトに対して KV キャッシュ（キー: SHA-256 ハッシュ、有効期限 24 時間）で画像 URL を保持し再利用する方針とする



### 5.5 本番環境 URL

- **本番環境**: Cloudflare Pages へ `npm run deploy` でデプロイする
- フロントエンド・バックエンド API ともに同一オリジンで運用する



### 5.6 参考実装

- 本サービスの実装にあたっては、`/home/masasikatano/project/tarot` を参考にする



## 6. 機能外の項目（MVP では対応しない）

- ユーザー認証・アカウント機能
- 生成履歴の永続化
- 画像のダウンロード機能（ブラウザの長押し保存で代替）
- 複数モデル選択 UI
- モデル外見のカスタマイズ
- 課金・クレジット制
- キャッシュ・キューによる Rate Limit 対策



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


MVP では無料かつ個人利用を想定し **FLUX.1-schnell** をデフォルトで使用する。将来的な商用展開を見据えて `HF_MODEL` 環境変数での切り替えを容易にしておく。

## 8. 開発マイルストーン


| フェーズ  | 期間目安 | 内容                                        |
| ----- | ---- | ----------------------------------------- |
| Day 1 | 数時間  | プロトタイプ UI 作成、Cloudflare Pages デプロイ        |
| Day 2 | 数時間  | Pages Functions 経由で Hugging Face API 連携、プロンプト生成実装 |
| Day 3 | 数時間  | 縦長画像生成、英語初期値設定、エラーハンドリング実装             |
| Day 4 | 数時間  | スマホ表示調整、免責事項追加、軽微な修正                      |
| Day 5 | 数時間  | 動作確認、Rate Limit テスト、ドキュメント整備              |




## 9. リスクと対策


| リスク                 | 内容                  | 対策                          |
| ------------------- | ------------------- | --------------------------- |
| Hugging Face 無料枠の制限 | Rate Limit や待ち時間が発生 | シンプルなエラーメッセージ、モデル切り替え |
| 画像生成の品質ブレ           | 自由入力によりプロンプトが不安定    | プロンプト例を UI に表示、全身・縦長を強調   |
| API トークンの漏洩         | ブラウザに露出すると危険        | Cloudflare Pages Functions で秘匿管理    |
| モバイル表示の崩れ           | 各種スマホサイズへの対応        | Tailwind CSS でレスポンシブ設計      |
| 法的リスク               | AI 生成物の権利           | 免責事項・ライセンス表記を明確化            |




## 10. 次のフェーズでの拡張案（MVP スコープ外）

- 性別・体型の選択
- 生成画像のダウンロードボタン
- 生成履歴の保存（認証導入後）
- プリセットコーディネート機能
- SNS シェア機能
- 広告収益化またはサブスクモデル
- KV キャッシュによる画像再利用

---

**作成日**: 2026-07-06  
**サービス名**: FitFlux  
**目的**: FLUX.1-schnell を使った無料 AI コーディネート画像生成 Web サービスの MVP 仕様
