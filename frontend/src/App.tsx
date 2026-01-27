import { useState, useEffect } from 'react';

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
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-extrabold mb-2">World Models Research Hub</h1>
        <p className="text-xl text-gray-400">An AI-native platform for exploring the frontiers of World Models research.</p>
      </header>
      
      <div className="mb-12 max-w-2xl mx-auto">
        <input
          type="text"
          placeholder="Search by title, authors, or abstract..."
          className="w-full px-4 py-3 bg-gray-800 text-white border-2 border-gray-700 rounded-lg focus:outline-none focus:border-cyan-500 transition-colors duration-300"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <main>
        {loading && <p className="text-center text-lg text-blue-400">Loading papers...</p>}
        {error && <p className="text-center text-red-500 text-lg">Error: {error}</p>}
        
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPapers.map(paper => (
              <div key={paper.id} className="bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col justify-between hover:shadow-cyan-500/50 transition-shadow duration-300">
                <div>
                  <h2 className="text-2xl font-bold mb-3 text-cyan-400">{paper.title}</h2>
                  <p className="text-gray-400 mb-2">
                    <strong>Authors:</strong> {paper.authors.join(', ')}
                  </p>
                  <p className="text-gray-400 mb-4">
                    <strong>Published:</strong> {new Date(paper.publication_date).toLocaleDateString()}
                  </p>
                  <p className="text-gray-300 leading-relaxed line-clamp-4">{paper.abstract}</p>
                </div>
                <a 
                  href={paper.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="mt-6 inline-block bg-cyan-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-cyan-700 transition-colors duration-300 text-center"
                >
                  Read Paper
                </a>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

