// Auto-moderation: text content filtering
// Checks for NSFW/inappropriate content in messages and posts

const BLOCKED_PATTERNS: RegExp[] = [
  // Explicit sexual content
  /\bp[o0]rn\b/i, /\bhentai\b/i, /\bxxx\b/i, /\bnsfw\b/i,
  /\bnude[s]?\b/i, /\bnaked\b/i, /\bsex\s?tape\b/i,
  /\bf[u\*]ck\s?(me|her|him|them)\b/i,
  /\bd[i1]ck\s?pic/i, /\btit\s?pic/i,
  /\bonlyfans\b/i, /\bescort\b/i,
  // Extreme slurs and hate speech
  /\bn[i1]gg[e3]r/i, /\bfagg[o0]t/i, /\bk[i1]ke\b/i, /\bch[i1]nk\b/i,
  // Violence/threats
  /\bk[i1]ll\s?(your|my|him|her)self\b/i,
  /\bshoot\s?up\b/i, /\bbomb\s?threat\b/i,
  // Spam/scam patterns
  /\bfree\s?v-?bucks\b/i, /\bfree\s?robux\b/i,
  /\bclaim\s?your\s?prize\b/i,
];

const FLAGGED_PATTERNS: RegExp[] = [
  // Potentially inappropriate (flag for review, don't block)
  /\bwtf\b/i, /\bstfu\b/i, /\blmao\b/i,
  /\bass\b/i, /\bdamn\b/i, /\bhell\b/i,
  /\bsh[i1]t\b/i, /\bf+u+c+k+\b/i,
  /\bb[i1]tch\b/i, /\bwh[o0]re\b/i,
];

export interface ModResult {
  blocked: boolean;
  flagged: boolean;
  reason: string | null;
}

export function checkContent(text: string | null | undefined): ModResult {
  if (!text) return { blocked: false, flagged: false, reason: null };

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, flagged: true, reason: 'Content violates community guidelines' };
    }
  }

  for (const pattern of FLAGGED_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: false, flagged: true, reason: 'auto-flagged' };
    }
  }

  return { blocked: false, flagged: false, reason: null };
}

// Check if a URL looks like it could be NSFW based on domain patterns
export function checkUrl(url: string | null | undefined): ModResult {
  if (!url) return { blocked: false, flagged: false, reason: null };
  const nsfw = /porn|xxx|nsfw|onlyfans|xvideos|xnxx|redtube|youporn/i;
  if (nsfw.test(url)) {
    return { blocked: true, flagged: true, reason: 'NSFW link detected' };
  }
  return { blocked: false, flagged: false, reason: null };
}
