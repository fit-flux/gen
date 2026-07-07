# FitFlux 生成画像 再生成計画

## 1. 問題の整理

2026-07-07 に `npm run generate` で生成した 49 枚のうち、以下の品質問題が確認された。

| 問題 | 具体例 | 影響枚数 |
| --- | --- | --- |
| 頭が見切れている | `gray-black.webp`、 `blue-gray.webp`、 `beige-brown.webp`、 `black-green.webp` など | 多数（推定 30 枚以上） |
| 性別が女性になっている | `green-white.webp` | 少なくとも 1 枚、他にも潜在的可能性 |

### 確認したサンプル

- `gray-black.webp`: 額が切れている
- `brown-blue.webp`: 頭全体が入っており OK
- `green-white.webp`: 女性モデルになっている
- `blue-gray.webp`: 顎より上が切れている
- `beige-brown.webp`: 顎より上が切れている
- `black-green.webp`: 顎より上が切れている

## 2. 原因分析

### 2.1 頭が見切れる原因

- Gemini (`gemini-2.5-flash-image`) はおそらく 1024×1024（正方形）で画像を生成する。
- その後、スクリプトが `sharp` で 576×1024（9:16）に **中心クロップ** している。
- 生成画像内の人物が大きく写っている、または上下中央に配置されていない場合、頭頂部や顎が画像外に切れる。
- 現在のプロンプトに「do not crop the head」とは書いているが、実際の生成画像の構図を制御できていない。

### 2.2 性別が女性になる原因

- プロンプトが「a person」（性別不特定）となっており、Gemini が女性モデルを生成した。
- 性別を固定する指定がないため、プロンプトごとに性別がブレる可能性がある。

## 3. 修正方針

### 3.1 プロンプトの改善

`scripts/outfit-config.mjs` の `buildPrompt` を以下のように変更する。

```text
A full-body photo of a young man standing straight, facing the camera, shot from head to toe, wearing a {topsColor} T-shirt and {pantsColor} short chino pants. Summer outfit, clean light background, natural lighting, realistic. Full body, head to toe, entire head and hair visible, do not crop the head or feet, male model.
```

変更点：
- `a person` → `a young man`（性別固定）
- `facing the camera` を追加（正面性強化）
- `entire head and hair visible` を追加（頭の切れ防止）
- `male model` を追加（性別の再確認）
- 背景や照明はシンプルに維持

### 3.2 クロップ処理の改善（プロンプトだけで解決しない場合）

プロンプト改善後も頭が切れる場合、以下の対応を追加する。

#### 案 A: 上部を優先したクロップ

元画像の中心クロップではなく、**人物の頭頂部を画像の上端から 5〜10% の位置に配置するようにクロップ**する。これには顔/頭の位置検出が必要。

#### 案 B: 顔検出ライブラリを使ったスマートクロップ

`@tensorflow-models/blazeface` または `face-api.js` を使い、顔の位置を検出してからクロップ領域を決定する。

- メリット: 頭の切れを大幅に減らせる
- デメリット: 依存が増え、生成時間が長くなる

#### 採用方針

まずは **プロンプト改善のみで再生成** し、改善具合を確認する。それでも頭が切れる枚数が多い場合、**案 B（顔検出スマートクロップ）を導入する**。

## 4. 実装ステップ

### Step 1: プロンプト修正

`scripts/outfit-config.mjs` の `buildPrompt` 関数を更新する。

```js
export function buildPrompt(topsColor, pantsColor) {
  const topsName = ITEM_NAMES.tops;
  const pantsName = ITEM_NAMES.pants;
  return (
    `A full-body photo of a young man standing straight, facing the camera, ` +
    `shot from head to toe, ` +
    `wearing a ${topsColor} ${topsName} and ${pantsColor} ${pantsName}. ` +
    `Summer outfit, clean light background, natural lighting, realistic. ` +
    `Full body, head to toe, entire head and hair visible, ` +
    `do not crop the head or feet, male model.`
  );
}
```

### Step 2: 再生成テスト（サンプル 5〜10 枚）

```bash
npm run generate -- --limit 10 --force
```

生成結果を目視確認し、頭の切れと性別が改善しているかチェックする。

### Step 3: 結果に応じた分岐

#### ケース A: プロンプトだけで解決した場合

```bash
npm run generate -- --force
```

で全 49 枚を再生成する。

#### ケース B: まだ頭が切れる場合

`scripts/generate-outfits.mjs` に顔検出ベースのクロップを導入する。

1. `@tensorflow-models/blazeface` と依存をインストール
2. 生成画像から顔の bounding box を取得
3. 顔の中心を基準に、頭頂部まで含むようクロップ領域を計算
4. 576×1024 にリサイズ

### Step 4: 全量検証

再生成後、以下を確認する。

- `generated/` に 49 枚の WebP が存在する
- 画像サイズがすべて 576×1024
- 性別がすべて男性
- 頭が見切れていない（目視 or 自動チェック）
- `npm run check` が通る
- ローカルサーバーで 49 パターンすべて表示できる

## 5. 自動検出スクリプト（オプション）

再生成後に「頭が見切れている画像」を自動で検出するには、顔検出を使う。

```bash
node scripts/validate-faces.mjs
```

このスクリプトは各画像で顔を検出し、顔が画像上半分に十分に収まっているか判定する。顔が検出できない、または上端に近すぎる画像をリストアップする。

## 6. リスクと対策

| リスク | 対策 |
| --- | --- |
| プロンプト変更後も頭が切れる | 顔検出スマートクロップを導入 |
| 顔検出ライブラリの依存が重い | 必要な場合のみ導入し、生成スクリプトから分離する |
| 再生成コスト | 段階的にテストしてから全量生成 |
| 男性指定しても女性になる | `young man` + `male model` + `short hair` などを重ねがけ |

## 7. 次のアクション

1. `scripts/outfit-config.mjs` のプロンプトを修正
2. `npm run generate -- --limit 10 --force` でサンプル再生成
3. 目視確認後、全量再生成 or 顔検出クロップ導入を決定
4. 最終検証

---

**作成日**: 2026-07-07
**目的**: 頭の切れと性別ブレを解消するための再生成計画
