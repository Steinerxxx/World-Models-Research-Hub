import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  Info, 
  Settings, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  Tag, 
  Layers, 
  Cpu,
  List,
  ArrowUpDown,
  TrendingUp,
  Star,
  LogIn,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { useFilter } from '@/contexts/FilterContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useAuth } from '@/contexts/AuthContext';
import { SUBJECT_TAGS, ARCHITECTURE_TAGS } from '@/constants/tags';
import { API_BASE_URL } from '@/config';
import { MOCK_PAPERS } from '@/data/mockData';

interface SidebarContentProps {
  isMobile: boolean;
  onClose: () => void;
}

const SidebarContent = ({ isMobile, onClose }: SidebarContentProps) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { selectedTags, setSelectedTags, toggleTag, itemsPerPage, setItemsPerPage, sortBy, setSortBy } = useFilter();
  const { showFavoritesOnly, setShowFavoritesOnly, favorites } = useFavorites();
  const { user } = useAuth();
  
  const [allBackendTags, setAllBackendTags] = useState<{tag: string, count: number}[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [backendVersion, setBackendVersion] = useState<string | null>(null);

  useEffect(() => {
    // Check backend health and version
    fetch(`${API_BASE_URL}/health`)
      .then(res => res.json())
      .then(data => {
        if (data.version) setBackendVersion(data.version);
      })
      .catch(() => setBackendVersion(null));

    const fetchTags = async () => {
      try {
        console.log('Fetching tags from:', `${API_BASE_URL}/api/tags`);
        const response = await fetch(`${API_BASE_URL}/api/tags?t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const tags = await response.json();
        
        if (!Array.isArray(tags)) throw new Error('Invalid data format');

        const formattedTags = tags
          .filter(t => t && (typeof t === 'string' ? t.trim() : t.tag && t.tag.trim()))
          .map(t => 
            typeof t === 'string' ? { tag: t, count: 0 } : { tag: t.tag, count: Number(t.count) }
          );

        const filteredTags = formattedTags.filter(t => 
          !['World Models', 'Model-Based RL'].map(s => s.toLowerCase()).includes(t.tag.toLowerCase())
        );
        
        setAllBackendTags(filteredTags);
        setIsLive(true);
        setError(null);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Fetch failed');
        setIsLive(false);
        
        // Retry logic for connection issues
        if (retryCount < 3) {
          setTimeout(() => setRetryCount(prev => prev + 1), 2000);
        }

        const tagCounts: Record<string, number> = {};
        MOCK_PAPERS.forEach(p => {
          (p.tags || []).forEach(t => {
            tagCounts[t] = (tagCounts[t] || 0) + 1;
          });
        });
        const filteredMockTags = Object.entries(tagCounts)
          .filter(([tag]) => !['World Models', 'Model-Based RL'].map(s => s.toLowerCase()).includes(tag.toLowerCase()))
          .map(([tag, count]) => ({ tag, count }));
        setAllBackendTags(filteredMockTags);
      }
    };

    fetchTags();
  }, [retryCount]);

  const extraTags = allBackendTags.filter(t => 
    !SUBJECT_TAGS.map(s => s.toLowerCase()).includes(t.tag.toLowerCase()) && 
    !ARCHITECTURE_TAGS.map(a => a.toLowerCase()).includes(t.tag.toLowerCase())
  );

  const prominentTags = extraTags.filter(t => Number(t.count) >= 5);
  const minorTags = extraTags.filter(t => Number(t.count) < 5);

  console.log('Sidebar render stats:', {
    allCount: allBackendTags.length,
    extraCount: extraTags.length,
    prominentCount: prominentTags.length,
    minorCount: minorTags.length,
    prominentSample: prominentTags.slice(0, 3),
    subjects: SUBJECT_TAGS,
    architectures: ARCHITECTURE_TAGS
  });

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-6 flex flex-col border-b border-border/50">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600">
            Research Hub
          </h2>
          {/* Close button only visible on mobile */}
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground mt-1 flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            FE: v3.5.2
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {backendVersion && (
              <span className="text-[9px] opacity-70">BE: {backendVersion}</span>
            )}
            {!isLive && (
              <button 
                onClick={() => setRetryCount(v => v + 1)}
                className="text-red-500 hover:underline cursor-pointer flex items-center gap-0.5 font-bold"
              >
                <span>!</span>
                <span className="text-[8px]">RETRY</span>
              </button>
            )}
          </div>
          {error && error.includes('404') && (
            <div className="text-[7px] opacity-30 mt-0.5">
              <div className="text-amber-500/50 font-medium">Hint: Please REDEPLOY on Sealos to update backend.</div>
            </div>
          )}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="space-y-6">
          
          {/* Navigation */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
              Menu
            </h3>
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? "bg-cyan-500/10 text-cyan-500 font-medium" 
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`
              }
              onClick={() => setSelectedTags([])}
            >
              <Home className="h-4 w-4" />
              Home
            </NavLink>
            <NavLink
              to="/trends"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? "bg-cyan-500/10 text-cyan-500 font-medium" 
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`
              }
            >
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium">Trends</span>
            </NavLink>

            <button
              onClick={() => {
                setShowFavoritesOnly(!showFavoritesOnly);
                navigate('/');
                window.scrollTo(0, 0);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                showFavoritesOnly
                  ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Star className={`h-4 w-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
              <span className="font-medium">My Favorites</span>
              {favorites.length > 0 && (
                <span className="ml-auto text-xs bg-muted-foreground/10 px-2 py-0.5 rounded-full">
                  {favorites.length}
                </span>
              )}
            </button>

            <NavLink
              to="/introduction"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? "bg-cyan-500/10 text-cyan-500 font-medium" 
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`
              }
            >
              <Info className="h-4 w-4" />
              Introduction
            </NavLink>

            {user ? (
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  }`
                }
              >
                <User className="h-4 w-4" />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-sm font-semibold">{user.username}</span>
                  <span className="text-[10px] opacity-70">Account Settings</span>
                </div>
              </NavLink>
            ) : (
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`
                }
              >
                <LogIn className="h-4 w-4" />
                Login
              </NavLink>
            )}
          </div>

          <div className="h-[1px] bg-border/50" />

          {/* Content Tags */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
              <Layers className="h-3 w-3" /> Research Topics
            </h3>
            {SUBJECT_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toggleTag(tag);
                  navigate('/');
                  if (isMobile) onClose();
                  window.scrollTo(0, 0);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-cyan-500/10 text-cyan-500 font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Tag className={`h-4 w-4 ${selectedTags.includes(tag) ? "fill-current" : ""}`} />
                <span className="font-medium">{tag}</span>
              </button>
            ))}
          </div>

          {/* Emerging Research (Prominent & Minor Tags) */}
          {(prominentTags.length > 0 || minorTags.length > 0) && (
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-orange-500/80 uppercase tracking-wider mb-2 mt-1 px-2 flex items-center gap-2">
                <TrendingUp className="h-3 w-3" /> Emerging Research
              </h3>
              
              {/* Prominent Tags */}
              {prominentTags.map(({ tag }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleTag(tag);
                    navigate('/');
                    if (isMobile) onClose();
                    window.scrollTo(0, 0);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    selectedTags.includes(tag)
                      ? "bg-orange-500/10 text-orange-500 font-medium border border-orange-500/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                  }`}
                >
                  <Tag className={`h-4 w-4 ${selectedTags.includes(tag) ? "fill-current text-orange-500" : ""}`} />
                  <span className="font-medium">{tag}</span>
                </button>
              ))}

              {/* Minor Tags (Folded Button) */}
              {minorTags.length > 0 && (
                <>
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 group border border-dashed border-border/50 hover:border-orange-500/30"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-orange-500/5 group-hover:bg-orange-500/10">
                        <List className="h-3 w-3 text-orange-500/70" />
                      </div>
                      <span>Discover More Topics</span>
                      <span className="ml-1 text-[10px] px-1 rounded bg-muted text-muted-foreground group-hover:bg-orange-500/20 group-hover:text-orange-500">
                        {minorTags.length}
                      </span>
                    </div>
                    <ArrowUpDown className={`h-3 w-3 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-orange-500' : 'text-muted-foreground/50'}`} />
                  </button>
                  
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pt-1 pb-2 space-y-0.5 pl-2 border-l-2 border-orange-500/10 ml-4 mt-1">
                          {minorTags.map(({ tag, count }) => (
                            <button
                              key={tag}
                              onClick={(e) => {
                                e.preventDefault();
                                toggleTag(tag);
                                navigate('/');
                                if (isMobile) onClose();
                                window.scrollTo(0, 0);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-all ${
                                selectedTags.includes(tag)
                                  ? 'bg-orange-500/10 text-orange-500 font-medium'
                                  : 'text-muted-foreground/70 hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Tag className={`h-3 w-3 ${selectedTags.includes(tag) ? 'text-orange-500' : 'text-muted-foreground/40'}`} />
                                <span>{tag}</span>
                              </div>
                              <span className="text-[10px] opacity-50">{count}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          )}

          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-10 px-2 flex items-center gap-2">
              <Cpu className="h-3 w-3" /> Architecture
            </h3>
            {ARCHITECTURE_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toggleTag(tag);
                  navigate('/');
                  if (isMobile) onClose();
                  window.scrollTo(0, 0);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-purple-500/10 text-purple-500 font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Cpu className={`h-4 w-4 ${selectedTags.includes(tag) ? "fill-current text-purple-500" : ""}`} />
                <span className="font-medium">{tag}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Settings Footer */}
      <div className="p-4 border-t border-border/50 bg-background/50 backdrop-blur-sm space-y-3">
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
            <Settings className="h-3 w-3" /> Settings
          </h3>
          
          {/* Theme Toggle */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 border-border"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4" /> Light Mode
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" /> Dark Mode
              </>
            )}
          </Button>

          {/* Pagination Settings */}
          <div className="w-full space-y-3">
            <div className="w-full">
              <label htmlFor="sort-order" className="sr-only">Sort Order</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                </div>
                <select
                  id="sort-order"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-xs">
                  ▼
                </div>
              </div>
            </div>

            <div className="w-full">
              <label htmlFor="items-per-page" className="sr-only">Items per page</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <List className="h-4 w-4 text-muted-foreground" />
                </div>
                <select
                  id="items-per-page"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer"
                >
                  {[10, 25, 50, 100].map((num) => (
                    <option key={num} value={num}>
                      {num} papers per page
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-xs">
                  ▼
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export function Sidebar() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(max-width: 767px)').matches;
    }
    return false;
  });

  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return !window.matchMedia('(max-width: 767px)').matches;
    }
    return true;
  });

  // Handle responsive behavior
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleResize = (e: MediaQueryListEvent | MediaQueryList) => {
      const mobile = e.matches;
      setIsMobile(mobile);
      setIsOpen(!mobile); // Auto-open/close based on device
    };
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleResize);
    return () => mediaQuery.removeEventListener('change', handleResize);
  }, []);

  const toggleSidebar = () => setIsOpen(!isOpen);

  // Mobile Layout
  if (isMobile) {
    return (
      <>
        {/* Always visible toggle button for Mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-50 bg-background/50 backdrop-blur-sm border border-border shadow-sm hover:bg-accent"
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-black/50 z-40"
              />
              
              {/* Sidebar Drawer */}
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed inset-y-0 left-0 z-50 w-[80%] max-w-[20rem] bg-background/95 backdrop-blur-md border-r border-border shadow-2xl overflow-hidden"
              >
                <SidebarContent isMobile={true} onClose={() => setIsOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Desktop Layout
  return (
    <>
      {/* Floating Toggle Button (moves with sidebar) */}
      <Button
        variant="ghost"
        size="icon"
        className={`fixed top-4 z-50 transition-all duration-300 ${
          isOpen ? 'left-[20.5rem]' : 'left-4'
        } bg-background/50 backdrop-blur-sm border border-border shadow-sm hover:bg-accent`}
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Collapsible Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isOpen ? "20rem" : "0rem" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative h-full bg-background/95 backdrop-blur-md border-r border-border flex flex-col shadow-2xl overflow-hidden whitespace-nowrap"
      >
        <div className="w-[20rem] h-full">
          <SidebarContent isMobile={false} onClose={() => setIsOpen(false)} />
        </div>
      </motion.aside>
    </>
  );
}
