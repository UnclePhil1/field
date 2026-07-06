// Chat client. Sends go through the guarded function; history + live updates are
// read straight from the table over Realtime (RLS controls squad visibility).
import { supabase, functionsBase } from './supabase';

const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type ChatScope = 'match' | 'squad';

export interface ChatMessage {
  id: string;
  scope: ChatScope;
  scope_id: string;
  user_id: string;
  name: string;
  body: string;
  created_at: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;
  const res = await fetch(`${functionsBase}/chat${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: anonKey },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((out as { error?: string }).error ?? `Request failed (${res.status})`);
  return out as T;
}

export const chatApi = {
  history: async (scopeId: string): Promise<ChatMessage[]> => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('scope_id', scopeId)
      .order('created_at', { ascending: false })
      .limit(50);
    return ((data as ChatMessage[]) ?? []).reverse();
  },
  send: (scope: ChatScope, scopeId: string, body: string) => post<{ ok: boolean }>('', { scope, scopeId, body }),
  report: (messageId: string) => post<{ ok: boolean }>('/report', { messageId }),
};
