import React from 'react';

interface HighlightTextProps {
  text: string;
  highlights: string[];
  className?: string; // Allow overriding styles
}

export const HighlightText: React.FC<HighlightTextProps> = ({ text, highlights, className }) => {
  // Filter out empty strings
  const terms = highlights.filter(t => t && t.trim().length > 0);
  
  if (terms.length === 0) return <>{text}</>;
  
  // Create regex pattern with word boundaries for better matching
  const escapedTerms = terms.map(t => {
    // If term contains spaces (phrase), treat it as a whole unit
    const isPhrase = t.trim().indexOf(' ') !== -1;
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let pattern = escaped;
    
    // Only apply word boundaries if it's a phrase or starts/ends with word char
    // If it's a phrase like "Kevin Zhang", we want \bKevin Zhang\b
    if (/^\w/.test(t)) pattern = `\\b${pattern}`;
    if (/\w$/.test(t)) pattern = `${pattern}\\b`;
    return pattern;
  });
  
  const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  
  const parts = text.split(pattern);
  
  // Default style if no className provided
  const defaultStyle = "highlight-match bg-yellow-200 text-yellow-900 dark:bg-yellow-500/30 dark:text-yellow-200 font-semibold rounded px-0.5 border border-yellow-400 dark:border-yellow-500/50";

  return (
    <>
      {parts.map((part, i) => {
        // Check if this part matches any of the terms (case-insensitive)
        const isMatch = terms.some(term => part.toLowerCase() === term.toLowerCase());
        return isMatch ? (
          <span key={i} className={className || defaultStyle}>
            {part}
          </span>
        ) : (
          part
        );
      })}
    </>
  );
};
