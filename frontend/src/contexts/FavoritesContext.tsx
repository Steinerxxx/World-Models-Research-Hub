import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/config';

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
  const { user, token } = useAuth();

  // Load from API if logged in, otherwise localStorage
  useEffect(() => {
    if (user && token) {
      fetch(`${API_BASE_URL}/api/favorites`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Failed to fetch favorites');
      })
      .then(data => setFavorites(data.map((f: any) => f.paper_id)))
      .catch(console.error);
    } else {
      const stored = localStorage.getItem('favorites');
      if (stored) {
        try {
          setFavorites(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse favorites', e);
        }
      }
    }
  }, [user, token]);

  // Save to localStorage ONLY if NOT logged in
  useEffect(() => {
    if (!user) {
      localStorage.setItem('favorites', JSON.stringify(favorites));
    }
  }, [favorites, user]);

  const addFavorite = async (id: number) => {
    if (user && token) {
      // Optimistic update
      const prevFavorites = [...favorites];
      setFavorites(prev => {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      });
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/favorites`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ paperId: id })
        });
        if (!res.ok) throw new Error('Failed to add favorite');
      } catch (error) {
        console.error('Failed to add favorite', error);
        // Revert on error
        setFavorites(prevFavorites);
      }
    } else {
      // Local storage logic
      setFavorites(prev => {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      });
    }
  };

  const removeFavorite = async (id: number) => {
    if (user && token) {
      // Optimistic update
      const prevFavorites = [...favorites];
      setFavorites(prev => prev.filter(fid => fid !== id));
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/favorites/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to remove favorite');
      } catch (error) {
        console.error('Failed to remove favorite', error);
        // Revert on error
        setFavorites(prevFavorites);
      }
    } else {
      // Local storage logic
      setFavorites(prev => prev.filter(fid => fid !== id));
    }
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
