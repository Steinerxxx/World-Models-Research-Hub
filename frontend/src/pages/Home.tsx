import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Calendar, Users, Loader2, RefreshCw, Tag, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { useFilter } from '@/contexts/FilterContext';

// Define the type for a single paper
interface Paper {
  id: number;
  title: string;
  authors: string[];
  abstract: string;
  publication_date: string;
  url: string;
  tags?: string[];
}

export default function Home() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use context for filters
  const { searchTerm, setSearchTerm, selectedTag, setSelectedTag, itemsPerPage, sortBy } = useFilter();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [inputPage, setInputPage] = useState('');
  // itemsPerPage is now controlled by FilterContext

  const fetchPapers = () => {
    setLoading(true);
    fetch('https://world-models-research-hub-backhend.onrender.com/api/papers')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        setPapers(data);
        setLoading(false);
      })
      .catch(error => {
        setError(error.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetch('https://world-models-research-hub-backhend.onrender.com/api/scrape', {
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

  // Helper component for highlighting
  const HighlightText = ({ text, highlights }: { text: string; highlights: string[] }) => {
    // Filter out empty strings
    const terms = highlights.filter(t => t && t.trim().length > 0);
    
    if (terms.length === 0) return <>{text}</>;
    
    // Escape special regex characters for all terms
    const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // Create a regex that matches any of the terms
    const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    
    const parts = text.split(pattern);
    
    return (
      <>
        {parts.map((part, i) => {
          // Check if this part matches any of the terms (case-insensitive)
          const isMatch = terms.some(term => part.toLowerCase() === term.toLowerCase());
          return isMatch ? (
            <span key={i} className="bg-yellow-200 text-yellow-900 dark:bg-yellow-500/30 dark:text-yellow-200 font-semibold rounded px-0.5 border border-yellow-400 dark:border-yellow-500/50">
              {part}
            </span>
          ) : (
            part
          );
        })}
      </>
    );
  };

  // Filter papers based on the search term and selected tag
  const { general: searchGeneral, filters: searchFilters } = parseSearchQuery(searchTerm);

  // Prepare terms for highlighting
  const searchTerms = searchGeneral.trim().split(/\s+/).filter(t => t.length > 0);
  // Add selectedTag to highlights if it exists (as a whole phrase, not split)
  const allHighlights = selectedTag ? [...searchTerms, selectedTag] : searchTerms;

  const filteredPapers = papers.filter(paper => {
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

    // 2. Check general search term (Multi-keyword AND logic)
    const terms = searchGeneral.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    
    // A paper must match ALL terms in the query
    const matchesAllTerms = terms.every(term => {
      const inTitle = paper.title.toLowerCase().includes(term);
      const inAuthors = paper.authors.join(', ').toLowerCase().includes(term);
      const inAbstract = paper.abstract.toLowerCase().includes(term);
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
    // For 'relevance', we rely on the original order (or implementation of scoring later)
    // But if no search term, fallback to newest
    if (!searchTerm) {
        return new Date(b.publication_date).getTime() - new Date(a.publication_date).getTime();
    }
    return 0;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTag, itemsPerPage, sortBy]);

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
    } else {
      // Fallback
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      <header className="mb-8 space-y-4">
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
                v1.20
              </span>
            </div>
          </div>
          
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
            className="w-full pl-10 py-6 text-lg bg-background/50 border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50 rounded-xl shadow-lg backdrop-blur-sm transition-all duration-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Active Filter Indicator */}
        <div className="flex flex-col items-center gap-2">
          {selectedTag && (
            <div className="flex justify-center items-center gap-2">
              <span className="text-sm text-muted-foreground">Filtered by:</span>
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
                <Card key={paper.id} className="bg-card/50 border-border hover:border-primary/30 transition-all duration-300 hover:shadow-primary/5 hover:shadow-lg flex flex-col group h-full backdrop-blur-sm relative hover:z-20">
                  <CardHeader>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {paper.tags?.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs border border-primary/20 flex items-center">
                          <Tag className="w-3 h-3 mr-1" />
                          {tag}
                        </span>
                      ))}
                    </div>
                    <CardTitle className="text-xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                      <HighlightText text={paper.title} highlights={allHighlights} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-4">
                    <div className="flex items-start space-x-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4 mt-1 flex-shrink-0" />
                      <div className="relative group/authors cursor-help flex-1">
                        <span className="line-clamp-2">
                          {paper.authors.map((author, i) => (
                            <span key={i}>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSearchTerm(`author:"${author}"`);
                                }}
                                className="hover:text-primary hover:underline transition-colors focus:outline-none"
                                title={`Filter by author: ${author}`}
                              >
                                <HighlightText text={author} highlights={allHighlights} />
                              </button>
                              {i < paper.authors.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </span>

                        {/* Full author list (visible on hover) */}
                        <div className="hidden group-hover/authors:block absolute top-0 left-0 w-full bg-popover text-popover-foreground text-sm leading-relaxed p-4 rounded-md shadow-xl border border-border z-50 max-h-[400px] overflow-y-auto">
                          {paper.authors.map((author, i) => (
                            <span key={i}>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSearchTerm(`author:"${author}"`);
                                }}
                                className="hover:text-primary hover:underline transition-colors focus:outline-none"
                                title={`Filter by author: ${author}`}
                              >
                                <HighlightText text={author} highlights={allHighlights} />
                              </button>
                              {i < paper.authors.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{paper.publication_date.split('T')[0]}</span>
                    </div>
                    
                    <div className="relative group/abstract cursor-help">
                      {/* Truncated version (visible by default) */}
                      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-4">
                        <HighlightText text={paper.abstract} highlights={allHighlights} />
                      </p>

                      {/* Full version (visible on hover) */}
                      <div className="hidden group-hover/abstract:block absolute top-0 left-0 w-full bg-popover text-popover-foreground text-sm leading-relaxed p-4 rounded-md shadow-xl border border-border z-50 max-h-[400px] overflow-y-auto">
                        <HighlightText text={paper.abstract} highlights={allHighlights} />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-border/50 flex gap-2">
                    <Button 
                      asChild 
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                    >
                      <a href={paper.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                        Read Paper <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyBibTeX(paper)}
                      title="Copy BibTeX"
                      className="border-primary/20 hover:bg-primary/10 hover:text-primary"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {filteredPapers.length > itemsPerPage && (
              <div className="flex justify-center items-center mt-12 gap-2">
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

                {/* Jump to Page Input */}
                <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border/50">
                  <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:inline-block">Go to:</span>
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
      
      <footer className="text-center text-muted-foreground py-8 text-sm mt-12 border-t border-border/50">
        <p>&copy; {new Date().getFullYear()} World Models Research Hub. All rights reserved.</p>
      </footer>
    </div>
  );
}
