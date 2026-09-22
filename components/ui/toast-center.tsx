'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; kind: ToastKind; expiresAt: number; closing?: boolean };
let nextId = 0;

export function notify(message: string, kind: ToastKind = 'info') {
  if (!message || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('fiveiso:notify', { detail: { message, kind } }));
}

export function ToastCenter() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const receive = (event: Event) => {
      const { message, kind = 'info' } = (event as CustomEvent<{ message: string; kind: ToastKind }>).detail;
      const id = ++nextId;
      setToasts((current) => [...current.slice(-4), { id, message, kind, expiresAt: Date.now() + 3200 }]);
    };
    const expiry = window.setInterval(() => {
      const now = Date.now();
      setToasts((current) => current
        .filter((toast) => toast.expiresAt > now)
        .map((toast) => toast.expiresAt - now <= 280 && !toast.closing ? { ...toast, closing: true } : toast));
    }, 100);
    window.addEventListener('fiveiso:notify', receive);
    return () => {
      window.clearInterval(expiry);
      window.removeEventListener('fiveiso:notify', receive);
    };
  }, []);
  return <div className="toast-center" aria-live="polite" aria-atomic="false">
    {toasts.map((toast) => {
      const Icon = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'error' ? AlertTriangle : Info;
      return <div className={`fiveiso-toast ${toast.kind}${toast.closing ? ' closing' : ''}`} role={toast.kind === 'error' ? 'alert' : 'status'} key={toast.id}>
        <div className="fiveiso-toast-icon"><Icon size={18} /></div>
        <div className="fiveiso-toast-copy">
          <strong>{toast.kind === 'success' ? 'İşlem tamamlandı' : toast.kind === 'error' ? 'İşlem başarısız' : 'Bilgilendirme'}</strong>
          <span>{toast.message}</span>
        </div>
        <button type="button" aria-label="Bildirimi kapat" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><X size={16} /></button>
        <i className="fiveiso-toast-progress" aria-hidden="true" />
      </div>;
    })}
  </div>;
}
