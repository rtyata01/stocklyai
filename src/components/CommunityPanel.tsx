import { CardSkeleton } from "@/components/LoadingSkeletons";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Heart, Repeat2, MessageCircle, Trash2, Search, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { allTickers } from "@/data/stocks";
import { buildStockLink } from "@/lib/backNav";

interface Post {
  id: string;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  ticker: string;
  content: string;
  like_count: number;
  repost_count: number;
  comment_count: number;
  created_at: string;
}
interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

const TICKER_RE = /^[A-Z0-9.\-]{1,10}$/;

function score(p: Post) {
  const ageH = (Date.now() - new Date(p.created_at).getTime()) / 3_600_000;
  const engagement = p.like_count + p.repost_count * 2 + p.comment_count * 1.5;
  return (engagement + 1) / Math.pow(ageH + 2, 1.3);
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const CommunityPanel = () => {
  const { user, isAuthed } = useAuth();
  const location = useLocation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [myReposts, setMyReposts] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<"trending" | "latest" | "popular">("trending");
  const [search, setSearch] = useState("");
  const [filterTicker, setFilterTicker] = useState<string | null>(null);
  const [composeTicker, setComposeTicker] = useState("");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentText, setCommentText] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) toast.error("Could not load posts");
    setPosts((data as Post[]) ?? []);
    if (user) {
      const [l, r] = await Promise.all([
        supabase.from("community_likes").select("post_id").eq("user_id", user.id),
        supabase.from("community_reposts").select("post_id").eq("user_id", user.id),
      ]);
      setMyLikes(new Set((l.data ?? []).map((x) => x.post_id)));
      setMyReposts(new Set((r.data ?? []).map((x) => x.post_id)));
    }
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user?.id]);

  const sorted = useMemo(() => {
    const list = filterTicker ? posts.filter((p) => p.ticker === filterTicker) : posts;
    const copy = [...list];
    if (sort === "latest") copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else if (sort === "popular")
      copy.sort((a, b) => (b.like_count + b.repost_count * 2 + b.comment_count) - (a.like_count + a.repost_count * 2 + a.comment_count));
    else copy.sort((a, b) => score(b) - score(a));
    return copy;
  }, [posts, sort, filterTicker]);

  // Aggregate by symbol, ordered by best post ranking within each group
  const groups = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of sorted) {
      if (!map.has(p.ticker)) map.set(p.ticker, []);
      map.get(p.ticker)!.push(p);
    }
    return Array.from(map.entries());
  }, [sorted]);

  const symbolCounts = useMemo(() => {
    const m = new Map<string, number>();
    posts.forEach((p) => m.set(p.ticker, (m.get(p.ticker) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  const searchSuggestions = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return [];
    const pool = Array.from(new Set([...symbolCounts.map(([t]) => t), ...allTickers]));
    return pool.filter((t) => t.includes(q)).slice(0, 8);
  }, [search, symbolCounts]);

  const requireAuth = () => {
    if (!isAuthed) { toast.info("Sign in to join the conversation"); return false; }
    return true;
  };

  const createPost = async () => {
    if (!requireAuth() || !user) return;
    const t = composeTicker.trim().toUpperCase().replace(/^\$/, "");
    const c = content.trim();
    if (!TICKER_RE.test(t)) return toast.error("Choose a valid stock symbol");
    if (!c || c.length > 500) return toast.error("Post must be 1–500 characters");
    setPosting(true);
    const meta = user.user_metadata ?? {};
    const { data, error } = await supabase.from("community_posts").insert({
      user_id: user.id,
      ticker: t,
      content: c,
      author_name: (meta.full_name || meta.name || user.email?.split("@")[0] || "Investor").slice(0, 60),
      author_avatar: meta.avatar_url ?? null,
    }).select().single();
    setPosting(false);
    if (error) return toast.error("Could not publish post");
    setPosts((p) => [data as Post, ...p]);
    setContent("");
    toast.success(`Posted on $${t}`);
  };

  const toggle = async (post: Post, kind: "like" | "repost") => {
    if (!requireAuth() || !user) return;
    const set = kind === "like" ? myLikes : myReposts;
    const setter = kind === "like" ? setMyLikes : setMyReposts;
    const table = kind === "like" ? "community_likes" : "community_reposts";
    const field = kind === "like" ? "like_count" : "repost_count";
    const on = set.has(post.id);
    const next = new Set(set);
    on ? next.delete(post.id) : next.add(post.id);
    setter(next);
    setPosts((ps) => ps.map((p) => p.id === post.id ? { ...p, [field]: Math.max(0, p[field] + (on ? -1 : 1)) } : p));
    const res = on
      ? await supabase.from(table).delete().eq("post_id", post.id).eq("user_id", user.id)
      : await supabase.from(table).insert({ post_id: post.id, user_id: user.id });
    if (res.error) { toast.error("Action failed"); void load(); }
  };

  const loadComments = async (postId: string) => {
    if (openComments === postId) return setOpenComments(null);
    setOpenComments(postId);
    setCommentText("");
    const { data } = await supabase.from("community_comments").select("*").eq("post_id", postId).order("created_at");
    setComments((c) => ({ ...c, [postId]: (data as Comment[]) ?? [] }));
  };

  const addComment = async (postId: string) => {
    if (!requireAuth() || !user) return;
    const c = commentText.trim();
    if (!c || c.length > 300) return toast.error("Comment must be 1–300 characters");
    const meta = user.user_metadata ?? {};
    const { data, error } = await supabase.from("community_comments").insert({
      post_id: postId, user_id: user.id, content: c,
      author_name: (meta.full_name || meta.name || user.email?.split("@")[0] || "Investor").slice(0, 60),
    }).select().single();
    if (error) return toast.error("Could not comment");
    setComments((m) => ({ ...m, [postId]: [...(m[postId] ?? []), data as Comment] }));
    setPosts((ps) => ps.map((p) => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
    setCommentText("");
  };

  const deletePost = async (id: string) => {
    const { error } = await supabase.from("community_posts").delete().eq("id", id);
    if (error) return toast.error("Could not delete");
    setPosts((ps) => ps.filter((p) => p.id !== id));
  };

  return (
    <div className="pb-8 grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a stock symbol"
            className="pl-7 h-9 text-xs font-mono"
          />
          {searchSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-sm shadow-md">
              {searchSuggestions.map((t) => (
                <button
                  key={t}
                  className="block w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-accent"
                  onClick={() => { setFilterTicker(t); setComposeTicker(t); setSearch(""); }}
                >
                  ${t}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Symbols</div>
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={filterTicker ? "outline" : "default"}
              className="cursor-pointer font-mono text-[11px]"
              onClick={() => setFilterTicker(null)}
            >
              All
            </Badge>
            {symbolCounts.map(([t, n]) => (
              <Badge
                key={t}
                variant={filterTicker === t ? "default" : "outline"}
                className="cursor-pointer font-mono text-[11px]"
                onClick={() => { setFilterTicker(t); setComposeTicker(t); }}
              >
                ${t} · {n}
              </Badge>
            ))}
          </div>
        </div>
      </aside>

      <section className="space-y-4 min-w-0">
        <div className="border border-border rounded-sm p-3 bg-secondary/20 space-y-2">
          <div className="flex gap-2">
            <Input
              value={composeTicker}
              onChange={(e) => setComposeTicker(e.target.value.toUpperCase())}
              placeholder="Symbol"
              list="community-tickers"
              className="w-28 h-9 text-xs font-mono"
              maxLength={10}
            />
            <datalist id="community-tickers">
              {allTickers.map((t) => <option key={t} value={t} />)}
            </datalist>
            <span className="text-[11px] font-mono text-muted-foreground self-center">
              {isAuthed ? "Share your take" : <><Link to="/auth" className="text-primary underline">Sign in</Link> to post</>}
            </span>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={composeTicker ? `What's your view on $${composeTicker}?` : "Pick a symbol and share your view…"}
            maxLength={500}
            className="text-sm min-h-[70px]"
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono text-muted-foreground">{content.length}/500</span>
            <Button size="sm" onClick={createPost} disabled={posting || !content.trim() || !composeTicker} className="gap-1.5 text-xs">
              {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Post
            </Button>
          </div>
        </div>

        <div className="flex gap-1">
          {(["trending", "latest", "popular"] as const).map((s) => (
            <Button key={s} size="sm" variant={sort === s ? "default" : "ghost"} className="h-7 text-xs font-mono capitalize" onClick={() => setSort(s)}>
              {s}
            </Button>
          ))}
        </div>

        {loading ? (
          <CardSkeleton count={3} />
        ) : groups.length === 0 ? (
          <div className="text-xs font-mono text-muted-foreground py-8 text-center">No posts yet. Be the first to share a view.</div>
        ) : (
          groups.map(([ticker, list]) => (
            <div key={ticker} className="border border-border rounded-sm">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
                <button className="font-serif text-base text-foreground" onClick={() => { setFilterTicker(ticker); setComposeTicker(ticker); }}>
                  ${ticker}
                </button>
                <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                  <span>{list.length} post{list.length > 1 ? "s" : ""}</span>
                  <Link to={buildStockLink(ticker, location)} className="text-primary underline underline-offset-2">View</Link>
                </div>
              </div>
              <ul className="divide-y divide-border">
                {list.slice(0, filterTicker ? 100 : 5).map((p) => (
                  <li key={p.id} className="px-3 py-3">
                    <div className="flex items-start gap-2">
                      {p.author_avatar ? (
                        <img src={p.author_avatar} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-mono">
                          {p.author_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-foreground">{p.author_name}</span>
                          <span className="text-muted-foreground font-mono">· {timeAgo(p.created_at)}</span>
                          {user?.id === p.user_id && (
                            <button onClick={() => deletePost(p.id)} className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Delete post">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words mt-1">{p.content}</p>
                        <div className="flex gap-5 mt-2 text-xs font-mono text-muted-foreground">
                          <button onClick={() => toggle(p, "like")} className={`flex items-center gap-1 hover:text-rust ${myLikes.has(p.id) ? "text-rust" : ""}`} aria-label="Like">
                            <Heart className={`h-3.5 w-3.5 ${myLikes.has(p.id) ? "fill-current" : ""}`} /> {p.like_count}
                          </button>
                          <button onClick={() => toggle(p, "repost")} className={`flex items-center gap-1 hover:text-pine ${myReposts.has(p.id) ? "text-pine" : ""}`} aria-label="Repost">
                            <Repeat2 className="h-3.5 w-3.5" /> {p.repost_count}
                          </button>
                          <button onClick={() => loadComments(p.id)} className="flex items-center gap-1 hover:text-primary" aria-label="Comments">
                            <MessageCircle className="h-3.5 w-3.5" /> {p.comment_count}
                          </button>
                        </div>
                        {openComments === p.id && (
                          <div className="mt-3 space-y-2 border-l-2 border-border pl-3">
                            {(comments[p.id] ?? []).map((c) => (
                              <div key={c.id} className="text-xs">
                                <span className="font-medium text-foreground">{c.author_name}</span>{" "}
                                <span className="text-muted-foreground font-mono">· {timeAgo(c.created_at)}</span>
                                <p className="text-foreground mt-0.5 break-words">{c.content}</p>
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <Input
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && addComment(p.id)}
                                placeholder={isAuthed ? "Write a comment…" : "Sign in to comment"}
                                maxLength={300}
                                className="h-8 text-xs"
                              />
                              <Button size="sm" className="h-8 text-xs" onClick={() => addComment(p.id)}>Reply</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {!filterTicker && list.length > 5 && (
                <button className="w-full text-[11px] font-mono text-primary py-2 border-t border-border" onClick={() => setFilterTicker(ticker)}>
                  Show all {list.length} posts on ${ticker}
                </button>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
};

export default CommunityPanel;
