# FitFlux Gemini 静的画像生成移行計画

## 1. 背景と目的

現状の Pollinations 無料エンドポイントでは、生成に時間がかかり、無料枠の制約から実用的な枚数を生成できない。  
そのため、**Gemini API（`gemini-2.5-flash-image`）を使って 49 パターン（7 色 × 7 色）を一括生成し、Cloudflare Pages 上で静的配信する**形に移行する。

移行後はブラウザがバックエンド API を経由せず、あらかじめ生成した画像ファイルを直接読み込む。これにより、表示が高速化し、レート制限を気にせず全パターンを提示できる。

## 2. スコープ

- 対象シーズン：夏（summer outfit）
- カテゴリ：トップス・パンツの 2 種に固定
- アイテム名：固定
  - トップス：`T-shirt`
  - パンツ：`short chino pants`
- 色：7 色固定
  - `white` 白
  - `gray` グレー
  - `beige` 駱駝
  - `brown` 茶
  - `black` 黒
  - `blue` 青
  - `green` 緑
- 生成パターン数：7 × 7 = **49 枚**
- 既存 Pollinations 連携：`functions/api/generate.ts` を削除し、Cloudflare Pages Functions ごと廃止

## 3. 方針（grill-me で確定した選択）

| 項目 | 選択 |
| --- | --- |
| 画像生成モデル | `gemini-2.5-flash-image`（`@google/genai` SDK） |
| 認証 | ローカル生成スクリプトが `GEMINI_API_KEY` を読み込む |
| 画像保存先 | リポジトリ内 `generated/`（Pages ルートから `/generated/...` で配信） |
| 縦横比 | 縦長 9:16（Gemini がネイティブで出せない場合は中心クロップ/リサイズ） |
| 既存 API | 完全に削除 |

## 4. 最終的なファイル構成

```text
.
├── generated/                    # 生成済み画像（コミット対象）
│   ├── white-white.webp
│   ├── white-gray.webp
│   ├── ...（49 枚）
│   └── manifest.json             # パターン → ファイル名・プロンプトの対応表
├── scripts/
│   ├── outfit-config.mjs         # カテゴリ・色の単一情報源
│   └── generate-outfits.mjs      # 49 枚を生成するスクリプト
├── .env.example                  # GEMINI_API_KEY サンプル
├── index.html                    # 2 カテゴリ・7 色 UI、静的画像切り替え
├── package.json                  # スクリプト・依存追加
├── wrangler.toml                 # Pollinations コメント削除
├── AGENTS.md                     # 新構成に合わせて更新
└── spec_gemini.md                # 本ファイル
```

※ `functions/` ディレクトリは削除する。

## 5. プロンプト設計

1 パターンあたりのプロンプト例：

```text
A full-body photo of a person standing straight, shot from head to toe, wearing a white T-shirt and blue short chino pants. Summer outfit, clean light background, natural lighting, realistic. Full body, do not crop the head or feet.
```

- 色タグは英語のまま埋め込む
- `full body`、`head-to-toe`、`standing straight` を維持
- 季節感を出すため `Summer outfit` を含める
- 背景・照明はシンプルに統一し、パターン間のブレを抑える

## 6. 生成スクリプト（`scripts/generate-outfits.mjs`）の仕様

### 6.1 依存

```bash
npm install -D @google/genai sharp p-limit dotenv
```

- `@google/genai`：Gemini 画像生成
- `sharp`：クロップ・WebP 変換
- `p-limit`：並列数制御（レート制限対策）
- `dotenv`：`.env` から `GEMINI_API_KEY` を読み込み

### 6.2 処理フロー

1. `.env` から `GEMINI_API_KEY` を読み込み。未設定ならエラー終了。
2. `outfit-config.mjs` から色リストを取得。
3. 7 × 7 の全組み合わせを作成。
4. 各組み合わせで以下を実行（並列数 2 程度）：
   - ファイル名 `generated/{tops_color}-{pants_color}.webp` が既に存在する場合はスキップ（`--force` 指定時は上書き）
   - プロンプトを組み立て
   - Gemini API を呼び出し（`responseModalities: ['image']`）
   - 返却された画像を `sharp` で 9:16 にクロップし WebP 形式で保存
   - 失敗した場合は `generated/failed.json` に記録して継続
5. 全パターン完了後、`generated/manifest.json` を更新。

### 6.3 画像サイズの扱い

