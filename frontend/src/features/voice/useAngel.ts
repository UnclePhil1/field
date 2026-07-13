import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../app/AuthStore';
import { voiceApi, type VoiceAccess } from '../../lib/voiceApi';
import { ANGEL_INSTRUCTIONS, ANGEL_TOOLS, runAngelTool } from './angelTools';

const RATE = 24000;

export type AngelStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'locked' | 'error';

function floatToB64(f32: Float32Array): string {
  const pcm = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin);
}

function b64ToFloat(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) f32[i] = pcm[i] / 32768;
  return f32;
}

export function useAngel() {
  const { username } = useAuth();
  const [status, setStatus] = useState<AngelStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<VoiceAccess | null>(null);

  const refreshAccess = useCallback(async () => {
    try {
      const a = await voiceApi.status();
      setAccess(a);
      if (!a.subActive && a.trialsLeft <= 0) setStatus((s) => (s === 'idle' ? 'locked' : s));
      return a;
    } catch { return null; }
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayRef = useRef(0);
  const speakingRef = useRef(false);

  const stop = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    procRef.current?.disconnect();
    procRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    speakingRef.current = false;
    setStatus('idle');
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    setError(null);
    setTranscript('');
    setStatus('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      let token: string;
      try {
        const mint = await voiceApi.mint();
        token = mint.token;
        setAccess(mint);
      } catch (e) {
        const err = e as Error & { status?: number; data?: VoiceAccess };
        if (err.status === 402) {
          if (err.data) setAccess(err.data as VoiceAccess);
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          setStatus('locked');
          return;
        }
        throw e;
      }

      const ws = new WebSocket('wss://api.x.ai/v1/realtime?model=grok-voice-latest', [
        `xai-client-secret.${token}`,
      ]);
      wsRef.current = ws;

      const ctx = new AudioContext({ sampleRate: RATE });
      ctxRef.current = ctx;
      nextPlayRef.current = 0;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            voice: 'ara',
            instructions: ANGEL_INSTRUCTIONS,
            turn_detection: { type: 'server_vad' },
            tools: ANGEL_TOOLS,
            audio: {
              input: { format: { type: 'audio/pcm', rate: RATE } },
              output: { format: { type: 'audio/pcm', rate: RATE } },
            },
          },
        }));

        ws.send(JSON.stringify({
          type: 'response.create',
          response: {
            instructions: `The user just connected${username ? `; their username is "${username}"` : ''}. Greet them warmly by name${username ? '' : ' (no name known, just say hey there)'}, introduce yourself in one short line as Angel, FanField's live match guide, then ask what you can help them with. Keep the whole greeting to two short sentences.`,
          },
        }));

        const src = ctx.createMediaStreamSource(stream);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        procRef.current = proc;
        src.connect(proc);
        proc.connect(ctx.destination);
        proc.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: floatToB64(e.inputBuffer.getChannelData(0)),
          }));
        };
        setStatus('listening');
      };

      ws.onmessage = async (msg) => {
        const event = JSON.parse(typeof msg.data === 'string' ? msg.data : '{}');

        if (event.type === 'response.output_audio.delta' && event.delta) {
          const f32 = b64ToFloat(event.delta);
          const buf = ctx.createBuffer(1, f32.length, RATE);
          buf.getChannelData(0).set(f32);
          const node = ctx.createBufferSource();
          node.buffer = buf;
          node.connect(ctx.destination);
          const at = Math.max(ctx.currentTime, nextPlayRef.current);
          node.start(at);
          nextPlayRef.current = at + buf.duration;
          if (!speakingRef.current) { speakingRef.current = true; setStatus('speaking'); }
        }

        if (event.type === 'response.created') {
          setTranscript('');
        }

        if (event.type === 'response.output_audio_transcript.delta' && event.delta) {
          setTranscript((t) => t + event.delta);
        }

        if (event.type === 'response.done') {
          speakingRef.current = false;
          setStatus('listening');
        }

        if (event.type === 'response.function_call_arguments.done') {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(event.arguments ?? '{}'); } catch { /* empty */ }
          const result = await runAngelTool(event.name, args);
          ws.send(JSON.stringify({
            type: 'conversation.item.create',
            item: { type: 'function_call_output', call_id: event.call_id, output: JSON.stringify(result) },
          }));
          const waitMs = Math.max(0, (nextPlayRef.current - ctx.currentTime) * 1000);
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'response.create' }));
          }, waitMs + 120);
        }

        if (event.type === 'error') {
          setError(event.error?.message ?? 'Voice error');
        }
      };

      ws.onerror = () => { setError('Connection failed'); setStatus('error'); };
      ws.onclose = () => { if (wsRef.current === ws) stop(); };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start');
      setStatus('error');
      stop();
    }
  }, [stop, username]);

  return { status, transcript, error, access, refreshAccess, start, stop };
}
