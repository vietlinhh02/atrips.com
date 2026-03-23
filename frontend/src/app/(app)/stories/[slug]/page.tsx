'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Eye,
  Heart,
  ChatCircle,
  PaperPlaneTilt,
  PenNib,
} from '@phosphor-icons/react';
import { format } from 'date-fns';
import { Button } from '@/src/components/ui/button';
import { Textarea } from '@/src/components/ui/textarea';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/src/components/ui/avatar';
import storyService from '@/src/services/storyService';
import type { Story, StoryComment } from '@/src/services/storyService';
import { getDefaultAvatarUrl } from '@/src/lib/avatar';

function StoryDetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8 animate-pulse">
      <div className="h-8 bg-[var(--neutral-30)] rounded w-3/4 mb-4" />
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-[var(--neutral-30)]" />
        <div className="space-y-2">
          <div className="h-4 bg-[var(--neutral-30)] rounded w-32" />
          <div className="h-3 bg-[var(--neutral-20)] rounded w-24" />
        </div>
      </div>
      <div className="h-64 bg-[var(--neutral-30)] rounded-xl mb-8" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-[var(--neutral-20)] rounded"
            style={{ width: `${70 + Math.random() * 30}%` }}
          />
        ))}
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: StoryComment;
  depth?: number;
}

function CommentItem({ comment, depth = 0 }: CommentItemProps) {
  const avatarSeed = comment.User.name || comment.User.id;
  const displayName = comment.User.displayName || comment.User.name;

  return (
    <div className={depth > 0 ? 'ml-8 mt-3' : 'mt-4'}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage
            src={
              comment.User.avatarUrl ??
              getDefaultAvatarUrl(null, avatarSeed)
            }
            alt={displayName}
          />
          <AvatarFallback className="text-[10px]">
            {displayName.charAt(0)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--neutral-100)]">
              {displayName}
            </span>
            <span className="text-xs text-[var(--neutral-50)]">
              {format(new Date(comment.createdAt), 'MMM d, yyyy')}
            </span>
          </div>
          <p className="text-sm text-[var(--neutral-70)] mt-1 whitespace-pre-wrap">
            {comment.content}
          </p>
        </div>
      </div>

      {comment.other_story_comments?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
      ))}
    </div>
  );
}

function StoryDetailContent() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [story, setStory] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);

  const [comments, setComments] = useState<StoryComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const fetchStory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await storyService.getBySlug(slug);
      setStory(data);
      setLikeCount(data._count?.story_likes ?? data.likesCount);
      if (data.story_comments) {
        setComments(data.story_comments);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load story';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchStory();
  }, [fetchStory]);

  const handleToggleLike = async () => {
    if (!story || isLiking) return;
    setIsLiking(true);
    try {
      const result = await storyService.toggleLike(story.id);
      setLiked(result.liked);
      setLikeCount((prev) => (result.liked ? prev + 1 : prev - 1));
    } catch {
      // Silently fail for likes
    } finally {
      setIsLiking(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!story || !commentText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const newComment = await storyService.addComment(story.id, {
        content: commentText.trim(),
      });
      setComments((prev) => [newComment, ...prev]);
      setCommentText('');
    } catch {
      // Let the user try again
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (isLoading) return <StoryDetailSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <Button
          onClick={fetchStory}
          variant="outline"
          className="text-sm"
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (!story) return null;

  const author = story.User;
  const commentCount = story._count?.story_comments ?? 0;
  const publishedDate = story.publishedAt ?? story.createdAt;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <button
        onClick={() => router.push('/stories')}
        className="flex items-center gap-1.5 text-sm text-[var(--neutral-60)] hover:text-[var(--primary-main)] transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Stories
      </button>

      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--neutral-100)] mb-4 leading-tight">
          {story.title}
        </h1>

        {author && (
          <div className="flex items-center gap-3 mb-6">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={
                  author.avatarUrl ??
                  getDefaultAvatarUrl(undefined, author.name)
                }
                alt={author.displayName || author.name}
              />
              <AvatarFallback>
                {(author.displayName || author.name).charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-[var(--neutral-100)]">
                {author.displayName || author.name}
              </p>
              <p className="text-xs text-[var(--neutral-50)]">
                {format(new Date(publishedDate), 'MMMM d, yyyy')}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-5 mb-6 text-sm text-[var(--neutral-60)]">
          <span className="flex items-center gap-1.5">
            <Eye size={16} /> {story.viewsCount} views
          </span>
          <span className="flex items-center gap-1.5">
            <Heart size={16} /> {likeCount} likes
          </span>
          <span className="flex items-center gap-1.5">
            <ChatCircle size={16} /> {commentCount} comments
          </span>
        </div>

        {story.coverImage && (
          <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden mb-8">
            <Image
              src={story.coverImage}
              alt={story.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 720px"
              priority
            />
          </div>
        )}

        <div className="prose prose-neutral max-w-none text-[var(--neutral-80)] text-[15px] leading-relaxed mb-10">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {story.content}
          </ReactMarkdown>
        </div>

        <div className="border-t border-[var(--neutral-30)] pt-6 mb-8">
          <Button
            onClick={handleToggleLike}
            disabled={isLiking}
            variant="outline"
            className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
              liked
                ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                : 'border-[var(--neutral-30)] text-[var(--neutral-70)] hover:bg-[var(--neutral-20)]'
            }`}
          >
            <Heart
              size={18}
              weight={liked ? 'fill' : 'regular'}
              className={`mr-1.5 ${liked ? 'text-red-500' : ''}`}
            />
            {liked ? 'Liked' : 'Like'} ({likeCount})
          </Button>
        </div>

        <div className="border-t border-[var(--neutral-30)] pt-6">
          <h3 className="text-lg font-semibold text-[var(--neutral-100)] mb-4 flex items-center gap-2">
            <ChatCircle size={20} />
            Comments ({comments.length})
          </h3>

          <div className="flex gap-3 mb-6">
            <Textarea
              placeholder="Share your thoughts..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 min-h-[80px] border-[var(--neutral-30)] text-sm resize-none"
              rows={3}
            />
            <Button
              onClick={handleSubmitComment}
              disabled={!commentText.trim() || isSubmittingComment}
              className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-main)]/90 rounded-lg px-4 self-end"
            >
              <PaperPlaneTilt size={16} weight="fill" />
            </Button>
          </div>

          {comments.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <PenNib
                size={32}
                weight="duotone"
                className="text-[var(--neutral-40)] mb-3"
              />
              <p className="text-sm text-[var(--neutral-60)]">
                No comments yet. Be the first to share your thoughts.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--neutral-20)]">
              {comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          )}
        </div>
      </motion.article>
    </div>
  );
}

export default function StoryDetailPage() {
  return (
    <>
      <div className="absolute inset-0 z-[-1] bg-gradient-to-b from-[var(--neutral-10)] via-[var(--primary-surface)]/60 to-[var(--neutral-10)] min-h-full" />
      <StoryDetailContent />
    </>
  );
}