- Gemini が縦長サイズをネイティブでサポートしている場合：指定した縦長（例 768×1344）で生成
- サポートしていない場合：最大解像度で生成し、`sharp` で中心から 9:16 にクロップしてから縦長サイズにリサイズ
- 目標サイズは既存 UI の 9:16 アスペクト比に合わせ、**768×1344** を基本とする（必要に応じて 576×1024 などに調整可）

### 6.4 実行例

```bash
# 初回生成
npm run generate

# 全上書き再生成
npm run generate -- --force
```

## 7. フロントエンド（`index.html`）の変更

### 7.1 カテゴリ・色の固定

```js
const CATEGORIES = [
  { key: 'tops', label: 'トップス', value: 'T-shirt' },
  { key: 'pants', label: 'パンツ', value: 'short chino' },
];

const DEFAULT_COLORS = { tops: 'white', pants: 'blue' };

const COLORS = [
  { value: 'white', label: '白' },
  { value: 'gray', label: 'グレー' },
  { value: 'beige', label: '駱駝' },
  { value: 'brown', label: '茶' },
  { value: 'black', label: '黒' },
  { value: 'blue', label: '青' },
  { value: 'green', label: '緑' },
];
```

### 7.2 表示切り替え

- 色セレクトボックスの `change` イベントで即座に画像を切り替える
- 画像パス：`/generated/{tops_color}-{pants_color}.webp`
- 「コーディネートを生成」ボタン、ローディングオーバーレイ、キャンセル処理は削除
- Prompt details には使用したプロンプトをテンプレートから表示

### 7.3 ローディング対応

- 画像読み込み中はプレースホルダーを表示
- 読み込み失敗時はユーザーに組み合わせが未生成であることを示す（基本的には 49 枚すべて生成済みなので発生しない）

## 8. クリーンアップ

- `functions/api/generate.ts` を削除
- `functions/` ディレクトリが空になればディレクトリごと削除
- `wrangler.toml` から Pollinations 関連のコメントを削除（シークレット設定も不要）
- `.dev.vars.example` / `.dev.vars` の Pollinations 設定を削除し、`.env.example` に `GEMINI_API_KEY` を追加
- `AGENTS.md` の以下を更新
  - Pollinations の記述を Gemini 静的生成に変更
  - 必要な環境変数を `GEMINI_API_KEY` に変更
  - ローカル手順を `npm run generate && npm run dev` に変更
- `index.html` フッターの免責事項を Gemini 生成に合わせて更新（例：`FLUX.1-schnell` → `Gemini`）

## 9. ビルド・デプロイフロー

```bash
# 1. 依存インストール
npm install

# 2. 環境変数設定
cp .env.example .env
# .env に GEMINI_API_KEY=... を記入

# 3. 画像生成
npm run generate

# 4. 型チェック
npm run check

# 5. ローカル確認
npm run dev

# 6. 本番デプロイ
npm run deploy
```

## 10. 検収チェックリスト

- [ ] `npm run generate` で `generated/` に 49 枚の WebP が生成される
- [ ] `generated/manifest.json` が正しく出力されている
- [ ] `npm run check` が通る
- [ ] `npm run dev` 後、ブラウザで色を切り替えると対応画像が即座に表示される
- [ ] 存在しない組み合わせを選んでもエラーが適切にハンドリングされる
- [ ] `functions/api/generate.ts` が削除され、Cloudflare Pages Functions が無効になっている
- [ ] フッターの免責事項が Gemini 向けになっている

## 11. リスクと注意点

| リスク | 内容 | 対策 |
| --- | --- | --- |
| 縦長生成の制限 | Gemini image generation は正方形出力が基本の可能性がある | 最大解像度生成 → `sharp` で 9:16 クロップ |
| 画像の個体差 | 同じプロンプトでも色の濃淡・ポーズがブレる | 背景・照明を固定し、極端にクロップしないサイズを選択 |
| リポジトリ肥大 | 49 枚の画像をコミットするとリポジトリが大きくなる | WebP 圧縮。容量が気になる場合は R2 移行を次フェーズで検討 |
| 生成コスト | Gemini API は完全無料ではない | 無料枠内で 49 枚を生成。超過時は計画を見直す |
| 法務表記 | 生成モデルが FLUX から Gemini に変わる | フッター・README・AGENTS.md の表記を更新 |

## 12. 次のステップ

1. 本計画（`spec_gemini.md`）をレビュー・承認
2. 実装（`scripts/`、`index.html`、クリーンアップ、ドキュメント更新）
3. `npm run generate` で 49 枚を生成
4. 動作確認後、`npm run deploy` で本番反映
