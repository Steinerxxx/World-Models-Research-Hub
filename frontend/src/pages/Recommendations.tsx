import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, WandSparkles } from 'lucide-react';
import { PaperCard } from '@/components/PaperCard';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useFilter } from '@/contexts/FilterContext';
import { fetchAiRecommendations } from '@/lib/api';
import type { Paper, RecommendationResponse } from '@/types/paper';

export default function Recommendations() {
  const { favorites } = useFavorites();
  const { selectedTags, toggleTag } = useFilter();
  const navigate = useNavigate();
  const [initialLoading, setInitialLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [context, setContext] = useState('');
  const [submittedContext, setSubmittedContext] = useState('');

  const triggerContextSearch = () => {
    setSubmittedContext(context.trim());
  };

  useEffect(() => {
    const query = submittedContext || 'Recommend useful world model papers';
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
        setInitialLoading(false);
      }
    })();
  }, [favorites, submittedContext]);

  const handleRecommendSimilar = (paper: Paper) => {
    navigate('/', { state: { similarPaper: paper } });
  };

  const handlePaperUpdate = (updatedPaper: Paper) => {
    setRecommendations(prev => prev ? {
      ...prev,
      items: prev.items.map(p => p.id === updatedPaper.id ? updatedPaper : p)
    } : prev);
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

  if (initialLoading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <p className="text-lg text-muted-foreground">Generating recommendations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <header className="mb-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">AI Recommendations</h1>
          <p className="text-muted-foreground">
            {favorites.length > 0
              ? '基于你的收藏论文，为你推荐语义上最相近的研究'
              : '收藏一些论文后，AI 将基于你的兴趣做个性化推荐'}
          </p>
        </div>
      </header>

      <div className="mb-8 max-w-xl">
        <p className="mb-2 text-sm text-muted-foreground">
          输入你当前的研究方向，AI 会据此调整推荐结果的侧重
        </p>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="e.g. robot manipulation, video diffusion, RL planning..."
            className="flex-1 py-6 text-lg bg-background/50 rounded-xl"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && triggerContextSearch()}
          />
          <Button
            onClick={triggerContextSearch}
            disabled={isLoadingRecommendations}
            className="h-auto px-6 rounded-xl text-base font-semibold"
          >
            Apply
          </Button>
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
                <div key={`rec-${paper.id}`}>
                  <PaperCard
                    paper={paper}
                    allHighlights={paper.match_reasons || []}
                    selectedTags={selectedTags}
                    toggleTag={(tag) => { toggleTag(tag); navigate('/'); }}
                    setSearchTerm={() => { navigate('/'); }}
                    copyBibTeX={copyBibTeX}
                    onPaperUpdate={handlePaperUpdate}
                    onRecommendSimilar={handleRecommendSimilar}
                    matchReasons={paper.match_reasons}
                    reasonLabel="Why recommended"
                  />
                </div>
              ))}
            </div>
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
