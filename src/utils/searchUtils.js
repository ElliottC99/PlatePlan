/**
 * src/utils/searchUtils.js
 * Universal partial-token, diacritic-insensitive, and typo-tolerant search utility.
 * Shared across Vault, Pantry Bank, Product Bank, Planner, Recipe Wizard, and Data Quality pickers.
 */

/**
 * Normalizes text for search: lowercase, strip diacritics/accents, replace punctuation with spaces.
 * @param {string} str
 * @returns {string}
 */
export function normalizeSearchText(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Splits a search query into normalized tokens.
 * @param {string} query
 * @returns {string[]}
 */
export function tokenizeSearchQuery(query) {
  const norm = normalizeSearchText(query);
  return norm ? norm.split(' ') : [];
}

/**
 * Returns true if strings `a` and `b` are within Damerau-Levenshtein edit distance 1
 * (at most 1 insertion, deletion, substitution, or adjacent transposition). Zero allocations.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function isWithinEditDistance1(a, b) {
  const lenA = a.length;
  const lenB = b.length;
  if (a === b) return true;
  const diff = lenA - lenB;
  if (diff > 1 || diff < -1) return false;

  if (diff === 0) {
    let mismatches = 0;
    for (let i = 0; i < lenA; i++) {
      if (a.charCodeAt(i) !== b.charCodeAt(i)) {
        // Check adjacent transposition (e.g. "tofu" vs "touf")
        if (
          mismatches === 0 &&
          i + 1 < lenA &&
          a.charCodeAt(i) === b.charCodeAt(i + 1) &&
          a.charCodeAt(i + 1) === b.charCodeAt(i)
        ) {
          mismatches++;
          i++; // skip swapped partner
          continue;
        }
        mismatches++;
        if (mismatches > 1) return false;
      }
    }
    return mismatches <= 1;
  }

  // Ensure `shorter` has length N and `longer` has length N + 1
  const shorter = diff < 0 ? a : b;
  const longer = diff < 0 ? b : a;
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < shorter.length && j < longer.length) {
    if (shorter.charCodeAt(i) === longer.charCodeAt(j)) {
      i++;
      j++;
    } else {
      if (skipped) return false;
      skipped = true;
      j++;
    }
  }
  return true;
}

function scoreSingleToken(token, normText, words) {
  if (normText.includes(token)) {
    for (let i = 0; i < words.length; i++) {
      if (words[i] === token) return 100;
    }
    for (let i = 0; i < words.length; i++) {
      if (words[i].startsWith(token)) return 80;
    }
    return 55;
  }

  // Allow 1-character typo tolerance only for tokens of 4+ chars to prevent short-word noise
  if (token.length < 4) return 0;

  let bestTypo = 0;
  const tLen = token.length;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.length < 3) continue;
    if (Math.abs(w.length - tLen) <= 1 && isWithinEditDistance1(token, w)) {
      return 35;
    }
    if (w.length > tLen) {
      if (
        isWithinEditDistance1(token, w.slice(0, tLen)) ||
        (w.length >= tLen + 1 && isWithinEditDistance1(token, w.slice(0, tLen + 1)))
      ) {
        bestTypo = 25;
      }
    }
  }
  return bestTypo;
}

/**
 * Scores how well `queryOrTokens` matches `target` (string or array of field strings).
 * Returns 0 if any query token fails to match, or a positive relevance score (higher = better).
 * @param {string|string[]} queryOrTokens
 * @param {string|string[]} target
 * @param {string} [preNormalizedTarget]
 * @returns {number}
 */
export function scoreSearchMatch(queryOrTokens, target, preNormalizedTarget = null) {
  const tokens = Array.isArray(queryOrTokens) ? queryOrTokens : tokenizeSearchQuery(queryOrTokens);
  if (tokens.length === 0) return 1;

  const normText = preNormalizedTarget !== null
    ? preNormalizedTarget
    : normalizeSearchText(Array.isArray(target) ? target.filter(Boolean).join(' ') : target);
  if (!normText) return 0;

  const words = normText.split(' ');
  let totalScore = 0;

  for (let i = 0; i < tokens.length; i++) {
    const s = scoreSingleToken(tokens[i], normText, words);
    if (s === 0) return 0;
    totalScore += s;
  }

  let avg = totalScore / tokens.length;
  const phrase = tokens.join(' ');
  if (normText === phrase) {
    avg += 25;
  } else if (normText.startsWith(phrase)) {
    avg += 20;
  } else if (tokens.length > 1 && normText.includes(phrase)) {
    avg += 15;
  }
  return avg;
}

/**
 * Boolean convenience wrapper around `scoreSearchMatch`.
 * @param {string|string[]} queryOrTokens
 * @param {string|string[]} target
 * @param {string} [preNormalizedTarget]
 * @returns {boolean}
 */
export function matchesSearchQuery(queryOrTokens, target, preNormalizedTarget = null) {
  return scoreSearchMatch(queryOrTokens, target, preNormalizedTarget) > 0;
}

/**
 * Filters and ranks an array of items by search relevance (exact > prefix > substring > typo),
 * preserving original order on ties.
 * @template T
 * @param {T[]} items
 * @param {string} query
 * @param {(item: T) => string|string[]} getSearchText
 * @returns {T[]}
 */
export function filterAndRankBySearch(items, query, getSearchText) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return items;

  const scored = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const score = scoreSearchMatch(tokens, getSearchText(item));
    if (score > 0) {
      scored.push({ item, score, idx: i });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.map(entry => entry.item);
}
