import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, Loader2, MessageSquare, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeleteDialog } from '@/components/DeleteDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { fetchComments, addComment, deleteComment } from '@/lib/api';
import { relativeTime } from '@/lib/time';
import { focusPanel, usePanelFocus } from '@/lib/panelFocus';
import type { Comment } from '@/types/comment';

interface Props {
  paperId: number;
  onOpenChange?: (open: boolean) => void;
}

export function CommentSection({ paperId, onOpenChange }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isFocused = usePanelFocus();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; dir: 'down' | 'up' }>({ top: 0, left: 0, dir: 'down' });

  const calcPos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const panelH = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const dir = spaceBelow >= panelH + 16 ? 'down' : 'up';
    setPos({
      left: Math.min(rect.left, window.innerWidth - 320 - 8),
      top: dir === 'down' ? rect.bottom + 8 : rect.top - panelH - 8,
      dir
    });
  }, []);

  const loadComments = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await fetchComments(paperId);
      setComments(data.comments);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  };

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) { focusPanel('comments'); loadComments(); calcPos(); }
    onOpenChange?.(next);
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setSubmitting(true);
    try {
      const comment = await addComment(paperId, input.trim());
      setComments(prev => [...prev, comment]);
      setInput('');
      showToast('Comment added!');
    } catch {
      showToast('Failed to add comment', 'error');
    } finally { setSubmitting(false); }
  };

  const confirmDelete = (commentId: number) => {
    setDeleteTarget(commentId);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteComment(deleteTarget);
      setComments(prev => prev.filter(c => c.id !== deleteTarget));
      showToast('Comment deleted', 'info');
    } catch {
      showToast('Failed to delete comment', 'error');
    } finally { setDeleteTarget(null); }
  };

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('scroll', calcPos, true);
      window.addEventListener('resize', calcPos);
      return () => {
        window.removeEventListener('scroll', calcPos, true);
        window.removeEventListener('resize', calcPos);
      };
    }
  }, [isOpen, calcPos]);

  const panel = isOpen && (
    <div
      ref={panelRef}
      className={`fixed w-80 border border-border/60 rounded-lg bg-card shadow-xl p-3 space-y-3 max-h-72 overflow-y-auto ${isFocused('comments') ? 'z-[100]' : 'z-[99]'}`}
      style={{ top: pos.top, left: pos.left }}
      onClick={() => focusPanel('comments')}
    >
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : loadError ? (
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground">Failed to load comments.</p>
          <Button variant="ghost" size="sm" onClick={loadComments} className="mt-1 text-xs h-7">Retry</Button>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No comments yet.</p>
      ) : (
        comments.map(c => (
          <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">
                <span className="font-medium text-foreground">{c.username}</span>
                {' · '}{relativeTime(c.created_at)}
              </p>
              <p className="text-foreground/90 leading-relaxed break-words">{c.content}</p>
            </div>
            {c.is_owner && (
              <button
                onClick={() => confirmDelete(c.id)}
                className="flex-shrink-0 p-1.5 rounded-full text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all duration-200"
                title="Delete comment"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))
      )}

      {user ? (
        <div className="flex items-center gap-2 pt-2.5 border-t border-border/50">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(); }}
            placeholder="Write a comment..."
            maxLength={2000}
            className="flex-1 bg-muted/40 rounded-full px-3.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50 transition-all duration-200"
            disabled={submitting}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!input.trim() || submitting}
            className="h-8 w-8 rounded-full active:scale-90 transition-transform duration-150 disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      ) : (
        <a href="/login" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
          <LogIn className="h-3 w-3" /> Login to comment
        </a>
      )}
    </div>
  );

  return (
    <div>
      <Button
        ref={btnRef}
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 active:scale-95 transition-all duration-200 h-8 px-3 rounded-full"
      >
        <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
        {isOpen ? 'Hide' : (comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'Comments')}
      </Button>

      {panel && createPortal(panel, document.body)}

      {deleteTarget !== null && (
        <DeleteDialog message="Delete this comment?" onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
