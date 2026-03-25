export interface FunctionCallEvent {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultEvent {
  name: string;
  result: unknown;
}

export interface SourceItem {
  title: string;
  url: string;
  snippet?: string;
}

export interface MessageAttachment {
  id: string;
  fileName: string;
  fileType: 'IMAGE' | 'DOCUMENT';
  mimeType: string;
  previewUrl?: string;
  publicUrl?: string;
  variants?: { thumb: string; card: string; hero: string; original: string };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  functionCalls?: FunctionCallEvent[];
  toolResults?: ToolResultEvent[];
  sources?: SourceItem[];
  clientMessageId?: string; // For idempotency on retry
  error?: boolean; // True if message failed to send
  suggestions?: string[]; // Quick-reply suggestions from AI
  attachments?: MessageAttachment[]; // Uploaded files attached to this message
}

