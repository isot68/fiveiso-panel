'use client';
import { useEffect, useState } from 'react';
import type { Action, PanelState, CustomerAccount } from '@/lib/panel-types';
const emptyState = (): PanelState => ({ servers: [], audit: [], bans: [], users: [] });
export function usePanel() {
  const [data, setData] = useState<PanelState>(emptyState());
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{
    username: string; role: string; manager?: boolean; permissions?: string[];
  }>({
    username: '',
    role: '',
  });
  const [error, setError] = useState('');
  async function request<T = unknown>(
    path: string,
    body?: unknown,
  ): Promise<T> {
    const r = await fetch(`/api${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      let message = 'Ana makinedeki panel servisine bağlanılamadı.';
      try {
        message = ((await r.json()) as { error?: string }).error || message;
      } catch {}
      throw Object.assign(new Error(message), { status: r.status });
    }
    return r.json() as Promise<T>;
  }
  async function readState(): Promise<PanelState> {
    try { return await request<PanelState>('/state'); }
    catch (error) {
      if ((error as { status?: number }).status !== 403) throw error;
      const account = await request<CustomerAccount>('/account');
      return { ...emptyState(), account };
    }
  }
  async function refresh() {
    try {
      setData(await readState());
      setError('');
    } catch (e) {
      if ([401, 403].includes((e as Error & { status: number }).status)) {
        setLive(false);
        setData(emptyState());
        setUser({ username: '', role: '' });
      }
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const state = await readState();
        const currentUser = state.account || await request<{ username: string; role: string }>('/me');
        if (!cancelled) {
          setUser(currentUser);
          setData(state);
          setLive(true);
        }
      } catch (e) {
        if (!cancelled && (e as Error & { status?: number }).status !== 401) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, [live]);
  async function login(username: string, password: string) {
    const u = await request<{ username: string; role: string; manager?: boolean; permissions?: string[] }>('/login', {
      username,
      password,
    });
    setUser(u);
    const state = await readState();
    setData(state);
    setLive(true);
    setError('');
  }
  async function logout() {
    if (live) await request('/logout', {});
    setLive(false);
    setUser({ username: '', role: '' });
    setData(emptyState());
    setError('');
  }
  async function action(serverId: string, action: Action) {
    if (live) {
      const queued = await request<{ id: string }>(`/servers/${encodeURIComponent(serverId)}/actions`, action);
      await refresh();
      return queued;
    }
    throw new Error('İşlem yapmak için giriş yapın.');
  }
  async function addServer(name: string, region: string, framework: string) {
    if (live) {
      const result = await request<{ id: string; token: string }>('/servers', {
        name,
        region,
        framework,
      });
      await refresh();
      return result;
    }
    throw new Error('Sunucu eklemek için giriş yapın.');
  }
  return {
    data,
    live,
    loading,
    user,
    error,
    login,
    logout,
    action,
    addServer,
    refresh,
    request,
  };
}
