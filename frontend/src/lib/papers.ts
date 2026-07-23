import type { Paper, SearchFilters, TagCount } from '@/types/paper';

const NOISE_TAGS = ['World Models', 'Model-Based RL'];

export function filterNoiseTags(papers: Paper[]): Paper[] {
  return papers.map((paper) => ({
    ...paper,
    tags: paper.tags?.filter((tag) => !NOISE_TAGS.includes(tag))
  }));
}

export function buildTagCounts(papers: Paper[]): TagCount[] {
  const tagCounts: Record<string, number> = {};

  papers.forEach((paper) => {
    (paper.tags || []).forEach((tag) => {
      if (NOISE_TAGS.includes(tag)) {
        return;
      }
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function normalizeTagCounts(rawTags: Array<TagCount | string>): TagCount[] {
  return rawTags
    .filter((tag) => tag && (typeof tag === 'string' ? tag.trim() : tag.tag && tag.tag.trim()))
    .map((tag) =>
      typeof tag === 'string'
        ? { tag, count: 0 }
        : { tag: tag.tag, count: Number(tag.count) }
    )
    .filter(({ tag }) => !NOISE_TAGS.includes(tag));
}

export function parseSearchQuery(query: string): { general: string; filters: SearchFilters } {
  const filters: SearchFilters = {};
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

export function buildBibtex(paper: Paper): string {
  const year = new Date(paper.publication_date).getFullYear();
  const authors = paper.authors || [];
  const firstAuthor = authors.length > 0 ? authors[0].split(' ').pop() || 'Author' : 'Author';
  const titleSlug = paper.title
    .replace(/\s+/g, '_')
    .substring(0, 20)
    .replace(/[^a-zA-Z0-9_]/g, '');

  let arxivId = paper.url.split('/').pop()?.replace('.pdf', '') || '';
  if (!arxivId && paper.url.includes('arxiv.org/abs/')) {
    arxivId = paper.url.split('arxiv.org/abs/').pop() || '';
  }

  return `@article{${firstAuthor}${year}${titleSlug},
  title={${paper.title}},
  author={${authors.join(' and ')}},
  journal={arXiv preprint arXiv:${arxivId}},
  year={${year}},
  url={${paper.url}}
}`;
}

export function getPaginationPages(currentPage: number, totalPages: number): Array<number | string> {
  const pageNumbers: Array<number | string> = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) {
      pageNumbers.push(i);
    }
    return pageNumbers;
  }

  pageNumbers.push(1);

  let startPage = Math.max(2, currentPage - 1);
  let endPage = Math.min(totalPages - 1, currentPage + 1);

  if (currentPage <= 3) {
    endPage = 4;
  }

  if (currentPage >= totalPages - 2) {
    startPage = totalPages - 3;
  }

  if (startPage > 2) {
    pageNumbers.push('...');
  }

  for (let i = startPage; i <= endPage; i += 1) {
    if (i > 1 && i < totalPages) {
      pageNumbers.push(i);
    }
  }

  if (endPage < totalPages - 1) {
    pageNumbers.push('...');
  }

  pageNumbers.push(totalPages);
  return pageNumbers;
}
