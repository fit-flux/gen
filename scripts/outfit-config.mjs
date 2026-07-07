/**
 * 衣装生成の単一情報源。
 * フロントエンドと生成スクリプトの両方から参照する。
 */

/** @typedef {'men' | 'women'} Gender */

const COMMON_COLORS = [
  { value: 'white', label: '白' },
  { value: 'gray', label: 'グレー' },
  { value: 'beige', label: 'カーキ' },
  { value: 'brown', label: '茶' },
  { value: 'black', label: '黒' },
  { value: 'blue', label: '青' },
  { value: 'green', label: '緑' },
];

const MEN_CONFIG = {
  categories: [
    { key: 'tops', label: 'トップス', value: 'T-shirt' },
    { key: 'pants', label: 'パンツ', value: 'short chino pants' },
  ],
  defaultColors: { tops: 'white', pants: 'white' },
  colors: COMMON_COLORS,
  itemNames: { tops: 'T-shirt', pants: 'short chino pants' },
  subject: 'a young man',
  modelHint: 'male model',
  outputSubDir: '',
};

const WOMEN_CONFIG = {
  categories: [
    { key: 'tops', label: 'トップス', value: 'short sleeve blouse' },
    { key: 'pants', label: 'パンツ', value: 'wide pants' },
  ],
  defaultColors: { tops: 'white', pants: 'white' },
  colors: COMMON_COLORS,
  itemNames: { tops: 'short sleeve blouse', pants: 'wide pants' },
  subject: 'a young woman',
  modelHint: 'female model',
  outputSubDir: 'women',
};

/**
 * 性別に応じた設定オブジェクトを返す。
 * @param {Gender} gender
 * @returns {typeof MEN_CONFIG}
 */
export function getConfig(gender) {
  return gender === 'women' ? WOMEN_CONFIG : MEN_CONFIG;
}

/**
 * @param {Gender} gender
 */
function normalizeGender(gender) {
  return gender === 'women' ? 'women' : 'men';
}

// --- 後方互換: 既存の index.html やスクリプト用に men 用の export を維持 ---

export const CATEGORIES = MEN_CONFIG.categories;
export const DEFAULT_COLORS = MEN_CONFIG.defaultColors;
export const COLORS = MEN_CONFIG.colors;

/**
 * カテゴリ値を使った、人が読みやすい衣装名マッピング。
 * プロンプト構築で使用。
 */
export const ITEM_NAMES = MEN_CONFIG.itemNames;

/**
 * 全組み合わせを返す。
 * @param {Gender} [gender='men']
 * @returns {Array<{topsColor: string, pantsColor: string}>}
 */
export function getAllCombinations(gender = 'men') {
  const config = getConfig(normalizeGender(gender));
  const combinations = [];
  for (const tops of config.colors) {
    for (const pants of config.colors) {
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
 * 性別を指定して画像ファイル名を返す。
 * @param {Gender} gender
 * @param {string} topsColor
 * @param {string} pantsColor
 * @returns {string}
 */
export function getFileNameForGender(gender, topsColor, pantsColor) {
  const base = getFileName(topsColor, pantsColor);
  const config = getConfig(normalizeGender(gender));
  return config.outputSubDir ? `${config.outputSubDir}/${base}` : base;
}

/**
 * プロンプトを構築する。
 * @param {string} topsColor
 * @param {string} pantsColor
 * @returns {string}
 */
export function buildPrompt(topsColor, pantsColor) {
  return buildPromptForGender('men', topsColor, pantsColor);
}

/**
 * 性別を指定してプロンプトを構築する。
 * @param {Gender} gender
 * @param {string} topsColor
 * @param {string} pantsColor
 * @returns {string}
 */
export function buildPromptForGender(gender, topsColor, pantsColor) {
  const config = getConfig(normalizeGender(gender));
  const topsName = config.itemNames.tops;
  const pantsName = config.itemNames.pants;
  return (
    `A full-body photo of ${config.subject} standing straight, facing the camera, ` +
    `shot from head to toe, ` +
    `wearing a ${topsColor} ${topsName} and ${pantsColor} ${pantsName}. ` +
    `Summer outfit, clean light background, natural lighting, realistic. ` +
    `Full body, head to toe, entire head and hair visible, ` +
    `do not crop the head or feet, ${config.modelHint}.`
  );
}
