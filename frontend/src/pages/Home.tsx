import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, RefreshCw, ChevronLeft, ChevronRight, X, Star, AlertTriangle } from "lucide-react";
import { useFilter } from '@/contexts/FilterContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { PaperCard } from '@/components/PaperCard';

import { API_BASE_URL } from '@/config';
import { MOCK_PAPERS } from '@/data/mockData';

// Define the type for a single paper
interface Paper {
  id: number;
  title: string;
  authors: string[];
  abstract: string;
  publication_date: string;
  url: string;
  tags?: string[];
  summary?: string;
  contribution?: string;
  limitations?: string;
}

export default function Home() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [fetchErrorDetail, setFetchErrorDetail] = useState<string>('');

  // Use context for filters
  const { searchTerm, setSearchTerm, selectedTag, setSelectedTag, itemsPerPage, sortBy } = useFilter();
  const { favorites, showFavoritesOnly, setShowFavoritesOnly } = useFavorites();
  
  // Local state for debounced search to prevent lag
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);

  // Sync local state when context changes (e.g. when cleared via button)
  useEffect(() => {
    setLocalSearchTerm(searchTerm);
  }, [searchTerm]);

  // Debounce search updates
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearchTerm !== searchTerm) {
        setSearchTerm(localSearchTerm);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [localSearchTerm, setSearchTerm, searchTerm]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [inputPage, setInputPage] = useState('');
  // itemsPerPage is now controlled by FilterContext

  const fetchPapers = () => {
    setLoading(true);
    setFetchErrorDetail('');
    
    console.log(`[Debug] Fetching from: ${API_BASE_URL}/api/papers`);
    
    fetch(`${API_BASE_URL}/api/papers`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        // Filter out common tags that appear in almost all papers to reduce noise
        const processedData = data.map((paper: Paper) => ({
          ...paper,
          tags: paper.tags?.filter(tag => 
            !['World Models', 'Model-Based RL'].includes(tag)
          )
        }));
        setPapers(processedData);
        setUsingMockData(false);
        setLoading(false);
      })
      .catch(error => {
        console.warn('Backend fetch failed, switching to Mock Data:', error);
        setFetchErrorDetail(error.message || 'Unknown Network Error');
        // Fallback to mock data
        setPapers(MOCK_PAPERS);
        setUsingMockData(true);
        setError(null); // Clear error to show content
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetch(`${API_BASE_URL}/api/scrape`, {
      method: 'POST',
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch new papers');
        }
        return response.json();
      })
      .then(() => {
        // After scraping, fetch the updated list of papers
        fetchPapers();
      })
      .catch(err => {
        console.error('Error scraping papers:', err);
        // Still try to fetch papers even if scrape fails, to ensure we show what we have
        fetchPapers(); 
      })
      .finally(() => {
        setRefreshing(false);
      });
  };

  const copyBibTeX = (paper: Paper) => {
    const year = new Date(paper.publication_date).getFullYear();
    const firstAuthor = paper.authors[0].split(' ').pop() || 'Author';
    const title = paper.title.replace(/\s+/g, '_').substring(0, 20).replace(/[^a-zA-Z0-9_]/g, '');
    const id = `${firstAuthor}${year}${title}`;
    
    const bibtex = `@article{${id},
  title={${paper.title}},
  author={${paper.authors.join(' and ')}},
  journal={arXiv preprint arXiv:${paper.url.split('/').pop()}},
  year={${year}},
  url={${paper.url}}
}`;
    navigator.clipboard.writeText(bibtex);
    alert("BibTeX copied to clipboard!");
  };

  const handlePaperUpdate = (updatedPaper: Paper) => {
    setPapers(prevPapers => 
      prevPapers.map(p => p.id === updatedPaper.id ? updatedPaper : p)
    );
  };

  // Helper to parse search query
  const parseSearchQuery = (query: string) => {
    const filters: { tag?: string; author?: string; year?: string } = {};
    let general = query;

    // Extract tag: (supports tag:Robotics or tag:"Reinforcement Learning")
    const tagMatch = general.match(/tag:(?:"([^"]+)"|(\S+))/i);
    if (tagMatch) {
      filters.tag = tagMatch[1] || tagMatch[2];
      general = general.replace(tagMatch[0], '');
    }

    // Extract author:
    const authorMatch = general.match(/author:(?:"([^"]+)"|(\S+))/i);
    if (authorMatch) {
      filters.author = authorMatch[1] || authorMatch[2];
      general = general.replace(authorMatch[0], '');
    }

    // Extract year:
    const yearMatch = general.match(/year:(\d{4})/i);
    if (yearMatch) {
      filters.year = yearMatch[1];
      general = general.replace(yearMatch[0], '');
    }

    return { general: general.trim(), filters };
  };

  // Filter papers based on the search term and selected tag
  const { general: searchGeneral, filters: searchFilters } = parseSearchQuery(searchTerm);

  // Prepare terms for highlighting
  // Use the full search phrase for highlighting to match the search logic (which treats it as a phrase)
  // This prevents highlighting individual words like "Zhang" when searching for "Kevin Zhang"
  const searchTerms = searchGeneral.trim() ? [searchGeneral.trim()] : [];
  
  // Add specific filters to highlights
  if (searchFilters.author) {
    searchTerms.push(searchFilters.author);
  }
  if (searchFilters.tag) {
    searchTerms.push(searchFilters.tag);
  }

  // Add selectedTag to highlights if it exists (as a whole phrase, not split)
  const allHighlights = selectedTag ? [...searchTerms, selectedTag] : searchTerms;

  const filteredPapers = papers.filter(paper => {
    // 0. Check favorites filter
    if (showFavoritesOnly && !favorites.includes(paper.id)) return false;

    // 1. Check advanced filters
    if (searchFilters.tag) {
      if (!paper.tags?.some(t => t.toLowerCase().includes(searchFilters.tag!.toLowerCase()))) return false;
    }
    if (searchFilters.author) {
      if (!paper.authors.some(a => a.toLowerCase().includes(searchFilters.author!.toLowerCase()))) return false;
    }
    if (searchFilters.year) {
      if (new Date(paper.publication_date).getFullYear().toString() !== searchFilters.year) return false;
    }

    // 2. Check general search term
    // If the search term contains spaces, treat it as a single phrase search first
    // This allows searching for full names like "Kevin Zhang" without matching just "Zhang"
    const trimmedSearch = searchGeneral.trim();
    const terms = [trimmedSearch];
    
    // A paper must match the search term (as a phrase)
    const matchesAllTerms = terms.every(term => {
      // Create regex for this specific term with word boundary
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let patternStr = escaped;
      // If term starts with a word character, enforce word boundary at start
      if (/^\w/.test(term)) patternStr = `\\b${patternStr}`;
      // If term ends with a word character, enforce word boundary at end
      if (/\w$/.test(term)) patternStr = `${patternStr}\\b`;
      
      const termPattern = new RegExp(patternStr, 'i');

      const inTitle = termPattern.test(paper.title);
      const inAuthors = termPattern.test(paper.authors.join(' '));
      const inAbstract = termPattern.test(paper.abstract);
      return inTitle || inAuthors || inAbstract;
    });

    const tagMatch = selectedTag ? paper.tags?.includes(selectedTag) : true;
    
    return matchesAllTerms && tagMatch;
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.publication_date).getTime() - new Date(a.publication_date).getTime();
    } else if (sortBy === 'oldest') {
      return new Date(a.publication_date).getTime() - new Date(b.publication_date).getTime();
    }
    // Fallback to newest
    return new Date(b.publication_date).getTime() - new Date(a.publication_date).getTime();
  });

  // Reset page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchTerm, selectedTag, itemsPerPage, sortBy, showFavoritesOnly, currentPage]);

  // Pagination logic
  const totalPages = Math.ceil(filteredPapers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentPapers = filteredPapers.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll the main content container to top
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGoToPage = () => {
    const pageNumber = parseInt(inputPage);
    if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
      handlePageChange(pageNumber);
      setInputPage('');
    }
  };

  // Helper to generate page numbers
  const getPageNumbers = () => {
    const pageNumbers: (number | string)[] = [];
    // Always show first, last, current, and neighbors
    // Logic: 1 ... (current-1) current (current+1) ... total
    
    // If total pages is small, show all
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
      return pageNumbers;
    }

    // Always add first page
    pageNumbers.push(1);

    // Calculate start and end of middle range
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);

    // Adjust if near beginning
    if (currentPage <= 3) {
      endPage = 4; // Ensure we see at least up to page 4
    }

    // Adjust if near end
    if (currentPage >= totalPages - 2) {
      startPage = totalPages - 3;
    }

    // Add ellipsis before middle range if needed
    if (startPage > 2) {
      pageNumbers.push('...');
    }

    // Add middle pages
    for (let i = startPage; i <= endPage; i++) {
      if (i > 1 && i < totalPages) {
        pageNumbers.push(i);
      }
    }

    // Add ellipsis after middle range if needed
    if (endPage < totalPages - 1) {
      pageNumbers.push('...');
    }

    // Always add last page
    pageNumbers.push(totalPages);

    return pageNumbers;
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <header className="mb-8 space-y-4 relative">
        {/* Tongji University Logo - Top Right */}
        <div className="absolute -top-6 -right-2 md:right-0 z-10 hidden sm:block">
          <div className="bg-white rounded-full p-2 shadow-lg w-16 h-16 md:w-20 md:h-20 flex items-center justify-center overflow-hidden">
            <img 
              src="/tongji-blue.jpg" 
              alt="Tongji University Logo" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-6 text-center">
          <div className="px-4 md:px-0">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-600">
              World Models Research Hub
            </h1>
            <div className="flex flex-col items-center gap-2 mt-2">
              <p className="text-muted-foreground text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed">
                Tracking the latest advancements in <span className="text-foreground font-medium whitespace-nowrap">World Models</span> and <span className="text-foreground font-medium whitespace-nowrap">Model-Based RL</span>
              </p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 shadow-sm">
                v3.1
              </span>
            </div>
          </div>
          
          {/* Debug Info / Offline Banner */}
          {usingMockData && (
            <div className="w-full max-w-2xl mx-auto bg-amber-50 border-l-4 border-amber-500 p-4 text-left">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-amber-700">
                    <span className="font-bold">Backend Connection Issue.</span> Showing offline cached data.
                    <br/>
                    <span className="text-xs font-mono mt-1 block opacity-75">
                      Target: {API_BASE_URL} | Error: {fetchErrorDetail}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button 
            onClick={handleRefresh} 
            disabled={refreshing}
            className="gap-2 w-full max-w-xs mx-auto bg-gradient-to-r from-blue-400 to-cyan-600 text-white border-0 hover:opacity-90 hover:shadow-lg transition-all duration-300"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>
      </header>
      
      <div className="mb-10 max-w-4xl mx-auto space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input
            type="text"
            placeholder="Search by title, authors, or abstract..."
            className="w-full pl-10 pr-10 py-6 text-lg bg-background/50 border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50 rounded-xl shadow-lg backdrop-blur-sm transition-all duration-300"
            value={localSearchTerm}
            onChange={(e) => setLocalSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* Active Filter Indicator */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center items-center gap-2">
            {showFavoritesOnly && (
              <div className="flex justify-center items-center gap-2">
                <span className="text-sm text-muted-foreground">Showing:</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowFavoritesOnly(false)}
                  className="rounded-full flex items-center gap-2 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border border-yellow-500/20"
                >
                  <Star className="h-3 w-3 fill-current" />
                  Favorites Only <span className="ml-1 text-xs">×</span>
                </Button>
              </div>
            )}
            
            {selectedTag && (
              <div className="flex justify-center items-center gap-2">
                {!showFavoritesOnly && <span className="text-sm text-muted-foreground">Filtered by:</span>}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedTag(null)}
                  className="rounded-full flex items-center gap-2"
                >
                  {selectedTag} <span className="ml-1 text-xs">×</span>
                </Button>
              </div>
            )}
          </div>
          {!loading && !error && (
            <p className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500">
              Found {filteredPapers.length} papers
            </p>
          )}
        </div>
      </div>

      <main>
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-lg text-muted-foreground">Loading papers...</p>
          </div>
        )}
        
        {error && (
          <div className="text-center py-20">
            <p className="text-red-400 text-lg bg-red-950/30 py-4 px-6 rounded-lg inline-block border border-red-900/50">
              Error: {error}
            </p>
          </div>
        )}
        
        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentPapers.map(paper => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  allHighlights={allHighlights}
                  selectedTag={selectedTag}
                  setSelectedTag={setSelectedTag}
                  setSearchTerm={setSearchTerm}
                  copyBibTeX={copyBibTeX}
                  onPaperUpdate={handlePaperUpdate}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {filteredPapers.length > itemsPerPage && (
              <div className="flex flex-col sm:flex-row justify-center items-center mt-12 gap-4 sm:gap-2">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="bg-card border-border text-foreground hover:text-primary hover:border-primary/50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {getPageNumbers().map((page, index) => (
                    <Button
                      key={index}
                      variant={page === currentPage ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => typeof page === 'number' && handlePageChange(page)}
                      disabled={page === '...'}
                      className={`min-w-[2.5rem] ${
                        page === currentPage 
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                          : 'bg-card border-border text-foreground hover:text-primary hover:border-primary/50'
                      } ${page === '...' ? 'cursor-default hover:bg-card hover:text-muted-foreground' : ''}`}
                    >
                      {page}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="bg-card border-border text-foreground hover:text-primary hover:border-primary/50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Jump to Page Input */}
                <div className="flex items-center gap-2 sm:ml-4 sm:pl-4 sm:border-l border-border/50 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 w-full sm:w-auto justify-center sm:justify-start">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Go to:</span>
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={inputPage}
                    onChange={(e) => setInputPage(e.target.value)}
                    placeholder="#"
                    className="w-16 h-8 text-center px-1 bg-card/50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleGoToPage();
                      }
                    }}
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleGoToPage}
                    disabled={!inputPage || parseInt(inputPage) < 1 || parseInt(inputPage) > totalPages}
                    className="h-8 px-3"
                  >
                    Go
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        
        {!loading && !error && filteredPapers.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-xl">No papers found matching your search.</p>
          </div>
        )}
      </main>
      
      <footer className="text-center text-muted-foreground py-8 text-sm mt-12 border-t border-border/50 space-y-2">
        <p className="max-w-2xl mx-auto px-4 opacity-80">
          * Note: Dates are displayed based on the original arXiv submission/announcement time (UTC) to ensure consistency across time zones.
        </p>
        <p>&copy; {new Date().getFullYear()} World Models Research Hub. All rights reserved.</p>
      </footer>
    </div>
  );
}
