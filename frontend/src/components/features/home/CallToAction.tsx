'use client';

import { useRouter } from 'next/navigation';
import { Airplane } from '@phosphor-icons/react';
import useChatStore from '@/src/stores/chatStore';
import useAuthStore from '@/src/stores/authStore';

export default function CallToAction() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const createConversation = useChatStore((s) => s.createConversation);

  const handleStartPlanning = async () => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/');
      return;
    }
    const id = await createConversation(undefined, 'New Trip');
    if (id) {
      router.push(`/chat/${id}`);
    }
  };

  return (
    <section className="relative z-10 w-full py-16 md:py-24">
      <div className="max-w-[1000px] mx-auto px-4 md:px-6">
        <div className="bg-[var(--neutral-100)] rounded-[20px] p-8 md:p-12 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 dark:bg-white/[0.03] rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-[var(--primary-main)]/20 rounded-full translate-x-1/3 translate-y-1/3 blur-xl" />

          <div className="relative z-10">
            <Airplane size={48} className="text-[var(--primary-main)] mx-auto mb-6" weight="duotone" />
            <h2 className="text-[24px] md:text-[36px] font-medium text-white mb-4 font-sans">
              Ready to Plan Your Next Adventure?
            </h2>
            <p className="text-[var(--neutral-40)] max-w-xl mx-auto mb-8">
              Let AI help you build the perfect trip. Tell us where you want to go and we&apos;ll create a personalized itinerary just for you.
            </p>

            <button
              onClick={handleStartPlanning}
              className="h-12 px-8 bg-[var(--primary-main)] hover:bg-[var(--primary-hover)] text-white font-medium rounded-[8px] transition-colors"
            >
              Start Planning
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
