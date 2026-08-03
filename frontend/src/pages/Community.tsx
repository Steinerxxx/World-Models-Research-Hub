import { useState, useEffect } from 'react';
import { MessageSquare, Plus, ArrowLeft, Send, X, Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteDialog } from '@/components/DeleteDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  fetchCommunityPosts,
  fetchCommunityPost,
  createCommunityPost,
  deleteCommunityPost,
  addCommunityReply,
  deleteCommunityReply
} from '@/lib/api';
import { relativeTime } from '@/lib/time';
import type { CommunityPost, CommunityPostDetail } from '@/types/comment';

// ── Post Detail View ─────────────────────────────────────────────────

function PostDetail({ post, onBack, onDeleted }: {
  post: CommunityPostDetail; onBack: () => void; onDeleted: () => void;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [replyInput, setReplyInput] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replies, setReplies] = useState(post.replies);
  const [showDeletePost, setShowDeletePost] = useState(false);
  const [deleteReplyId, setDeleteReplyId] = useState<number | null>(null);

  const handleReply = async () => {
    if (!replyInput.trim()) return;
    setReplySubmitting(true);
    try {
      const reply = await addCommunityReply(post.id, replyInput.trim());
      setReplies(prev => [...prev, reply]);
      setReplyInput('');
    } catch {
      showToast('Failed to reply', 'error');
    } finally { setReplySubmitting(false); }
  };

  const handleDeletePost = async () => {
    try {
      await deleteCommunityPost(post.id);
      showToast('Post deleted', 'info');
      setShowDeletePost(false);
      onDeleted();
    } catch {
      showToast('Failed to delete post', 'error');
    }
  };

  const handleDeleteReply = async () => {
    if (!deleteReplyId) return;
    try {
      await deleteCommunityReply(deleteReplyId);
      setReplies(prev => prev.filter(r => r.id !== deleteReplyId));
      showToast('Reply deleted', 'info');
    } catch {
      showToast('Failed to delete reply', 'error');
    } finally { setDeleteReplyId(null); }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to posts
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">{post.title}</h1>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{post.username}</span>
            {' · '}{relativeTime(post.created_at)}
          </p>
        </div>
        {post.is_owner && (
          <Button variant="ghost" size="sm" onClick={() => setShowDeletePost(true)}
            className="text-xs text-muted-foreground hover:text-destructive h-8">
            <X className="h-3.5 w-3.5 mr-1" /> Delete
          </Button>
        )}
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none mb-8 text-foreground/90 leading-relaxed whitespace-pre-wrap">
        {post.content}
      </div>

      <div className="border-t border-border/60 pt-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> {replies.length} Replies
        </h2>

        {replies.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No replies yet.</p>
        ) : (
          <div className="space-y-4">
            {replies.map(r => (
              <div key={r.id} className="flex items-start justify-between gap-3 pl-4 border-l-2 border-primary/10">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    <span className="font-medium text-foreground">{r.username}</span>
                    {' · '}{relativeTime(r.created_at)}
                  </p>
                  <p className="text-sm text-foreground/85 leading-relaxed break-words">{r.content}</p>
                </div>
                {r.is_owner && (
                  <button onClick={() => setDeleteReplyId(r.id)}
                    className="flex-shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {user ? (
        <div className="flex gap-2">
          <input
            value={replyInput}
            onChange={e => setReplyInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleReply(); }}
            placeholder="Write a reply..."
            className="flex-1 bg-card/50 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/30"
            disabled={replySubmitting}
          />
          <Button size="sm" onClick={handleReply} disabled={!replyInput.trim() || replySubmitting}>
            {replySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      ) : (
        <a href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <LogIn className="h-4 w-4" /> Login to reply
        </a>
      )}

      {showDeletePost && (
        <DeleteDialog message="Delete this post and all its replies?" onConfirm={handleDeletePost} onClose={() => setShowDeletePost(false)} />
      )}
      {deleteReplyId !== null && (
        <DeleteDialog message="Delete this reply?" onConfirm={handleDeleteReply} onClose={() => setDeleteReplyId(null)} />
      )}
    </div>
  );
}

// ── Main Community Page ──────────────────────────────────────────────

export default function Community() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [selectedPost, setSelectedPost] = useState<CommunityPostDetail | null>(null);
  const [postLoading, setPostLoading] = useState(false);

  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [postSubmitting, setPostSubmitting] = useState(false);

  const loadPosts = async (p: number) => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await fetchCommunityPosts(p);
      setPosts(data.posts);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadPosts(page); }, [page]); // eslint-disable-line react-hooks/set-state-in-effect

  const openPost = async (postId: number) => {
    setPostLoading(true);
    try {
      const post = await fetchCommunityPost(postId);
      setSelectedPost(post);
    } catch {
      showToast('Failed to load post', 'error');
    } finally { setPostLoading(false); }
  };

  const handleCreatePost = async () => {
    const title = newTitle.trim();
    const content = newContent.trim();
    if (!title || !content) return;

    setPostSubmitting(true);
    try {
      const newPost = await createCommunityPost(title, content);
      setPosts(prev => [newPost, ...prev]);
      setTotal(t => t + 1);
      setShowNewPost(false);
      setNewTitle('');
      setNewContent('');
    } catch {
      showToast('Failed to create post', 'error');
    } finally { setPostSubmitting(false); }
  };

  if (selectedPost) {
    return postLoading ? (
      <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    ) : (
      <PostDetail post={selectedPost} onBack={() => setSelectedPost(null)} onDeleted={() => { setSelectedPost(null); loadPosts(page); }} />
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Community</h1>
          <p className="text-muted-foreground text-sm">{total} discussions</p>
        </div>
        {user ? (
          <Button onClick={() => setShowNewPost(!showNewPost)} size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> New Post
          </Button>
        ) : (
          <a href="/login">
            <Button variant="outline" size="sm">
              <LogIn className="h-4 w-4 mr-1.5" /> Login to post
            </Button>
          </a>
        )}
      </div>

      {showNewPost && (
        <div className="mb-6 border border-border/60 rounded-xl bg-card/50 p-4 space-y-3">
          <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Post title" />
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full bg-transparent border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/30 min-h-[80px] resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm"
              onClick={() => { setShowNewPost(false); setNewTitle(''); setNewContent(''); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreatePost}
              disabled={!newTitle.trim() || !newContent.trim() || postSubmitting}>
              {postSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : loadError ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground mb-3">Failed to load posts.</p>
          <Button variant="outline" size="sm" onClick={() => loadPosts(page)}>Retry</Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="text-lg">No discussions yet.</p>
          <p className="text-sm mt-1">Be the first to start a conversation!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <div key={post.id} onClick={() => openPost(post.id)}
              className="border border-border/60 rounded-xl bg-card/50 p-4 hover:border-primary/20 hover:bg-card/80 cursor-pointer transition-all duration-200">
              <h3 className="font-semibold text-foreground mb-1.5">{post.title}</h3>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">{post.username}</span>
                {' · '}{relativeTime(post.created_at)}
                {' · '}
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> {post.reply_count} replies
                </span>
              </p>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-8">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            Prev
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
