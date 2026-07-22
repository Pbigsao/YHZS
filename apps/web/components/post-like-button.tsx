"use client";

import { useEffect, useState } from "react";
import { IconHeart } from "./icons";
import { createSupabaseBrowserClient } from "../lib/supabase";

export function PostLikeButton({ postId, initialLikeCount = 0 }: { postId: string; initialLikeCount?: number }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    void supabase.from("post_likes").select("post_id", { count: "exact", head: true }).eq("post_id", postId).then(({ count }) => {
      if (!cancelled) setLikeCount(count ?? initialLikeCount);
    });
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: existing } = await supabase.from("post_likes").select("post_id").eq("post_id", postId).eq("user_id", data.user.id).maybeSingle();
      if (!cancelled) setLiked(Boolean(existing));
    });

    return () => { cancelled = true; };
  }, [initialLikeCount, postId]);

  async function toggleLike() {
    if (submitting) return;
    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage("请先登录后点赞。");
      return;
    }

    setSubmitting(true);
    setMessage("");
    const { error } = liked
      ? await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", auth.user.id)
      : await supabase.from("post_likes").insert({ post_id: postId, user_id: auth.user.id });
    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }
    setLiked((value) => !value);
    setLikeCount((count) => Math.max(0, count + (liked ? -1 : 1)));
  }

  return (
    <span className="post-like">
      <button type="button" className={`post-card__action post-card__action--button ${liked ? "post-card__action--active" : ""}`} onClick={() => void toggleLike()} disabled={submitting} aria-pressed={liked}>
        <IconHeart size={18} /> {likeCount}
      </button>
      {message && <span className="post-like__message" role="status">{message}</span>}
    </span>
  );
}
