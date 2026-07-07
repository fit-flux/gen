# FitFlux `/women` ページ作成仕様書

## 1. 背景と目的

FitFlux は現在 `/men` をトップページとして、トップスとパンツの色を選ぶと AI が着用した全身写真を即座に表示している。  
本仕様は、同じ体験を女性向けに展開する **`/women` ページ** を新設する計画を定める。

## 2. 前提：grill-me で確定した選択

| 項目 | 選択 |
| --- | --- |
| 男性版 URL | `/` → `/men` へ 301 リダイレクト。`/men` が実体。 |
| 女性版 URL | `/women` を新設 |
| コーディネート構成 | トップス + パンツ（2 カテゴリ固定） |
| 女性版アイテム名 | トップス：`blouse`、パンツ：`wide pants` |
| 季節テーマ | `Summer outfit`（男性版と同じ夏仕様） |
| 色 | 男性版と同じ 7 色（white / gray / beige / brown / black / blue / green） |
| 初期表示色 | `white` ブラウス + `white` パンツ |
| 画像保存先 | `generated/women/{topsColor}-{pantsColor}.webp` |
| 人物指定 | `a young woman`、`female model` |
| 性別切り替え UI | ヘッダーに `MEN / WOMEN` リンクを設置（モバイル・デスクトップ両方） |
| 設定管理 | `scripts/outfit-config.mjs` を性別対応に拡張 |
| 生成コマンド | `npm run generate:women` を新設 |

## 3. ファイル構成（追加・変更予定）

```text
.
├── _redirects                        # 新規: `/` → `/men` 301 リダイレクト
├── index.html                        # 変更なし or リダイレクト用に残す
├── men/
│   └── index.html                    # 新規: 既存男性版をここへ移動（または複製）
├── women/
│   └── index.html                    # 新規: 女性版ページ
├── generated/
│   ├── {tops}-{pants}.webp           # 既存: 男性版 49 枚
│   └── women/
│       ├── {tops}-{pants}.webp       # 新規: 女性版 49 枚
│       ├── manifest.json             # 新規: 女性版メタデータ
│       └── failed.json               # 新規: 女性版生成失敗記録
├── scripts/
│   ├── outfit-config.mjs             # 変更: 男性 / 女性両方の設定・プロンプトを提供
│   └── generate-outfits.mjs          # 変更: `--women` または内部フラグで女性版生成
├── package.json                      # 変更: `generate:women` スクリプト追加
├── architecture.md                   # 変更: 女性版を反映
└── README.md                         # 変更: 女性版の開発手順を追記
```

## 4. ルーティング

### 4.1 `_redirects`

Cloudflare Pages 用の `_redirects` をプロジェクトルートに配置する。

```text
/ /men 301
```

これにより、ユーザーが `https://fitflux.pages.dev/` にアクセスすると `https://fitflux.pages.dev/men` へ転送される。

### 4.2 ページ配置

| URL | 実ファイル | 内容 |
| --- | --- | --- |
| `/men` | `men/index.html` | 既存の男性版コーディネートページ |
| `/women` | `women/index.html` | 新規の女性版コーディネートページ |

Cloudflare Pages は `/{dir}/index.html` を `/{dir}` でも配信する。

## 5. コーディネート定義

### 5.1 アイテム

| カテゴリー | 男性版 | 女性版 |
| --- | --- | --- |
| トップス | `T-shirt` | `blouse` |
| パンツ | `short chino pants` | `wide pants` |

### 5.2 色

男性版と同一の 7 色を使用する。

```js
const COLORS = [
  { value: 'white', label: '白' },
  { value: 'gray', label: 'グレー' },
  { value: 'beige', label: 'カーキ' },
  { value: 'brown', label: '茶' },
  { value: 'black', label: '黒' },
  { value: 'blue', label: '青' },
  { value: 'green', label: '緑' },
];
```

### 5.3 初期表示色

```js
const DEFAULT_COLORS_WOMEN = { tops: 'white', pants: 'white' };
```

### 5.4 パターン数

7 色 × 7 色 = **49 枚**

## 6. プロンプト設計

### 6.1 女性版プロンプトテンプレート

```text
A full-body photo of a young woman standing straight, facing the camera, shot from head to toe, wearing a {topsColor} blouse and {pantsColor} wide pants. Summer outfit, clean light background, natural lighting, realistic. Full body, head to toe, entire head and hair visible, do not crop the head or feet, female model.
```

### 6.2 必須キーワード

男性版と同じく以下を維持する。

- `full body` / `head to toe` / `standing straight`
- `facing the camera`
- `entire head and hair visible`
- `do not crop the head or feet`

### 6.3 ファイル名・パス

```js
// 女性版
`generated/women/${topsColor}-${pantsColor}.webp`

// 男性版（既存）
`generated/${topsColor}-${pantsColor}.webp`
```

## 7. `scripts/outfit-config.mjs` の拡張方針

### 7.1 推奨 API

`gender` 引数（`'men' | 'women'`）を受け取り、該当する設定オブジェクトを返す。

