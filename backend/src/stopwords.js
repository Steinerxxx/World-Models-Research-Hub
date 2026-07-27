// Only truly useless words (articles, prepositions, pronouns, common verbs).
// Domain words like "learning", "model", "network" etc. are NOT here —
// they are meaningful in research contexts and should remain as keywords.
export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from',
  'and', 'or', 'not', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could',
  'may', 'might', 'must', 'shall', 'should', 'it', 'its', 'this', 'that',
  'these', 'those', 'about', 'into', 'over', 'such', 'only', 'than', 'then',
  'also', 'very', 'just', 'but', 'if', 'so', 'no', 'as', 'up', 'out', 'all',
  'papers', 'paper',
]);

// Strip common query wrapper phrases before extracting keywords.
// e.g. "papers of X" → "X", "find me papers about X" → "X"
export function stripQueryWrappers(text) {
  return text
    .replace(/^papers?\s+(of|about|on|related\s+to|regarding)\s+/i, '')
    .replace(/^find\s+(me\s+)?(some\s+)?papers?\s+(about|on|related\s+to\s+)?/i, '')
    .replace(/^search\s+(for\s+)?/i, '')
    .replace(/^looking\s+(for\s+)?/i, '')
    .replace(/^(show|tell|give)\s+(me\s+)?\s*(about\s+)?/i, '')
    .replace(/^i\s+(want|need|am\s+looking\s+for)\s+(to\s+(find|search)\s+)?(papers?\s+)?(about|on)?\s*/i, '')
    .replace(/^what\s+(are|is)\s+(the\s+)?(latest\s+)?(papers?\s+)?(about|on)?\s*/i, '')
    .trim();
}

export function extractKeywords(text) {
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
  return [...new Set(words)];
}
