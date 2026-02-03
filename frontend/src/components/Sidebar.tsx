import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
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
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { useFilter } from '@/contexts/FilterContext';

const SUBJECT_TAGS = [
  'World Models', 
  'Model-Based RL', 
  'Reinforcement Learning', 
  'Generative Models', 
  'Video Prediction', 
  'Robotics', 
  'Planning', 
  'Representation Learning'
];

const ARCHITECTURE_TAGS = [
  'Transformers', 
  'Diffusion Models', 
  'RNN', 
  'State Space Models'
];

interface SidebarContentProps {
  isMobile: boolean;
  onClose: () => void;
}

const SidebarContent = ({ isMobile, onClose }: SidebarContentProps) => {
  const { theme, toggleTheme } = useTheme();
  const { selectedTag, setSelectedTag, itemsPerPage, setItemsPerPage, sortBy, setSortBy } = useFilter();

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
        <span className="text-xs text-muted-foreground mt-1">v1.25</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
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
              onClick={() => setSelectedTag(null)}
            >
              <Home className="h-4 w-4" />
              Home
            </NavLink>
            <NavLink
              to="/trends"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium">Trends Dashboard</span>
            </NavLink>

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
                  setSelectedTag(selectedTag === tag ? null : tag);
                }}
                className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${
                  selectedTag === tag
                    ? "bg-cyan-500/10 text-cyan-500 font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Tag className="h-3 w-3 opacity-70" />
                {tag}
              </button>
            ))}
          </div>

          <div className="h-[1px] bg-border/50" />

          {/* Architecture Tags */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
              <Cpu className="h-3 w-3" /> Architectures
            </h3>
            {ARCHITECTURE_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedTag(selectedTag === tag ? null : tag);
                }}
                className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${
                  selectedTag === tag
                    ? "bg-purple-500/10 text-purple-500 font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Tag className="h-3 w-3 opacity-70" />
                {tag}
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
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(max-width: 767px)').matches;
    }
    return false;
  });

  // Handle responsive behavior
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleResize = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    
    // Initial check
    handleResize(mediaQuery);
    
    // Listen for changes
    mediaQuery.addEventListener('change', handleResize);
    return () => mediaQuery.removeEventListener('change', handleResize);
  }, []);

  // Auto-open/close based on device
  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

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
