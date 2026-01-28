import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Calendar, Users, Loader2 } from "lucide-react";

// Define the type for a single paper
interface Paper {
  id: number;
  title: string;
  authors: string[];
  abstract: string;
  publication_date: string;
  url: string;
}

function App() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Fetch papers from the backend API
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
  }, []);

  // Filter papers based on the search term
  const filteredPapers = papers.filter(paper => {
    const searchTermLower = searchTerm.toLowerCase();
    const titleMatch = paper.title.toLowerCase().includes(searchTermLower);
    const authorsMatch = paper.authors.join(', ').toLowerCase().includes(searchTermLower);
    const abstractMatch = paper.abstract.toLowerCase().includes(searchTermLower);
    return titleMatch || authorsMatch || abstractMatch;
  });

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
          </header>
          
          <div className="mb-16 max-w-2xl mx-auto relative">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPapers.map(paper => (
                  <Card key={paper.id} className="bg-slate-900/50 border-slate-800 hover:border-cyan-500/30 transition-all duration-300 hover:shadow-cyan-500/10 hover:shadow-lg flex flex-col group h-full backdrop-blur-sm">
                    <CardHeader>
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
