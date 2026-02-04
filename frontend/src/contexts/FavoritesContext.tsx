import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface FavoritesContextType {
  favorites: number[];
  addFavorite: (id: number) => void;
  removeFavorite: (id: number) => void;
  isFavorite: (id: number) => boolean;
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (show: boolean) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('favorites');
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse favorites', e);
      }
    }
  }, []);

  // Save to localStorage whenever changes
  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  const addFavorite = (id: number) => {
    setFavorites(prev => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  };

  const removeFavorite = (id: number) => {
    setFavorites(prev => prev.filter(fid => fid !== id));
  };

  const isFavorite = (id: number) => favorites.includes(id);

  return (
    <FavoritesContext.Provider value={{
      favorites,
      addFavorite,
      removeFavorite,
      isFavorite,
      showFavoritesOnly,
      setShowFavoritesOnly
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
