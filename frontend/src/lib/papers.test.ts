import { describe, expect, it } from 'vitest';
import {
  buildBibtex,
  buildTagCounts,
  filterNoiseTags,
  getPaginationPages,
  parseSearchQuery
} from '@/lib/papers';
import type { Paper } from '@/types/paper';

const samplePaper: Paper = {
  id: 1,
  title: 'Robot Policy Learning with World Models',
  authors: ['Alice Smith', 'Bob Lee'],
  abstract: 'A sample abstract.',
  publication_date: '2025-02-01',
  url: 'https://arxiv.org/abs/2502.12345',
  tags: ['Robotics', 'World Models', 'Planning']
};

describe('papers utilities', () => {
  it('parses search query filters and remaining keywords', () => {
    expect(
      parseSearchQuery('diffusion policy tag:Robotics author:"Alice Smith" year:2025')
    ).toEqual({
      general: 'diffusion policy',
      filters: {
        tag: 'Robotics',
        author: 'Alice Smith',
        year: '2025'
      }
    });
  });

  it('removes noise tags from papers', () => {
    expect(filterNoiseTags([samplePaper])[0].tags).toEqual(['Robotics', 'Planning']);
  });

  it('builds sorted tag counts without noise tags', () => {
    expect(buildTagCounts([samplePaper, { ...samplePaper, id: 2, tags: ['Planning'] }])).toEqual([
      { tag: 'Planning', count: 2 },
      { tag: 'Robotics', count: 1 }
    ]);
  });

  it('builds bibtex entries from paper metadata', () => {
    const bibtex = buildBibtex(samplePaper);

    expect(bibtex).toContain('@article{Smith2025Robot_Policy_Learnin');
    expect(bibtex).toContain('journal={arXiv preprint arXiv:2502.12345}');
    expect(bibtex).toContain('author={Alice Smith and Bob Lee}');
  });

  it('builds compact pagination for long result sets', () => {
    expect(getPaginationPages(5, 10)).toEqual([1, '...', 4, 5, 6, '...', 10]);
    expect(getPaginationPages(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});
