'use client';
import { useEffect } from 'react';

export function rememberScroll(key: string) {
  if (typeof window !== 'undefined') sessionStorage.setItem(key, String(window.scrollY));
}

export function useScrollMemory(key: string, ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    const saved = Math.max(0, Number(sessionStorage.getItem(key)) || 0);
    let restoring = saved > 0;
    let frame = 0;
    const restore = () => {
      if (!restoring) return;
      window.scrollTo(0, saved);
      if (Math.abs(window.scrollY - saved) < 2) {
        restoring = false;
        observer.disconnect();
      }
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(restore);
    });
    observer.observe(document.body);
    observer.observe(document.documentElement);
    frame = requestAnimationFrame(() => {
      if (saved) restore();
      else window.scrollTo(0, 0);
    });
    const onScroll = () => { if (!restoring) rememberScroll(key); };
    const onUserMove = () => {
      if (restoring) {
        restoring = false;
        observer.disconnect();
        rememberScroll(key);
      }
    };
    const onPageHide = () => rememberScroll(key);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onUserMove, { passive: true });
    window.addEventListener('touchstart', onUserMove, { passive: true });
    window.addEventListener('keydown', onUserMove);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onUserMove);
      window.removeEventListener('touchstart', onUserMove);
      window.removeEventListener('keydown', onUserMove);
      window.removeEventListener('pagehide', onPageHide);
      history.scrollRestoration = previousRestoration;
    };
  }, [key, ready]);
}