```js
export function getConfig(gender) {
  return gender === 'women' ? WOMEN_CONFIG : MEN_CONFIG;
}

export function buildPrompt(gender, topsColor, pantsColor) {
  const config = getConfig(gender);
  // ...
}

export function getFileName(gender, topsColor, pantsColor) {
  const base = `${topsColor}-${pantsColor}.webp`;
  return gender === 'women' ? `women/${base}` : base;
}
```

### 7.2 互換性

既存の `index.html`（男性版）が import している `CATEGORIES`, `DEFAULT_COLORS`, `COLORS`, `buildPrompt`, `getFileName` は、移行期間中は `men` 用のデフォルト動作を維持する。  
新設する `women/index.html` では `getConfig('women')` などを使用する。

## 8. フロントエンド（`women/index.html`）

### 8.1 ベース

`index.html`（男性版）をベースに、以下を変更する。

- タイトル：`FitFlux — レディースコーディネート提案`
- meta description：女性版に書き換え
- 見出し：`夏のレディースコーディネートを提案`
- サブテキスト：女性版に書き換え
- 画像パス：`/generated/women/{tops}-{pants}.webp`
- 設定 import：`getConfig('women')` 相当を使用

### 8.2 ヘッダーナビゲーション

ヘッダー右側のテキスト「コーディネート提案」を、以下の性別切り替えリンクに置き換える。  
モバイル・デスクトップ両方で表示する。

```html
<nav class="flex items-center gap-4 text-xs tracking-wide">
  <a href="/men" class="text-[#6b6b6b] hover:text-[#1a1a1a]">MEN</a>
  <span class="text-[#e5e5e5]">/</span>
  <a href="/women" class="text-[#1a1a1a] font-medium" aria-current="page">WOMEN</a>
</nav>
```

女性版ページでは `WOMEN` をアクティブ表示、男性版ページでは `MEN` をアクティブ表示する。

## 9. 画像生成フロー

### 9.1 コマンド

```bash
# 女性版 49 枚を生成
npm run generate:women

# 強制再生成
npm run generate:women -- --force

# テスト生成 1 枚
npm run generate:women -- --limit 1
```

### 9.2 実装方針

`scripts/generate-outfits.mjs` に `--women` フラグ（または環境変数 / 直接引数）を追加し、女性版設定で生成する。  
既存の `npm run generate`（男性版）の動作は変えない。

### 9.3 出力サイズ

男性版と同じく `576×1024`（9:16）の WebP とする。  
Gemini から得た画像は `sharp` でクロップ・リサイズする。

## 10. ビルド・デプロイフロー

```bash
# 1. 依存インストール
npm install

# 2. 男性版画像が未生成の場合（通常は済み）
npm run generate

# 3. 女性版画像を生成
npm run generate:women

# 4. 型チェック
npm run check

# 5. ローカル確認
npm run dev

# 6. 本番デプロイ
npm run deploy
```

## 11. 検収チェックリスト

- [ ] `_redirects` が作成され、`/` → `/men` へ 301 リダイレクトされる
- [ ] `/men` で既存の男性版が表示される
- [ ] `/women` で女性版ページが表示される
- [ ] ヘッダーに `MEN / WOMEN` 切り替えリンクが表示される（モバイル含む）
- [ ] 女性版の初期表示が `white blouse + white wide pants` になる
- [ ] 色を切り替えると `/generated/women/{tops}-{pants}.webp` が即座に表示される
- [ ] `generated/women/` に 49 枚の WebP が生成される
- [ ] `generated/women/manifest.json` が正しく出力されている
- [ ] `npm run check` が通る
- [ ] `npm run dev` 後、ブラウザで `/women` の全パターンが表示できる
- [ ] フッターの免責事項が維持されている

## 12. リスクと対策

| リスク | 内容 | 対策 |
| --- | --- | --- |
| URL 変更による既存リンク切れ | `/` から `/men` へリダイレクトするが、念のため確認 | `_redirects` を正しく配置し、デプロイ後に動作確認 |
| 画像パスの重複 | 男性版とファイル名が被る | `generated/women/` サブディレクトリで分離 |
| プロンプトで性別がブレる | Gemini が女性モデルにならない可能性 | `young woman`、`female model` を明確に指定 |
| 頭や足が切れる | 縦長クロップで失われる可能性 | `entire head and hair visible`、`do not crop the head or feet` を維持 |
| 生成コスト増加 | 49 枚追加で API コールが増える | 段階的にテスト生成（`--limit`）してから全量生成 |
| 男性版への影響 | 設定ファイルの共通化が誤って男性版を壊す | 型チェックと `/men` の動作確認を必ず実施 |

## 13. 次のステップ

1. 本仕様（`spec_woman.md`）のレビュー・承認
2. `_redirects` と `men/index.html` の作成
3. `women/index.html` の作成
4. `scripts/outfit-config.mjs` の性別対応拡張
5. `scripts/generate-outfits.mjs` に `--women` 対応を追加
6. `package.json` に `generate:women` スクリプトを追加
7. `npm run generate:women` で 49 枚を生成
8. 動作確認後、`npm run deploy` で本番反映

---

**作成日**: 2026-07-07  
**目的**: FitFlux に `/women` ページを追加し、女性向けコーディネート画像を静的配信する
