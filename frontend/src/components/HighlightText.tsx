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
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let pattern = escaped;
    // If term starts with a word character, enforce word boundary at start
    if (/^\w/.test(t)) pattern = `\\b${pattern}`;
    // If term ends with a word character, enforce word boundary at end
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
