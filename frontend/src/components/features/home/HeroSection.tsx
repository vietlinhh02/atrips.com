'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Microphone,
  ArrowElbowDownRight,
  GlobeHemisphereEast,
  AirplaneTilt,
  CreditCard,
  Buildings,
  BowlFood,
} from '@phosphor-icons/react';
import useChatStore from '@/src/stores/chatStore';
import useAuthStore from '@/src/stores/authStore';
import { toast } from '@/src/components/ui/use-toast';
import { savePendingMessage } from '@/src/lib/pendingChat';

const quickTags = [
  { icon: GlobeHemisphereEast, label: 'Best places in Germany' },
  { icon: AirplaneTilt, label: 'Where is Bali located?' },
  { icon: CreditCard, label: 'Nepal visa requirements' },
  { icon: Buildings, label: 'Best hotel in Bali' },
  { icon: BowlFood, label: 'Must-try food in Vietnam' },
];

export default function HeroSection() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [chatInput, setChatInput] = useState('');
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  const requireAuth = (message?: string) => {
    if (!isAuthenticated) {
      // Save pending message to sessionStorage before redirect
      if (message && message.trim()) {
        savePendingMessage(message.trim());
      }
      toast.error('Vui lòng đăng nhập để sử dụng tính năng này');

      // Smooth transition before redirect
      setIsRedirecting(true);
      setTimeout(() => {
        router.push('/login?redirect=/');
      }, 300);

      return false;
    }
    return true;
  };

  const createConversationStore = useChatStore((state) => state.createConversation);

  const startConversation = async (message: string) => {
    // Check auth first (passes message to save if not authenticated)
    if (!requireAuth(message)) return;

    const trimmed = message.trim();
    if (!trimmed || isStartingChat) return;

    setIsStartingChat(true);
    setChatError(null);

    try {
      chatAbortRef.current?.abort();
      // No need to create separate controller here if store handles it, 
      // but HeroSection logic seems independent of store's abort controller for now.
      // We'll keep the local ref for component unmount cleanup.
      const controller = new AbortController();
      chatAbortRef.current = controller;

      // Use store method to properly reset state
      const conversationId = await createConversationStore(
        undefined, // tripId
        trimmed.substring(0, 40) + (trimmed.length > 40 ? '...' : '') // title
      );

      if (conversationId) {
        // Navigate to the chat page with the message as a query parameter
        const encodedMessage = encodeURIComponent(trimmed);
        router.push(`/chat/${conversationId}?q=${encodedMessage}`);
      } else {
        throw new Error('Không thể tạo cuộc hội thoại');
      }

    } catch (error) {
      if (!chatAbortRef.current?.signal.aborted) {
        console.error('Failed to start conversation', error);
        setChatError('Không thể tạo cuộc hội thoại. Vui lòng thử lại.');
        setIsStartingChat(false);
      }
    } finally {
      if (!chatAbortRef.current?.signal.aborted) {
        setIsStartingChat(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      chatAbortRef.current?.abort();
    };
  }, []);

  return (
    <section className={`relative w-full min-h-[600px] md:h-[800px] flex flex-col items-center justify-center shrink-0 transition-all duration-500 ease-out ${isRedirecting
      ? 'opacity-0 scale-95 blur-sm'
      : isStartingChat
        ? 'opacity-50 scale-[0.98]'
        : 'opacity-100 scale-100'
      }`}>
      {/* Background Decorations */}
      <div
        className="absolute inset-0 z-0 pointer-events-none overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)]"
        aria-hidden="true"
      >
        {/* Subtle Travel Background Image from Unsplash */}
        <div className="absolute inset-0 opacity-[0.15] dark:opacity-[0.08] grayscale contrast-125">
          <Image
            src="https://images.unsplash.com/photo-1697850084120-4896a446a04d?q=80&w=1471&auto=format&fit=crop"
            alt="Ha Long Bay"
            width={1471}
            height={800}
            className="w-full h-full object-cover scale-110 animate-drift"
            unoptimized
          />
        </div>

        {/* Large Gradient Orbs with subtle motion */}
        <div className="absolute -left-32 top-20 w-[700px] h-[700px] rounded-full bg-gradient-to-br from-blue-100/40 via-cyan-50/30 to-transparent dark:from-blue-900/30 dark:via-cyan-900/20 blur-3xl animate-float-slow" />
        <div className="absolute right-0 top-0 w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-indigo-100/30 via-blue-50/20 to-transparent dark:from-indigo-900/25 dark:via-blue-950/15 blur-3xl animate-float-slower" />

        {/* Medium Floating Circles */}
        <div className="absolute left-[15%] top-[10%] w-[400px] h-[400px] rounded-full bg-gradient-to-br from-sky-200/20 via-blue-100/10 to-transparent dark:from-sky-800/15 dark:via-blue-900/10 blur-2xl animate-float-slower" />
        <div className="absolute right-[10%] top-[30%] w-[450px] h-[450px] rounded-full bg-gradient-to-bl from-cyan-200/20 via-sky-100/10 to-transparent dark:from-cyan-800/15 dark:via-sky-900/10 blur-2xl animate-float-slow" />
      </div>

      {/* Image Credit */}
      <div className="absolute bottom-4 left-4 md:left-6 z-10 opacity-60 hover:opacity-100 transition-opacity">
        <p className="text-[10px] text-[var(--neutral-60)] font-sans">Photo by Unsplash</p>
      </div>

      {/* Hero Content (Centered) */}
      <div className="relative z-10 w-full max-w-[800px] flex flex-col items-center gap-[30px] md:gap-[40px] px-4 md:px-6">
        {/* Hero Text */}
        <div className="flex flex-col items-center gap-[12px] text-center">
          <motion.p
            className="text-[12px] md:text-[14px] leading-[1.5] text-[var(--neutral-60)] font-sans flex items-center gap-1"
            animate={{
              x: [-50, 0, 0, 0],
              opacity: [0, 1, 1, 0]
            }}
            transition={{
              duration: 5,
              times: [0, 0.15, 0.85, 1],
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            Welcome to <span className="font-logo text-[16px] md:text-[18px]">atrips.me</span>, your travel companion.
          </motion.p>
          <div className="flex flex-wrap items-baseline justify-center gap-2">
            <motion.h1
              className="text-[32px] md:text-[48px] leading-[1.2] text-[var(--neutral-100)] font-medium font-sans"
              animate={{
                x: [-60, 0, 0, 0],
                opacity: [0, 1, 1, 0]
              }}
              transition={{
                duration: 5,
                times: [0, 0.15, 0.85, 1],
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.15
              }}
            >
              Top Summer Picks,
            </motion.h1>
            <motion.span
              className="font-script text-[40px] md:text-[56px] leading-[1.15] text-[var(--primary-main)]"
              animate={{
                x: [60, 0, 0, 0],
                opacity: [0, 1, 1, 0]
              }}
              transition={{
                duration: 5,
                times: [0, 0.15, 0.85, 1],
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.15
              }}
            >
              Just for You
            </motion.span>
          </div>
          <motion.p
            className="text-[12px] md:text-[14px] leading-[1.5] text-[var(--neutral-60)] max-w-[320px] md:max-w-[372px] font-sans"
            animate={{
              x: [-50, 0, 0, 0],
              opacity: [0, 1, 1, 0]
            }}
            transition={{
              duration: 5,
              times: [0, 0.15, 0.85, 1],
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.3
            }}
          >
            Explore destinations, travel tips, and curated plans to make your summer unforgettable.
          </motion.p>
        </div>

        {/* Search + Quick Tags */}
        <div className="flex w-full flex-col items-center gap-[20px] md:gap-[24px]">
          <div className="w-full">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                startConversation(chatInput);
              }}
              className="border border-[var(--neutral-30)] bg-[var(--neutral-20)] rounded-[6px] px-[12px] py-[12px] flex items-center gap-[8px] shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <Plus size={18} className="text-[var(--neutral-50)]" />
              </div>
              <input
                type="text"
                name="search"
                autoComplete="off"
                placeholder={isAuthenticated
                  ? "Ask anything — destinations, tips, or trip plans"
                  : "Sign in to ask AI about destinations, tips, or trip plans"
                }
                className="flex-1 bg-transparent border-none outline-none text-[14px] text-[var(--neutral-100)] placeholder:text-[var(--neutral-50)]"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                disabled={isStartingChat || isRedirecting}
              />
              <div className="flex items-center gap-2 text-[var(--neutral-50)]">
                <button
                  type="button"
                  className="flex items-center hover:text-[var(--neutral-70)] transition-colors disabled:opacity-50"
                  aria-label="Voice input"
                  disabled={isStartingChat || isRedirecting}
                >
                  <Microphone size={18} />
                </button>
                <button
                  type="submit"
                  className="flex items-center hover:text-[var(--neutral-70)] transition-colors disabled:opacity-50"
                  aria-label="Send message"
                  disabled={isStartingChat || isRedirecting}
                >
                  <ArrowElbowDownRight size={18} />
                </button>
              </div>
            </form>
            {chatError && <p className="mt-2 text-[12px] text-red-500">{chatError}</p>}

            {/* Redirecting Overlay */}
            <AnimatePresence mode="wait">
              {isRedirecting && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-white/80 dark:bg-[var(--neutral-10)]/80 backdrop-blur-sm flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="relative">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-10 h-10 rounded-full border-[3px] border-[var(--primary-surface)] border-t-[var(--primary-main)]"
                      />
                    </div>
                    <p className="text-sm font-medium text-[var(--neutral-60)]">Đang chuyển đến đăng nhập...</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col items-center gap-[12px]">
            <div className="flex flex-wrap justify-center gap-[12px]">
              {quickTags.slice(0, 3).map((tag, index) => (
                <button
                  key={index}
                  className="flex items-center gap-[4px] px-[12px] py-[6px] border border-[var(--neutral-40)] rounded-[4px] bg-white dark:bg-[var(--neutral-20)] hover:bg-[var(--neutral-20)] dark:hover:bg-[var(--neutral-30)] hover:border-[var(--neutral-50)] transition-all shadow-sm"
                  onClick={() => startConversation(tag.label)}
                  disabled={isStartingChat || isRedirecting}
                >
                  <tag.icon size={16} weight="fill" className="text-[var(--neutral-100)]" />
                  <span className="text-[14px] text-[var(--neutral-100)]">{tag.label}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-[12px]">
              {quickTags.slice(3).map((tag, index) => (
                <button
                  key={index}
                  className="flex items-center gap-[4px] px-[12px] py-[6px] border border-[var(--neutral-40)] rounded-[4px] bg-white dark:bg-[var(--neutral-20)] hover:bg-[var(--neutral-20)] dark:hover:bg-[var(--neutral-30)] hover:border-[var(--neutral-50)] transition-all shadow-sm"
                  onClick={() => startConversation(tag.label)}
                  disabled={isStartingChat || isRedirecting}
                >
                  <tag.icon size={16} weight="fill" className="text-[var(--neutral-100)]" />
                  <span className="text-[14px] text-[var(--neutral-100)]">{tag.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
