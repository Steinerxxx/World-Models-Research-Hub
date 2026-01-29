import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Calendar, Users, Loader2, RefreshCw, Tag, ChevronLeft, ChevronRight } from "lucide-react";

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

function App() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Extract all unique tags from papers
  const allTags = Array.from(new Set(papers.flatMap(p => p.tags || []))).sort();

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
  }, [searchTerm, selectedTag]);

  // Pagination logic
  const totalPages = Math.ceil(filteredPapers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentPapers = filteredPapers.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans dark">
      <div className="bg-slate-950 min-h-screen">
        <div className="container mx-auto px-4 py-12">
          <header className="text-center mb-16 space-y-4">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600">
              World Models Research Hub
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              An AI-native platform for exploring the frontiers of World Models research.
            </p>
            <div className="flex justify-center mt-6">
              <Button 
                onClick={handleRefresh} 
                disabled={refreshing || loading}
                className="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 hover:border-cyan-500/50 transition-all duration-300"
              >
                {refreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching Papers...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Fetch Latest Papers
                  </>
                )}
              </Button>
            </div>
          </header>
          
          <div className="mb-10 max-w-4xl mx-auto space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="Search by title, authors, or abstract..."
                className="w-full pl-10 py-6 text-lg bg-slate-900/50 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-500/50 rounded-xl shadow-lg backdrop-blur-sm transition-all duration-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Tag Filter */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant={selectedTag === null ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTag(null)}
                  className={`rounded-full border-slate-700 ${selectedTag === null ? 'bg-cyan-900/30 text-cyan-400 hover:bg-cyan-900/50' : 'bg-slate-900/30 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50'}`}
                >
                  All Topics
                </Button>
                {allTags.map(tag => (
                  <Button
                    key={tag}
                    variant={selectedTag === tag ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                    className={`rounded-full border-slate-700 ${selectedTag === tag ? 'bg-cyan-900/30 text-cyan-400 hover:bg-cyan-900/50' : 'bg-slate-900/30 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50'}`}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <main>
            {loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-12 w-12 text-cyan-500 animate-spin mb-4" />
                <p className="text-lg text-slate-400">Loading papers...</p>
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
                    <Card key={paper.id} className="bg-slate-900/50 border-slate-800 hover:border-cyan-500/30 transition-all duration-300 hover:shadow-cyan-500/10 hover:shadow-lg flex flex-col group h-full backdrop-blur-sm">
                      <CardHeader>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {paper.tags?.map(tag => (
                            <span key={tag} className="px-2 py-0.5 rounded-md bg-cyan-950/50 text-cyan-400 text-xs border border-cyan-900/50 flex items-center">
                              <Tag className="w-3 h-3 mr-1" />
                              {tag}
                            </span>
                          ))}
                        </div>
                        <CardTitle className="text-xl font-bold text-slate-100 leading-tight group-hover:text-cyan-400 transition-colors">
                          {paper.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-grow space-y-4">
                        <div className="flex items-start space-x-2 text-sm text-slate-400">
                          <Users className="h-4 w-4 mt-1 flex-shrink-0 text-slate-500" />
                          <span className="line-clamp-2">{paper.authors.join(', ')}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-slate-500">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(paper.publication_date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed line-clamp-4">
                          {paper.abstract}
                        </p>
                      </CardContent>
                      <CardFooter className="pt-4 border-t border-slate-800/50">
                        <Button 
                          asChild 
                          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg shadow-cyan-900/20"
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
                      className="bg-slate-900 border-slate-700 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50"
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
                            ? 'bg-cyan-600 text-white hover:bg-cyan-700 border-cyan-500' 
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50'
                        } ${page === '...' ? 'cursor-default hover:bg-slate-900 hover:text-slate-300 hover:border-slate-700' : ''}`}
                      >
                        {page}
                      </Button>
                    ))}

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="bg-slate-900 border-slate-700 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
            
            {!loading && !error && filteredPapers.length === 0 && (
              <div className="text-center py-20 text-slate-500">
                <p className="text-xl">No papers found matching your search.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
