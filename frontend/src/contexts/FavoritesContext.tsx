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

type FavoriteResponse = number[] | Array<{ paper_id: number }>;

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

function getStoredFavorites(): number[] {
  const stored = localStorage.getItem('favorites');
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse favorites', e);
    return [];
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<number[]>(() => getStoredFavorites());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // Load from API if logged in, otherwise localStorage
  useEffect(() => {
    if (user && isAuthenticated) {
      fetch(`${API_BASE_URL}/api/favorites`, {
        credentials: 'include'
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Failed to fetch favorites');
      })
      .then((data: FavoriteResponse) => {
        // Backend returns an array of numbers (IDs) directly
        if (Array.isArray(data) && (data.length === 0 || typeof data[0] === 'number')) {
          setFavorites(data as number[]);
        } else {
          // Fallback for object array format
          setFavorites((data as Array<{ paper_id: number }>).map((favorite) => favorite.paper_id));
        }
      })
      .catch(console.error);
    }
  }, [user, isAuthenticated]);

  // Save to localStorage ONLY if NOT logged in
  useEffect(() => {
    if (!user) {
      localStorage.setItem('favorites', JSON.stringify(favorites));
    }
  }, [favorites, user]);

  const addFavorite = async (id: number) => {
    if (user && isAuthenticated) {
      // Optimistic update
      const prevFavorites = [...favorites];
      setFavorites(prev => {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      });
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/favorites/${id}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 
            'Content-Type': 'application/json'
          }
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
    if (user && isAuthenticated) {
      // Optimistic update
      const prevFavorites = [...favorites];
      setFavorites(prev => prev.filter(fid => fid !== id));
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/favorites/${id}`, {
          method: 'DELETE',
          credentials: 'include'
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

// eslint-disable-next-line react-refresh/only-export-components
export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
