import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Send, User, Search, WandSparkles, GitBranch, Telescope, Sparkles, Trash2 } from 'lucide-react';
import { useFavorites } from '@/contexts/FavoritesContext';
import { API_BASE_URL } from '@/config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  SEARCH: <Search className="h-3 w-3" />,
  RECOMMEND: <WandSparkles className="h-3 w-3" />,
  ANALYZE: <Telescope className="h-3 w-3" />,
  SIMILAR: <GitBranch className="h-3 w-3" />,
};

const TOOL_LABELS: Record<string, string> = {
  SEARCH: 'Searching papers',
  RECOMMEND: 'Generating recommendations',
  ANALYZE: 'Analyzing paper',
  SIMILAR: 'Finding similar papers',
};

const SUGGESTIONS = [
  { icon: <Search className="h-3.5 w-3.5" />, text: 'Find papers about world models for robotics' },
  { icon: <WandSparkles className="h-3.5 w-3.5" />, text: 'Recommend papers based on my favorites' },
  { icon: <Telescope className="h-3.5 w-3.5" />, text: 'Analyze the paper DreamerV3' },
  { icon: <GitBranch className="h-3.5 w-3.5" />, text: 'What papers are similar to DreamerV3?' },
];

const STORAGE_KEY = 'research-chat-messages';

function loadMessages(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch { /* quota exceeded, ignore */ }
}

// ---- Module-level: runs independently of React lifecycle ----

async function sendToAgent(
  message: string,
  favorites: number[],
  prevMessages: Message[]
): Promise<Message> {
  const userMsg: Message = { role: 'user', content: message };
  const withUser = [...prevMessages, userMsg];
  saveMessages(withUser);

  try {
    const history = prevMessages.map(m => ({ role: m.role, content: m.content }));
    const res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, favorites, history }),
    });
    if (!res.ok) {
      await res.text().catch(() => {});
      const err: Message = { role: 'assistant', content: `Server error (${res.status}). Please try again.` };
      saveMessages([...withUser, err]);
      return err;
    }
    const data = await res.json();
    const assistant: Message = {
      role: 'assistant',
      content: data.answer || 'Sorry, I could not process your request.',
      toolsUsed: data.toolsUsed,
    };
    saveMessages([...withUser, assistant]);
    return assistant;
  } catch {
    // Network error (e.g. navigation disconnected fetch) — don't overwrite localStorage.
    // The mount-time polling will pick up the real response once the backend finishes.
    const err: Message = { role: 'assistant', content: 'Sorry, the AI service is currently unavailable. Please try again later.' };
    return err;
  }
}

// ---- Component ----

export default function Chat() {
  const { favorites } = useFavorites();
  const initial = loadMessages();
  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(initial[initial.length - 1]?.role === 'user');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // On mount: if the last message is from user (no response yet), poll until
  // the original sendToAgent (still running in background) writes its result.
  useEffect(() => {
    const stored = loadMessages();
    // If response already in localStorage from the initial load, nothing to do
    if (stored.length > initial.length) return;
    const last = stored[stored.length - 1];
    if (last?.role !== 'user') return;

    // loading already initialized to true from useState — just start polling
    const prevCount = stored.length;
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += 500;
      const latest = loadMessages();
      if (latest.length > prevCount) {
        setMessages(latest);
        setLoading(false);
        clearInterval(interval);
      } else if (elapsed >= 60000) {
        saveMessages([...latest, { role: 'assistant', content: 'Request timed out. Please try again.' }]);
        setMessages(loadMessages());
        setLoading(false);
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setLoading(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const handleSend = useCallback(
    async (text?: string) => {
      const trimmed = (text ?? input).trim();
      if (!trimmed || loading) return;

      setMessages(prev => [...prev, { role: 'user' as const, content: trimmed }]);
      setInput('');
      setLoading(true);

      // sendToAgent persists to localStorage — read back on completion
      await sendToAgent(trimmed, favorites, messages);
      setMessages(loadMessages());
      setLoading(false);
    },
    [input, loading, messages, favorites]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="container mx-auto px-4 pt-8 pb-6 max-w-3xl shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Research Assistant</h1>
            <p className="text-muted-foreground">
              AI-powered paper search, analysis & recommendations
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive mt-1"
              onClick={clearChat}
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto container mx-auto px-4 max-w-3xl py-4 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-8">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold text-foreground">Ask me anything</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  I can search papers, analyze research, find similar works, and give personalized recommendations.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s.text)}
                  className="group flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border/60 bg-background/50 text-left text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
                >
                  <span className="flex-shrink-0 text-primary/50 group-hover:text-primary transition-colors">
                    {s.icon}
                  </span>
                  <span className="line-clamp-2 leading-snug">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mt-0.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
              )}

              <div className={`max-w-[82%] space-y-2`}>
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {msg.toolsUsed.map(tool => (
                      <span
                        key={tool}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary ring-1 ring-primary/20"
                      >
                        {TOOL_ICONS[tool]}
                        {TOOL_LABELS[tool] || tool}
                      </span>
                    ))}
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted/60 text-foreground rounded-bl-md prose prose-sm dark:prose-invert max-w-none'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-primary flex items-center justify-center mt-0.5">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 justify-start"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-3 bg-muted/60 flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Thinking...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="container mx-auto px-4 pb-6 pt-3 max-w-3xl shrink-0">
        <div className="relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask me anything about the papers..."
            className="w-full h-12 pl-5 pr-12 rounded-2xl bg-background/60 border-border/60 focus-visible:ring-1 focus-visible:ring-primary/30 text-sm"
            disabled={loading}
          />
          <Button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            size="icon"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2.5">
          Research Assistant uses AI to search and analyze papers from the hub.
          {favorites.length > 0 && ` · ${favorites.length} favorites`}
        </p>
      </div>
    </div>
  );
}
