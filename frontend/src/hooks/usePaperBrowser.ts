import { useMemo, useState } from 'react';
import { buildBibtex, parseSearchQuery } from '@/lib/papers';
import type { Paper } from '@/types/paper';

interface UsePaperBrowserOptions {
  papers: Paper[];
  searchTerm: string;
  highlightTerm?: string;
  selectedTags: string[];
  itemsPerPage: number;
  sortBy: string;
  favorites: number[];
  showFavoritesOnly: boolean;
  disableTextSearch?: boolean;
  preserveOrder?: boolean;
}

export function usePaperBrowser({
  papers,
  searchTerm,
  highlightTerm,
  selectedTags,
  itemsPerPage,
  sortBy,
  favorites,
  showFavoritesOnly,
  disableTextSearch = false,
  preserveOrder = false
}: UsePaperBrowserOptions) {
  const pageScope = useMemo(() => JSON.stringify({
    searchTerm,
    selectedTags,
    itemsPerPage,
    sortBy,
    showFavoritesOnly
  }), [itemsPerPage, searchTerm, selectedTags, showFavoritesOnly, sortBy]);
  const [pageState, setPageState] = useState(() => ({
    page: 1,
    scope: pageScope
  }));
  const [inputPage, setInputPage] = useState('');

  const { general: searchGeneral, filters: searchFilters } = useMemo(
    () => parseSearchQuery(searchTerm),
    [searchTerm]
  );

  const allHighlights = useMemo(() => {
    const baseHighlight = highlightTerm ?? searchGeneral.trim();
    const highlights = baseHighlight ? [baseHighlight] : [];
    if (searchFilters.author) {
      highlights.push(searchFilters.author);
    }
    if (searchFilters.tag) {
      highlights.push(searchFilters.tag);
    }
    return [...highlights, ...selectedTags];
  }, [highlightTerm, searchFilters.author, searchFilters.tag, searchGeneral, selectedTags]);

  const filteredPapers = useMemo(() => {
    return papers
      .filter((paper) => {
        if (showFavoritesOnly && !favorites.includes(paper.id)) {
          return false;
        }

        if (searchFilters.tag) {
          const hasTag = paper.tags?.some((tag) =>
            tag.toLowerCase().includes(searchFilters.tag!.toLowerCase())
          );
          if (!hasTag) {
            return false;
          }
        }

        if (searchFilters.author) {
          const hasAuthor = paper.authors.some((author) =>
            author.toLowerCase().includes(searchFilters.author!.toLowerCase())
          );
          if (!hasAuthor) {
            return false;
          }
        }

        if (searchFilters.year) {
          const year = new Date(paper.publication_date).getFullYear().toString();
          if (year !== searchFilters.year) {
            return false;
          }
        }

        const trimmedSearch = disableTextSearch ? '' : searchGeneral.trim();
        if (!trimmedSearch) {
          return selectedTags.length > 0 ? selectedTags.every((tag) => paper.tags?.includes(tag)) : true;
        }

        const escaped = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let patternStr = escaped;
        if (/^\w/.test(trimmedSearch)) {
          patternStr = `\\b${patternStr}`;
        }
        if (/\w$/.test(trimmedSearch)) {
          patternStr = `${patternStr}\\b`;
        }

        const termPattern = new RegExp(patternStr, 'i');
        const matchesPhrase =
          termPattern.test(paper.title) ||
          termPattern.test(paper.authors.join(' ')) ||
          termPattern.test(paper.abstract);

        const tagMatch =
          selectedTags.length > 0 ? selectedTags.every((tag) => paper.tags?.includes(tag)) : true;

        return matchesPhrase && tagMatch;
      })
      .sort((a, b) => {
        if (preserveOrder) return 0;
        if (sortBy === 'oldest') {
          return new Date(a.publication_date).getTime() - new Date(b.publication_date).getTime();
        }
        return new Date(b.publication_date).getTime() - new Date(a.publication_date).getTime();
      });
  }, [disableTextSearch, favorites, papers, preserveOrder, searchFilters.author, searchFilters.tag, searchFilters.year, searchGeneral, selectedTags, showFavoritesOnly, sortBy]);

  const totalPages = Math.ceil(filteredPapers.length / itemsPerPage);
  const safeCurrentPage = useMemo(() => {
    const nextPage = pageState.scope === pageScope ? pageState.page : 1;
    return Math.min(nextPage, Math.max(totalPages, 1));
  }, [pageScope, pageState.page, pageState.scope, totalPages]);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentPapers = filteredPapers.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    setPageState({
      page,
      scope: pageScope
    });
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGoToPage = () => {
    const pageNumber = Number.parseInt(inputPage, 10);
    if (!Number.isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
      handlePageChange(pageNumber);
      setInputPage('');
    }
  };

  const copyBibTeX = async (paper: Paper) => {
    try {
      const bibtex = buildBibtex(paper);

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(bibtex);
        return true;
      }

      const textArea = document.createElement('textarea');
      textArea.value = bibtex;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Copy failed:', err);
      return false;
    }
  };

  return {
    allHighlights,
    currentPage: safeCurrentPage,
    currentPapers,
    filteredPapers,
    inputPage,
    setInputPage,
    totalPages,
    handleGoToPage,
    handlePageChange,
    copyBibTeX
  };
}
