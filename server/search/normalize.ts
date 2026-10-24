/**
 * Name normalisation for Indian shareholder registries.
 *
 * The registers were typed by different registrars over ~25 years, so the
 * same person appears as "SHRI RAKESH KR. SHARMA", "Rakesh Kumar Sharma",
 * "SHARMA RAKESH K" or "RAKESH KUMAR SHARMA S/O RAM SHARMA". Everything
 * here is deterministic, cheap, and used on BOTH the typed query and the
 * database candidates so that both sides are compared on equal footing.
 */

export interface ParsedName {
  /** The original string as received. */
  raw: string;
  /** lower-case, punctuation stripped, honorifics removed, single-spaced. */
  normalized: string;
  /** Every remaining token (initials included), abbreviations expanded. */
  tokens: string[];
  /** Tokens with >= 3 letters — the only ones worth sending to the trigram index. */
  longTokens: string[];
  /** Single-letter tokens such as "r" and "k" in "r k sharma". */
  initials: string[];
  /** Honorifics / noise words that were removed (for explanations). */
  removed: string[];
  /** Text after S/O, W/O, D/O, C/O … (father / husband / guardian part). */
  relationPart: string | null;
}

/** Titles that only ever appear at the START of a name. */
const LEADING_HONORIFICS = new Set([
  'mr', 'mrs', 'ms', 'miss', 'mx', 'dr', 'prof', 'er', 'adv', 'capt', 'col', 'maj', 'lt', 'gen',
  'shri', 'shree', 'sri', 'sree', 'sh', 'smt', 'srimati', 'shrimati', 'smti', 'kumari', 'km', 'ku',
  'master', 'mast', 'late', 'sardar', 'sardarni', 'janab', 'begum', 'baby', 'm/s', 'ms.',
]);

/** Noise words that can appear anywhere and never help identify a person. */
const NOISE_ANYWHERE = new Set([
  'huf', 'minor', 'jt', 'joint', 'through', 'thru', 'guardian', 'gaurdian', 'nominee', 'legal', 'heir',
  'and', '&', 'the', 'estate', 'of', 'deceased', 'decd', 'exp', 'expired', 'trust', 'trustee', 'trustees',
]);

/** Common registrar abbreviations → the word they stand for. */
const ALIASES: Record<string, string> = {
  kr: 'kumar',
  kum: 'kumar',
  md: 'mohammed',
  mohd: 'mohammed',
  mohmd: 'mohammed',
  mohammad: 'mohammed',
  muhammad: 'mohammed',
  muhammed: 'mohammed',
  mohamed: 'mohammed',
  pd: 'prasad',
  ch: 'chandra',
  sk: 'sheikh',
  shaikh: 'sheikh',
  shaik: 'sheikh',
  shek: 'sheikh',
  pr: 'prasad',
  dev: 'dev',
  nr: 'narayan',
};

/** "S/O RAM SHARMA", "W/O ...", "D/O ...", "C/O ...", "SON OF ...". */
const RELATION_SPLIT = /\b(?:s\/o|w\/o|d\/o|c\/o|h\/o|so\b|wo\b|do\b|son of|wife of|daughter of|care of|c\/\s*o)\b/i;

