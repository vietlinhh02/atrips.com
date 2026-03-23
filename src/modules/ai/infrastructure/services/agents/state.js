/**
 * LangGraph State Schema
 * Defines the shared state for the orchestrator graph.
 */

import { Annotation } from '@langchain/langgraph';

export const OrchestratorState = Annotation.Root({
  /** Conversation messages (LangChain BaseMessage[]) */
  messages: Annotation({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),

  /** Intent classification: 'simple' | 'complex' | 'trip_manage' */
  intent: Annotation({ reducer: (_, b) => b, default: () => 'simple' }),

  /** Subtask plan for complex queries */
  plan: Annotation({
    reducer: (_, b) => b,
    default: () => [],
  }),

  /** Aggregated results from subagents */
  subResults: Annotation({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => ({}),
  }),

  /** User ID for auth-required tools */
  userId: Annotation({ reducer: (_, b) => b, default: () => null }),

  /** Conversation ID for draft creation */
  conversationId: Annotation({ reducer: (_, b) => b, default: () => null }),

  /** User profile for personalization */
  userProfile: Annotation({ reducer: (_, b) => b, default: () => null }),

  /** System prompt */
  systemPrompt: Annotation({ reducer: (_, b) => b, default: () => '' }),

  /** Final text response */
  finalResponse: Annotation({ reducer: (_, b) => b, default: () => '' }),

  /** Collected tool calls for the response */
  toolCalls: Annotation({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),

  /** Token usage tracking */
  usage: Annotation({
    reducer: (a, b) => ({
      inputTokens: (a?.inputTokens || 0) + (b?.inputTokens || 0),
      outputTokens: (a?.outputTokens || 0) + (b?.outputTokens || 0),
    }),
    default: () => ({ inputTokens: 0, outputTokens: 0 }),
  }),
});
