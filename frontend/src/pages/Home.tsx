import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Calendar, Users, Loader2, RefreshCw, Tag, ChevronLeft, ChevronRight } from "lucide-react";
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
  const { searchTerm, setSearchTerm, selectedTag, setSelectedTag, itemsPerPage } = useFilter();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
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

  // Filter papers based on the search term and selected tag
  const filteredPapers = papers.filter(paper => {
    const searchTermLower = searchTerm.toLowerCase();
    const titleMatch = paper.title.toLowerCase().includes(searchTermLower);
    const authorsMatch = paper.authors.join(', ').toLowerCase().includes(searchTermLower);
    const abstractMatch = paper.abstract.toLowerCase().includes(searchTermLower);
    const tagMatch = selectedTag ? paper.tags?.includes(selectedTag) : true;
    
    return (titleMatch || authorsMatch || abstractMatch) && tagMatch;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedTag, itemsPerPage]);

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
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-600">
              World Models Research Hub
            </h1>
            <p className="text-muted-foreground mt-2">
            Tracking the latest advancements in World Models and Model-Based RL (v1.11)
          </p>
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
                <Card key={paper.id} className="bg-card/50 border-border hover:border-primary/30 transition-all duration-300 hover:shadow-primary/5 hover:shadow-lg flex flex-col group h-full backdrop-blur-sm">
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
                      {paper.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-4">
                    <div className="flex items-start space-x-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4 mt-1 flex-shrink-0" />
                      <span className="line-clamp-2">{paper.authors.join(', ')}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(paper.publication_date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed line-clamp-4">
                      {paper.abstract}
                    </p>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-border/50">
                    <Button 
                      asChild 
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                    >
                      <a href={paper.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                        Read Paper <ExternalLink className="h-4 w-4" />
                      </a>
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