export function parseName(raw: string): ParsedName {
  const original = String(raw ?? '');
  let text = original.toLowerCase();

  // 1. Pull off the relationship part ("s/o ram sharma") — it is not the holder's name.
  let relationPart: string | null = null;
  const rel = text.search(RELATION_SPLIT);
  if (rel > 0) {
    relationPart = text.slice(rel).replace(RELATION_SPLIT, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim() || null;
    text = text.slice(0, rel);
  }

  // 2. Punctuation → spaces; keep only letters and spaces (digits are folio noise).
  text = text
    .replace(/[‘’'`"]/g, '')          // apostrophes/quotes: d'souza → dsouza
    .replace(/[^a-z\s]/g, ' ')                   // everything else (dots, commas, digits, slashes) → space
    .replace(/\s+/g, ' ')
    .trim();

  const removed: string[] = [];
  let tokens = text.split(' ').filter(Boolean);

  // 3. Leading honorifics, repeatedly ("shri dr rakesh ..."), but never the only token.
  while (tokens.length > 1 && LEADING_HONORIFICS.has(tokens[0])) {
    removed.push(tokens.shift() as string);
  }

  // 4. Noise anywhere.
  tokens = tokens.filter((t) => {
    if (NOISE_ANYWHERE.has(t)) { removed.push(t); return false; }
    return true;
  });

  // 5. Expand abbreviations; split glued initials ("vk" → "v", "k").
  const expanded: string[] = [];
  for (const t of tokens) {
    if (ALIASES[t]) { expanded.push(ALIASES[t]); continue; }
    if (t.length === 2 && !/[aeiou]/.test(t)) { expanded.push(t[0], t[1]); continue; }
    expanded.push(t);
  }
  tokens = expanded;

  // 6. Drop a trailing stray initial that is just the first letter of the previous word
  //    ("rakesh kumar k" from "RAKESH KUMAR K." is almost always a registrar artefact).
  if (tokens.length >= 3 && tokens[tokens.length - 1].length === 1) {
    const last = tokens[tokens.length - 1];
    if (tokens.slice(0, -1).some((t) => t[0] === last && t.length > 1)) {
      removed.push(tokens.pop() as string);
    }
  }

  const normalized = tokens.join(' ');
  return {
    raw: original,
    normalized,
    tokens,
    longTokens: tokens.filter((t) => t.length >= 3),
    initials: tokens.filter((t) => t.length === 1),
    removed,
    relationPart,
  };
}

/**
 * A sound-alike key tuned for Indian names written in English.
 * Soundex-style consonant skeleton with transliteration digraphs folded first,
 * so Mohammed/Mohamed/Muhammad → "mhmd", Lakshmi/Laxmi → "lksm",
 * Agarwal/Agrawal/Aggarwal → "agrvl", Rakesh/Rakes → "rks", Sunil/Suneel → "snl".
 */
export function phoneticKey(token: string): string {
  let s = (token || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return '';
  s = s
    .replace(/ck/g, 'k')
    .replace(/chh/g, 'c').replace(/ch/g, 'c')
    .replace(/sh/g, 's')
    .replace(/ph/g, 'f')
    .replace(/th/g, 't').replace(/dh/g, 'd').replace(/bh/g, 'b').replace(/gh/g, 'g').replace(/kh/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/q/g, 'k')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/y/g, 'i');
  const first = s[0];
  const rest = s.slice(1).replace(/[aeiouh]/g, '');
  let out = first + rest;
  out = out.replace(/(.)\1+/g, '$1'); // collapse doubles (aggarval → agarval)
  return out;
}

/** Standard Jaro-Winkler similarity, 0..1. Rewards shared prefixes — good for short name tokens. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;
  const window = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const aM = new Array<boolean>(la).fill(false);
  const bM = new Array<boolean>(lb).fill(false);
  let matches = 0;
  for (let i = 0; i < la; i++) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(lb - 1, i + window);
    for (let j = lo; j <= hi; j++) {
      if (!bM[j] && a[i] === b[j]) { aM[i] = true; bM[j] = true; matches++; break; }
    }
  }
  if (!matches) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!aM[i]) continue;
    while (!bM[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const m = matches;
  const jaro = (m / la + m / lb + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, la, lb); i++) {
    if (a[i] === b[i]) prefix++; else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Canonical state string for comparisons ("TAMILNADU", "Tamil Nadu " → "tamil nadu"). */
export function normalizeState(s: string | null | undefined): string {
  const x = String(s ?? '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const canon: Record<string, string> = {
    tamilnadu: 'tamil nadu',
    'new delhi': 'delhi',
    'nct of delhi': 'delhi',
    orissa: 'odisha',
    pondicherry: 'puducherry',
    chattisgarh: 'chhattisgarh',
    uttaranchal: 'uttarakhand',
    'jammu kashmir': 'jammu and kashmir',
    'jammu & kashmir': 'jammu and kashmir',
    bengaluru: 'karnataka',
    bombay: 'maharashtra',
  };
  return canon[x] || x;
}
