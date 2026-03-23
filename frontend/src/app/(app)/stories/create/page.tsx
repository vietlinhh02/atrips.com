'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, FloppyDisk } from '@phosphor-icons/react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import storyService from '@/src/services/storyService';
import type { Story } from '@/src/services/storyService';

type StoryStatus = 'DRAFT' | 'PUBLISHED';

function CreateStoryForm() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [status, setStatus] = useState<StoryStatus>('DRAFT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const story: Story = await storyService.create({
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim() || undefined,
        status,
      });
      router.push(`/stories/${story.slug}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to create story';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <button
        onClick={() => router.push('/stories')}
        className="flex items-center gap-1.5 text-sm text-[var(--neutral-60)] hover:text-[var(--primary-main)] transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Stories
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-2xl font-semibold text-[var(--neutral-100)] mb-6">
          Write a Story
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label
              htmlFor="story-title"
              className="block text-sm font-medium text-[var(--neutral-80)] mb-1.5"
            >
              Title
            </label>
            <Input
              id="story-title"
              type="text"
              placeholder="Give your story a title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 border-[var(--neutral-30)] text-base"
            />
          </div>

          <div>
            <label
              htmlFor="story-excerpt"
              className="block text-sm font-medium text-[var(--neutral-80)] mb-1.5"
            >
              Excerpt{' '}
              <span className="text-[var(--neutral-50)] font-normal">
                (optional)
              </span>
            </label>
            <Input
              id="story-excerpt"
              type="text"
              placeholder="A brief summary to entice readers..."
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="h-10 border-[var(--neutral-30)] text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="story-content"
              className="block text-sm font-medium text-[var(--neutral-80)] mb-1.5"
            >
              Content{' '}
              <span className="text-[var(--neutral-50)] font-normal">
                (Markdown supported)
              </span>
            </label>
            <Textarea
              id="story-content"
              placeholder="Share your travel experience... You can use Markdown for formatting."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[320px] border-[var(--neutral-30)] text-sm leading-relaxed resize-y"
              rows={16}
            />
          </div>

          <div>
            <label
              htmlFor="story-status"
              className="block text-sm font-medium text-[var(--neutral-80)] mb-1.5"
            >
              Status
            </label>
            <div className="flex gap-2">
              {(['DRAFT', 'PUBLISHED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
                    ${
                      status === s
                        ? 'bg-[var(--primary-surface)] text-[var(--primary-main)] border border-[var(--primary-outer-border)]'
                        : 'text-[var(--neutral-60)] hover:text-[var(--neutral-80)] hover:bg-[var(--neutral-20)] border border-[var(--neutral-30)]'
                    }`}
                >
                  {s === 'DRAFT' ? 'Save as Draft' : 'Publish'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-main)]/90 rounded-lg px-6 py-2.5 text-sm font-medium"
            >
              <FloppyDisk size={16} weight="bold" className="mr-1.5" />
              {isSubmitting
                ? 'Saving...'
                : status === 'PUBLISHED'
                  ? 'Publish Story'
                  : 'Save Draft'}
            </Button>
            <Button
              onClick={() => router.push('/stories')}
              variant="outline"
              className="rounded-lg px-6 py-2.5 text-sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function CreateStoryPage() {
  return (
    <>
      <div className="absolute inset-0 z-[-1] bg-gradient-to-b from-[var(--neutral-10)] via-[var(--primary-surface)]/60 to-[var(--neutral-10)] min-h-full" />
      <CreateStoryForm />
    </>
  );
}
