import { RegistrationForm } from './registration-form';
import { BrandLogo } from '@/components/brand-logo';
import { useEffect, useState } from 'react';
import { Layers, ArrowLeft, ArrowRight, User, LockKeyhole, Eye, EyeOff } from 'lucide-react';
import './login-page.css';
import './login-discord.css';

function DiscordIcon() {
  return <svg className="discord-logo" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515c-.211.375-.457.88-.626 1.281a18.27 18.27 0 0 0-5.417 0 13.53 13.53 0 0 0-.633-1.281A19.736 19.736 0 0 0 3.87 4.373C.78 8.95-.057 13.413.362 17.814a19.9 19.9 0 0 0 5.993 3.03c.483-.66.914-1.36 1.285-2.098a12.94 12.94 0 0 1-2.024-.985c.17-.124.336-.253.497-.386 3.903 1.803 8.144 1.803 12.001 0 .163.133.329.262.498.386-.644.38-1.321.71-2.026.987.372.736.801 1.438 1.285 2.097a19.87 19.87 0 0 0 6.002-3.031c.491-5.102-.839-9.525-3.556-13.444ZM8.02 15.12c-1.172 0-2.133-1.076-2.133-2.388 0-1.313.94-2.39 2.133-2.39 1.192 0 2.154 1.077 2.133 2.39 0 1.312-.941 2.388-2.133 2.388Zm7.96 0c-1.172 0-2.133-1.076-2.133-2.388 0-1.313.94-2.39 2.133-2.39 1.192 0 2.154 1.077 2.133 2.39 0 1.312-.94 2.388-2.133 2.388Z" />
  </svg>;
}

export function LoginPage({ busy, onLogin }: { busy: boolean; onLogin: (username: string, password: string) => Promise<boolean> }) {
  const [visible, setVisible] = useState(false);
  const [register, setRegister] = useState(false);
  const [error, setError] = useState('');
  const [discordEnabled, setDiscordEnabled] = useState<boolean | null>(null);
  const invite = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('invite') || '';
  const discordError = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('discord_error') || '';
  const discordMessages: Record<string, string> = {
    not_configured: 'Discord girişi henüz yapılandırılmadı.', invalid_invite: 'Davet bağlantısı geçersiz veya süresi dolmuş.',
    invite_required: 'Yeni hesap açmak için panel sahibinden Discord daveti al.', invalid_state: 'Discord oturumu doğrulanamadı. Tekrar dene.',
    denied: 'Discord izni verilmedi.', failed: 'Discord bağlantısı kurulamadı. Tekrar dene.',
    already_linked: 'Bu Discord hesabı başka bir panel hesabına bağlı.', login_required: 'Önce panel hesabına giriş yap.',
    inactive: 'Bu panel hesabının erişimi şu anda kapalı.',
  };
  useEffect(() => {
    fetch('/api/auth/discord/config').then((response) => response.json()).then((data) => setDiscordEnabled((data as { enabled?: boolean }).enabled === true)).catch(() => setDiscordEnabled(false));
  }, []);
  const discordUrl = `/api/auth/discord/start${invite ? `?invite=${encodeURIComponent(invite.trim())}` : ''}`;
  return <main className="fiveiso-login">
    <a href="https://fiveiso.com/" className="login-home"><ArrowLeft size={16} /> Ana sayfa</a>
    <div className="login-shell">
      <a href="https://fiveiso.com/" className="login-logo"><BrandLogo /></a>
      <section className="login-card">
        {register ? <RegistrationForm onBack={() => setRegister(false)} /> : <>
        <span className="login-eyebrow">KONTROL MERKEZİ</span>
        <h1>Tekrar hoş geldin.</h1>
        <p>Sunucularını ve ekibini yönetmek için giriş yap.</p>
        <form onSubmit={async (event) => { event.preventDefault(); setError(''); const values = new FormData(event.currentTarget); if (!(await onLogin(String(values.get('username')), String(values.get('password'))))) setError('Giriş yapılamadı. Hesap bilgilerini kontrol ederek tekrar dene.'); }}>
          <label htmlFor="fiveiso-username">Kullanıcı adı</label>
          <div className="login-input"><User size={18} /><input id="fiveiso-username" name="username" autoComplete="username" placeholder="Kullanıcı adın" required disabled={busy} /></div>
          <label htmlFor="fiveiso-password">Parola</label>
          <div className="login-input"><LockKeyhole size={18} /><input id="fiveiso-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Parolan" required disabled={busy} /><button type="button" aria-label={visible ? 'Parolayı gizle' : 'Parolayı göster'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" disabled={busy} type="submit">{busy ? 'Giriş yapılıyor…' : 'Giriş yap'}<ArrowRight size={18} /></button>
        </form>
        <div className="login-divider"><span>veya</span></div>
        {discordEnabled ? <a className="login-discord" href={discordUrl}><DiscordIcon />{invite ? 'Discord ile kayıt ol' : 'Discord ile giriş yap'}</a>
          : <button className="login-discord" disabled type="button"><DiscordIcon />Discord ile giriş yap</button>}
        {discordMessages[discordError] && <p className="login-error" role="status">{discordMessages[discordError]}</p>}
        <p className="registration-link">Hesabın yok mu? <button type="button" onClick={() => setRegister(true)}>Kayıt ol</button></p>
        </>}
      </section>
      <span className="login-copyright">© {new Date().getFullYear()} FiveISO</span>
    </div>
  </main>;
}
