import { createContext, useContext, useState, type ReactNode } from 'react';

interface FilterContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  itemsPerPage: number;
  setItemsPerPage: (num: number) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('newest');
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
      selectedTag, 
      setSelectedTag,
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
