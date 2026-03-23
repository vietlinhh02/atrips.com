// Types for function calls
export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface FunctionCallResult {
  functionCall: FunctionCall;
  result?: unknown;
  isLoading?: boolean;
}
