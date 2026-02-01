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
  Cpu 
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
  'Transformer', 
  'Diffusion', 
  'RNN', 
  'State Space Models'
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { selectedTag, setSelectedTag } = useFilter();

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

  const toggleSidebar = () => setIsOpen(!isOpen);

  const sidebarVariants = {
    open: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
    closed: { x: "-100%", opacity: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
  } as const;

  // Determine animation state
  const animateState = isMobile ? (isOpen ? "open" : "closed") : "open";

  return (
    <>
      {/* Mobile Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden bg-background/50 backdrop-blur-sm border border-border"
        onClick={toggleSidebar}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.aside
        initial={false}
        animate={animateState}
        variants={sidebarVariants}
        // Force style override on desktop to ensure visibility
        style={{ 
          width: '20rem',
          transform: !isMobile ? 'none' : undefined,
          opacity: !isMobile ? 1 : undefined
        }}
        className={`fixed top-0 left-0 h-full bg-background/95 backdrop-blur-md border-r border-border z-40 flex flex-col shadow-2xl md:translate-x-0 md:opacity-100 md:relative md:flex`}
      >
        <div className="p-6 flex items-center justify-between border-b border-border/50">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600">
            Research Hub
          </h2>
          {/* Desktop close button - usually hidden but good for flexibility */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
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
              >
                <Home className="h-4 w-4" />
                Home
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
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
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
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
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
      </motion.aside>
    </>
  );
}
