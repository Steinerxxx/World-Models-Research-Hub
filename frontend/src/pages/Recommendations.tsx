import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, WandSparkles } from 'lucide-react';
import { PaperCard } from '@/components/PaperCard';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useFilter } from '@/contexts/FilterContext';
import { fetchAiRecommendations, fetchPapersWithFallback, fetchSimilarPaperRecommendations } from '@/lib/api';
import type { Paper, RecommendationResponse, SimilarPaperRecommendationResponse } from '@/types/paper';

export default function Recommendations() {
  const { favorites } = useFavorites();
  const { selectedTags, toggleTag } = useFilter();
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [similarPaperResult, setSimilarPaperResult] = useState<SimilarPaperRecommendationResponse | null>(null);
  const [isLoadingSimilarPapers, setIsLoadingSimilarPapers] = useState(false);
  const [context, setContext] = useState('');

  useEffect(() => {
    void (async () => {
      const result = await fetchPapersWithFallback();
      setAllPapers(result.data);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (allPapers.length === 0) return;
    
    const query = context.trim() || 'Recommend useful world model papers';
    void (async () => {
      setIsLoadingRecommendations(true);
      try {
        const result = await fetchAiRecommendations(query, favorites, 12);
        setRecommendations(result);
      } catch (err) {
        console.error('AI recommendations failed:', err);
        setRecommendations(null);
      } finally {
        setIsLoadingRecommendations(false);
      }
    })();
  }, [allPapers.length, favorites, context]);

  const handleRecommendSimilar = async (paper: Paper) => {
    setIsLoadingSimilarPapers(true);
    try {
      const result = await fetchSimilarPaperRecommendations(paper.id, paper.title, 6);
      setSimilarPaperResult(result);
    } catch (err) {
      console.error('Similar paper recommendations failed:', err);
      setSimilarPaperResult(null);
    } finally {
      setIsLoadingSimilarPapers(false);
    }
  };

  const handlePaperUpdate = (updatedPaper: Paper) => {
    setAllPapers(prev => prev.map(p => p.id === updatedPaper.id ? updatedPaper : p));
  };

  const copyBibTeX = async (paper: Paper): Promise<boolean> => {
    const authors = (paper.authors || []).join(', ');
    const key = paper.title.split(' ').slice(0, 2).join('');
    const bibtex = `@article{${key},\n  title={${paper.title}},\n  author={${authors}},\n  year={${new Date(paper.publication_date).getFullYear()}},\n  url={${paper.url}}\n}`;
    try {
      await navigator.clipboard.writeText(bibtex);
      return true;
    } catch {
      return false;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <p className="text-lg text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <WandSparkles className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">AI Recommendations</h1>
        </div>
        <p className="text-muted-foreground">
          {favorites.length > 0
            ? '基于你的收藏论文，为你推荐语义上最相近的研究'
            : '收藏一些论文后，AI 将基于你的兴趣做个性化推荐'}
        </p>
      </header>

      <div className="mb-8 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input
            type="text"
            placeholder="Describe your research interest for better context..."
            className="w-full pl-10 pr-4 py-6 text-lg bg-background/50 rounded-xl"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>
      </div>

      <main>
        {recommendations && recommendations.items.length > 0 && (
          <section className="mb-10 rounded-2xl border border-primary/15 bg-primary/5 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <WandSparkles className="h-4 w-4" />
                  For You
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {recommendations.usedVectorRecommendations
                    ? '基于你的收藏 embedding 做个性化向量推荐'
                    : recommendations.basedOnFavorites
                      ? '基于你的收藏偏好和当前意图推荐'
                      : '基于你当前意图推荐'}
                </p>
                <p className="mt-2 text-xs text-foreground/80">
                  {recommendations.ai.explanation}
                </p>
              </div>
              {isLoadingRecommendations && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Refreshing
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {recommendations.items.map((paper) => (
                <div key={`rec-${paper.id}`} className="space-y-2">
                  {paper.match_reasons && paper.match_reasons.length > 0 && (
                    <div className="rounded-lg border border-primary/15 bg-background/70 px-3 py-2 text-xs text-left text-muted-foreground">
                      <span className="font-medium text-foreground">Why recommended:</span> {paper.match_reasons.join(' · ')}
                    </div>
                  )}
                  <PaperCard
                    paper={paper}
                    allHighlights={paper.match_reasons || []}
                    selectedTags={selectedTags}
                    toggleTag={toggleTag}
                    setSearchTerm={() => {}}
                    copyBibTeX={copyBibTeX}
                    onPaperUpdate={handlePaperUpdate}
                    onRecommendSimilar={handleRecommendSimilar}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {(similarPaperResult || isLoadingSimilarPapers) && (
          <section className="mb-10 rounded-2xl border border-border/60 bg-card/60 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <WandSparkles className="h-4 w-4" />
                  Similar Papers
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {similarPaperResult
                    ? `基于论文《${similarPaperResult.paperTitle}》的相似论文推荐`
                    : '正在生成相似论文推荐'}
                </p>
              </div>
              {isLoadingSimilarPapers && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading
                </div>
              )}
              {similarPaperResult && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSimilarPaperResult(null)}
                  className="h-7 px-2 text-xs text-muted-foreground"
                >
                  ✕
                </Button>
              )}
            </div>

            {similarPaperResult && similarPaperResult.items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {similarPaperResult.items.map((paper) => (
                  <div key={`sim-${paper.id}`} className="space-y-2">
                    {paper.match_reasons && paper.match_reasons.length > 0 && (
                      <div className="rounded-lg border border-primary/15 bg-background/70 px-3 py-2 text-xs text-left text-muted-foreground">
                        <span className="font-medium text-foreground">Why similar:</span> {paper.match_reasons.join(' · ')}
                      </div>
                    )}
                    <PaperCard
                      paper={paper}
                      allHighlights={paper.match_reasons || []}
                      selectedTags={selectedTags}
                      toggleTag={toggleTag}
                      setSearchTerm={() => {}}
                      copyBibTeX={copyBibTeX}
                      onPaperUpdate={handlePaperUpdate}
                      onRecommendSimilar={handleRecommendSimilar}
                    />
                  </div>
                ))}
              </div>
            ) : (
              !isLoadingSimilarPapers && (
                <p className="text-sm text-muted-foreground">No similar papers were found for this item yet.</p>
              )
            )}
          </section>
        )}

        {!recommendations?.items.length && !isLoadingRecommendations && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-xl">收藏一些论文，AI 将为你生成个性化推荐</p>
          </div>
        )}
      </main>
    </div>
  );
}
