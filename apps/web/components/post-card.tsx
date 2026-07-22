"use client";
import { IconEye, IconMessageCircle, IconBookmark } from "./icons";
import { PostLikeButton } from "./post-like-button";

type PostCardData = {
  id: string;
  title: string;
  body?: string;
  created_at: string;
  author: { id?: string; display_name: string; avatar_url?: string | null };
  board?: { name: string; slug: string };
  tags?: string[];
  images?: string[];
  stats?: { views: number; likes: number; comments: number };
};

export function PostCard({ post }: { post: PostCardData }) {
  const authorHref = post.author.id ? `/users/${post.author.id}` : "#";
  return (
    <article className="post-card">
      {/* 头部: 头像+作者+时间 */}
      <div className="post-card__header">
        <a href={authorHref} className="post-card__avatar">
          {post.author.avatar_url ? <img src={post.author.avatar_url} alt={`${post.author.display_name}的头像`} /> : post.author.display_name[0]}
        </a>
        <div className="post-card__meta">
          <a href={authorHref} className="post-card__author">
            {post.author.display_name}
          </a>
          <span className="post-card__time">{new Date(post.created_at).toLocaleDateString("zh-CN")}</span>
        </div>
        {post.board && (
          <a href={`/boards/${post.board.slug}`} className="post-card__tag">
            {post.board.name}
          </a>
        )}
      </div>

      {/* 标题 */}
      <a href={`/posts/${post.id}`} className="post-card__title">
        {post.title}
      </a>

      {/* 正文预览 */}
      {post.body && (
        <p className="post-card__excerpt">{post.body}</p>
      )}

      {/* 图片预览 */}
      {post.images && post.images.length > 0 && (
        <div className={`post-card__images post-card__images--${Math.min(post.images.length, 3)}`}>
          {post.images.slice(0, 3).map((img, i) => (
            <div key={i} className="post-card__image">
              <img src={img} alt="" loading="lazy" />
            </div>
          ))}
        </div>
      )}

      {/* 互动栏 */}
      <div className="post-card__actions">
        <span className="post-card__action">
          <IconEye size={18} /> {post.stats?.views ?? 0}
        </span>
        <PostLikeButton postId={post.id} initialLikeCount={post.stats?.likes ?? 0} />
        <span className="post-card__action">
          <IconMessageCircle size={18} /> {post.stats?.comments ?? 0}
        </span>
        <span className="post-card__action">
          <IconBookmark size={18} /> 收藏
        </span>
      </div>
    </article>
  );
}
