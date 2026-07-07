/**
 * 衣装生成の単一情報源。
 * フロントエンドと生成スクリプトの両方から参照する。
 */

export const CATEGORIES = [
  { key: 'tops', label: 'トップス', value: 'T-shirt' },
  { key: 'pants', label: 'パンツ', value: 'short chino pants' },
];

export const DEFAULT_COLORS = {
  tops: 'white',
  pants: 'white',
};

export const COLORS = [
  { value: 'white', label: '白' },
  { value: 'gray', label: 'グレー' },
  { value: 'beige', label: 'カーキ' },
  { value: 'brown', label: '茶' },
  { value: 'black', label: '黒' },
  { value: 'blue', label: '青' },
  { value: 'green', label: '緑' },
];

/**
 * カテゴリ値を使った、人が読みやすい衣装名マッピング。
 * プロンプト構築で使用。
 */
export const ITEM_NAMES = {
  tops: 'T-shirt',
  pants: 'short chino pants',
};

/**
 * 全組み合わせを返す。
 * @returns {Array<{topsColor: string, pantsColor: string}>}
 */
export function getAllCombinations() {
  const combinations = [];
  for (const tops of COLORS) {
    for (const pants of COLORS) {
      combinations.push({ topsColor: tops.value, pantsColor: pants.value });
    }
  }
  return combinations;
}

/**
 * 画像ファイル名を返す。
 * @param {string} topsColor
 * @param {string} pantsColor
 * @returns {string}
 */
export function getFileName(topsColor, pantsColor) {
  return `${topsColor}-${pantsColor}.webp`;
}

/**
 * プロンプトを構築する。
 * @param {string} topsColor
 * @param {string} pantsColor
 * @returns {string}
 */
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
