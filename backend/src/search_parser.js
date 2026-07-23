export function parseSearchQuery(query) {
  const filters = {};
  let general = query;

  const tagMatch = general.match(/tag:(?:"([^"]+)"|(\S+))/i);
  if (tagMatch) {
    filters.tag = tagMatch[1] || tagMatch[2];
    general = general.replace(tagMatch[0], '');
  }

  const authorMatch = general.match(/author:(?:"([^"]+)"|(\S+))/i);
  if (authorMatch) {
    filters.author = authorMatch[1] || authorMatch[2];
    general = general.replace(authorMatch[0], '');
  }

  const yearMatch = general.match(/year:(\d{4})/i);
  if (yearMatch) {
    filters.year = yearMatch[1];
    general = general.replace(yearMatch[0], '');
  }

  return {
    general: general.trim(),
    filters
  };
}
