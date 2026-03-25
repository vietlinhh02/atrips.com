'use client';

import useChatStore from '@/src/stores/chatStore';

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return String(tokens);
}

function getColorClass(used: number, limit: number): string {
  const remaining = (limit - used) / limit;
  if (remaining <= 0.1) return 'text-red-500';
  if (remaining <= 0.3) return 'text-yellow-500';
  return 'text-zinc-400';
}

export default function ConversationQuotaCounter() {
  const quota = useChatStore((s) => s.conversationQuota);

  if (!quota) return null;

  const msgColor = getColorClass(
    quota.messagesUsed,
    quota.messagesLimit,
  );
  const tokenColor = getColorClass(
    quota.tokensUsed,
    quota.tokensLimit,
  );

  return (
    <div className="flex items-center gap-2 px-3 py-1 text-xs">
      <span className={msgColor}>
        {quota.messagesUsed}/{quota.messagesLimit} messages
      </span>
      <span className="text-zinc-600">&bull;</span>
      <span className={tokenColor}>
        {formatTokens(quota.tokensUsed)}/
        {formatTokens(quota.tokensLimit)} tokens
      </span>
    </div>
  );
}
