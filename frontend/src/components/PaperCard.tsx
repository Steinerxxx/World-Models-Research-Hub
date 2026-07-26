import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar, Users, Copy, Tag, Sparkles, Loader2, Star, Check, Orbit } from "lucide-react";
import { HighlightText } from './HighlightText';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useToast } from '@/contexts/ToastContext';
import { SUBJECT_TAGS, ARCHITECTURE_TAGS } from '@/constants/tags';
import { analyzePaper } from '@/lib/api';
import type { Paper } from '@/types/paper';

interface PaperCardProps {
  paper: Paper;
  allHighlights: string[];
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  setSearchTerm: (term: string) => void;
  copyBibTeX: (paper: Paper) => Promise<boolean>;
  onPaperUpdate?: (updatedPaper: Paper) => void;
  onRecommendSimilar?: (paper: Paper) => void;
  matchReasons?: string[];
  reasonLabel?: string;
}

export function PaperCard({ 
  paper, 
  allHighlights, 
  selectedTags, 
  toggleTag, 
  setSearchTerm, 
  copyBibTeX,
  onPaperUpdate,
  onRecommendSimilar,
  matchReasons,
  reasonLabel
}: PaperCardProps) {
  const [isAuthorsTruncated, setIsAuthorsTruncated] = useState(false);
  const [isAbstractTruncated, setIsAbstractTruncated] = useState(false);
  const [hasHiddenAuthorHighlight, setHasHiddenAuthorHighlight] = useState(false);
  const [hasHiddenAbstractHighlight, setHasHiddenAbstractHighlight] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const authorsRef = useRef<HTMLDivElement>(null);
  const abstractRef = useRef<HTMLParagraphElement>(null);
  
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { showToast } = useToast();
  const isStarred = isFavorite(paper.id);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isStarred) {
      removeFavorite(paper.id);
      showToast('Removed from favorites', 'info');
    } else {
      addFavorite(paper.id);
      showToast('Added to favorites');
    }
  };

  // Clean abstract text to remove "Less" artifact from scraping
  const cleanedAbstract = paper.abstract.replace(/\s*[△▽▲▼]?\s*Less\s*$/i, '').trim();

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const analysis = await analyzePaper(paper.id);
      if (analysis && onPaperUpdate) {
        onPaperUpdate({
          ...paper,
          ...analysis
        });
        showToast('AI analysis generated successfully!');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      showToast('AI analysis failed. Please try again.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const checkTruncation = () => {
      // Check Authors Truncation & Hidden Highlights
      if (authorsRef.current) {
        const isTruncated = authorsRef.current.scrollHeight > authorsRef.current.clientHeight;
        setIsAuthorsTruncated(isTruncated);

        if (isTruncated) {
          const matches = authorsRef.current.querySelectorAll('.highlight-match');
          let hidden = false;
          if (matches.length > 0) {
            const containerRect = authorsRef.current.getBoundingClientRect();
            // Use a significant tolerance (4px) to handle sub-pixel rendering and descenders (g, y, j, etc.)
            // We only want to flag matches that are clearly pushed to the next line or significantly cut off.
            const bottomLimit = containerRect.bottom + 4; 
            
            matches.forEach(match => {
              const matchRect = match.getBoundingClientRect();
              if (matchRect.bottom > bottomLimit) {
                hidden = true;
              }
            });
          }
          setHasHiddenAuthorHighlight(hidden);
        } else {
          setHasHiddenAuthorHighlight(false);
        }
      }

      // Check Abstract Truncation & Hidden Highlights
      if (abstractRef.current) {
        const isTruncated = abstractRef.current.scrollHeight > abstractRef.current.clientHeight;
        setIsAbstractTruncated(isTruncated);

        if (isTruncated) {
          const matches = abstractRef.current.querySelectorAll('.highlight-match');
          let hidden = false;
          if (matches.length > 0) {
            const containerRect = abstractRef.current.getBoundingClientRect();
            const bottomLimit = containerRect.bottom + 4;
            
            matches.forEach(match => {
              const matchRect = match.getBoundingClientRect();
              if (matchRect.bottom > bottomLimit) {
                hidden = true;
              }
            });
          }
          setHasHiddenAbstractHighlight(hidden);
        } else {
          setHasHiddenAbstractHighlight(false);
        }
      }
    };

    // Small delay to ensure layout is computed
    const timer = setTimeout(checkTruncation, 100);
    window.addEventListener('resize', checkTruncation);
    return () => {
      window.removeEventListener('resize', checkTruncation);
      clearTimeout(timer);
    };
  }, [paper.authors, cleanedAbstract, allHighlights]);

  const handleCopy = async () => {
    const success = await copyBibTeX(paper);
    if (success) {
      setIsCopied(true);
      showToast('BibTeX copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } else {
      showToast('Failed to copy BibTeX', 'error');
    }
  };

  return (
    <Card className={`group relative hover:shadow-lg transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm flex flex-col h-full ${showSummary ? 'relative z-10' : 'hover:relative hover:z-10'}`}>
      {/* Match reason banner */}
      {matchReasons && matchReasons.length > 0 && (
        <div className="pl-6 pr-14 pt-4 pb-0">
          <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 pr-12 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{reasonLabel || 'Why'}:</span> {matchReasons.join(' · ')}
          </div>
        </div>
      )}

      {/* Favorite Button */}
      <button
        onClick={toggleFavorite}
        className={`absolute top-4 right-4 z-30 p-2 rounded-full transition-all duration-200 ${
          isStarred 
            ? "text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20" 
            : "text-muted-foreground/30 hover:text-yellow-500 hover:bg-yellow-500/10"
        }`}
        title={isStarred ? "Remove from favorites" : "Add to favorites"}
      >
        <Star className={`h-5 w-5 ${isStarred ? "fill-current" : ""}`} />
      </button>

      <CardHeader className="space-y-3 pb-3">
        {/* Tags Section - Allow full height but maintain min-height for alignment consistency */}
        <div className="min-h-[72px]">
          <div className="flex flex-wrap gap-2 pr-12">
            {(paper.tags && paper.tags.length > 0) ? (
              paper.tags.map((tag, i) => {
                const isSelected = selectedTags.includes(tag);
                
                let selectedStyle = "bg-primary text-primary-foreground border-primary";
                if (SUBJECT_TAGS.includes(tag)) {
                  selectedStyle = "bg-cyan-500 text-white border-cyan-500 shadow-cyan-500/20";
                } else if (ARCHITECTURE_TAGS.includes(tag)) {
                  selectedStyle = "bg-purple-500 text-white border-purple-500 shadow-purple-500/20";
                } else {
                  // Style for dynamic AI-generated tags (Emerging Topics)
                  selectedStyle = "bg-orange-500 text-white border-orange-500 shadow-orange-500/20";
                }

                return (
                  <span 
                    key={i} 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTag(tag);
                    }}
                    className={`
                      inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 border cursor-pointer
                      ${isSelected 
                        ? `${selectedStyle} shadow-md` 
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border-transparent hover:border-border"
                      }
                      ${allHighlights.includes(tag) && !isSelected ? "ring-2 ring-yellow-400/50 dark:ring-yellow-500/50 bg-yellow-100/50 dark:bg-yellow-900/20" : ""}
                    `}
                  >
                    <Tag className="h-3 w-3" />
                    {isSelected ? (
                      /* When selected, render plain text to avoid highlight styles clashing with primary button style */
                      tag
                    ) : (
                      <HighlightText text={tag} highlights={allHighlights} />
                    )}
                  </span>
                );
              })
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground border border-transparent bg-muted/30">
                <Tag className="h-3 w-3" />
                Uncategorized
              </span>
            )}
          </div>
        </div>
        
        {/* Fixed min-height for title to align authors */}
        <CardTitle className="text-xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors min-h-[3.5rem]">
          <HighlightText 
            text={paper.title} 
            highlights={allHighlights} 
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="flex items-start space-x-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4 mt-1 flex-shrink-0" />
          <div className="relative group/authors cursor-help flex-1">
            <div ref={authorsRef} className="line-clamp-2 text-sm break-words">
              {paper.authors.map((author, i) => (
                <span key={i} className="inline">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setSearchTerm(`author:"${author.trim()}"`);
                    }}
                    className="hover:text-primary hover:underline transition-colors focus:outline-none inline"
                    title={`Filter by author: ${author.trim()}`}
                  >
                    <HighlightText text={author} highlights={allHighlights} />
                  </button>
                  {i < paper.authors.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>

            {/* Full author list (visible on hover) */}
            <div className="hidden group-hover/authors:block absolute top-0 left-0 w-full bg-popover text-popover-foreground text-sm leading-relaxed p-4 rounded-md shadow-xl border border-border z-30 max-h-[400px] overflow-y-auto">
              {paper.authors.map((author, i) => (
                <span key={i}>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setSearchTerm(`author:"${author.trim()}"`);
                    }}
                    className="hover:text-primary hover:underline transition-colors focus:outline-none"
                    title={`Filter by author: ${author.trim()}`}
                  >
                    <HighlightText text={author} highlights={allHighlights} />
                  </button>
                  {i < paper.authors.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
            
            {/* Highlight Indicator (Yellow Triangle) for Authors */}
            {isAuthorsTruncated && hasHiddenAuthorHighlight && (
              <div className="absolute bottom-0 right-0 w-0 h-0 border-l-[12px] border-l-transparent border-b-[12px] border-b-yellow-400/80 drop-shadow-md group-hover/authors:hidden animate-pulse" title="Contains highlighted terms - Hover to view"></div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{paper.publication_date.split('T')[0]}</span>
        </div>
        
        <div className="relative group/abstract cursor-help">
          {/* Truncated version (visible by default) */}
          <p ref={abstractRef} className="text-muted-foreground text-sm leading-relaxed line-clamp-4">
            <HighlightText text={cleanedAbstract} highlights={allHighlights} />
          </p>
          
          {/* Highlight Indicator (Yellow Triangle) */}
          {isAbstractTruncated && hasHiddenAbstractHighlight && (
            <div className="absolute bottom-0 right-0 w-0 h-0 border-l-[12px] border-l-transparent border-b-[12px] border-b-yellow-400/80 drop-shadow-md group-hover/abstract:hidden animate-pulse" title="Contains highlighted terms - Hover to view"></div>
          )}

          {/* Full version (visible on hover) */}
          <div className="hidden group-hover/abstract:block absolute top-0 left-0 w-full bg-popover text-popover-foreground text-sm leading-relaxed p-4 rounded-md shadow-xl border border-border z-30 max-h-[400px] overflow-y-auto">
            <HighlightText text={cleanedAbstract} highlights={allHighlights} />
          </div>
        </div>

        {/* AI Analysis Section */}
        {paper.summary ? (
          <div className="mt-3 flex justify-end relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSummary(!showSummary)}
              className="text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 h-8 px-3"
            >
              <Sparkles className="h-3 w-3 mr-1.5" />
              {showSummary ? 'Hide AI Summary' : 'View AI Summary'}
            </Button>
            {showSummary && (
              <div className="absolute top-full left-0 mt-2 w-full p-4 bg-popover text-popover-foreground rounded-lg shadow-xl border border-border z-40 space-y-2 text-sm max-h-64 overflow-y-auto">
                <p className="leading-relaxed"><span className="font-semibold text-foreground/80">Core Idea:</span> {paper.summary}</p>
                <p className="leading-relaxed"><span className="font-semibold text-foreground/80">Innovation:</span> {paper.contribution}</p>
                <p className="leading-relaxed"><span className="font-semibold text-foreground/80">Limitations:</span> {paper.limitations}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 flex justify-end">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleAnalyze} 
              disabled={isAnalyzing}
              className="text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 h-8 px-3"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1.5" />
                  Generate AI Summary
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-4 border-t border-border/50 flex gap-2">
        {onRecommendSimilar && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => onRecommendSimilar(paper)}
            title="Recommend similar papers"
            className="border-primary/20 hover:bg-primary/10 hover:text-primary"
          >
            <Orbit className="h-4 w-4" />
          </Button>
        )}
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
          onClick={handleCopy}
          title={isCopied ? "Copied!" : "Copy BibTeX"}
          className={`transition-all duration-200 ${
            isCopied 
              ? "border-green-500/50 bg-green-500/10 text-green-500" 
              : "border-primary/20 hover:bg-primary/10 hover:text-primary"
          }`}
        >
          {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </CardFooter>
    </Card>
  );
}
