import { createContext, useContext, useState, type ReactNode } from 'react';
import type { SearchMode } from '@/types/paper';

interface FilterContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  itemsPerPage: number;
  setItemsPerPage: (num: number) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('newest');

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  };
  // Default to 25 items per page, persisting in localStorage could be a nice touch
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('itemsPerPage');
    return saved ? parseInt(saved, 10) : 25;
  });

  const handleSetItemsPerPage = (num: number) => {
    setItemsPerPage(num);
    localStorage.setItem('itemsPerPage', num.toString());
  };

  return (
    <FilterContext.Provider value={{ 
      searchTerm, 
      setSearchTerm,
      searchMode,
      setSearchMode,
      selectedTags, 
      setSelectedTags,
      toggleTag,
      itemsPerPage,
      setItemsPerPage: handleSetItemsPerPage,
      sortBy,
      setSortBy
    }}>
      {children}
    </FilterContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}
