import { useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Home,
  KeyRound,
  LogOut,
  Mail,
  Menu,
  Package,
  Server,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import type { CustomerAccount } from '@/lib/panel-types';
import './customer-home.css';

const packages = 'https://fiveiso.com/#fiyatlar';
const support = 'https://fiveiso.com/#destek';
const docs = 'https://fiveiso.com/kurulum.html';
export function CustomerHome({
  account,
  busy,
  onLogout,
}: {
  account: CustomerAccount;
  busy: boolean;
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status =
    account.status === 'expired'
      ? 'Süresi dolmuş'
      : account.status === 'suspended'
        ? 'Erişim durdurulmuş'
        : 'Paket bekleniyor';
  return (
    <div className="customer-home">
      <aside
        className={`customer-sidebar ${menuOpen ? 'is-open' : ''}`}
        aria-label="Hesap menüsü"
      >
        <a
          className="customer-brand"
          href="#home"
          onClick={() => setMenuOpen(false)}
        >
          <BrandLogo />
        </a>
        <span className="customer-nav-label">ÇALIŞMA ALANIN</span>
        <nav onClick={() => setMenuOpen(false)}>
          <a className="is-selected" href="#home">
            <Home size={19} /> Ana sayfa <ChevronRight size={15} />
          </a>
          <a href="#licenses">
            <KeyRound size={19} /> Lisanslarım
          </a>
          <a href="#servers">
            <Server size={19} /> Sunucularım{' '}
            <span className="customer-count">{account.serverCount}</span>
          </a>
          <span className="customer-nav-label">KEŞFET</span>
          <a href={packages}>
            <Package size={19} /> Paketler <ArrowUpRight size={15} />
          </a>
          <a href={docs}>
            <BookOpen size={19} /> Kurulum rehberi <ArrowUpRight size={15} />
          </a>
          <a href={support}>
            <CircleHelp size={19} /> Destek <ArrowUpRight size={15} />
          </a>
        </nav>
        <div className="customer-sidebar-bottom">
          <ShieldCheck size={21} />
          <div>
            <strong>FiveISO hesabın hazır</strong>
            <p>Sunucun için bir sonraki adım.</p>
          </div>
        </div>
        <button className="customer-logout" disabled={busy} onClick={onLogout}>
          <LogOut size={18} /> Çıkış yap
        </button>
        <small className="customer-copyright">
          © {new Date().getFullYear()} FiveISO
        </small>
      </aside>
      {menuOpen && (
        <button
          className="customer-backdrop"
          aria-label="Menüyü kapat"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="customer-body">
        <header className="customer-topbar">
          <button
            className="customer-menu-toggle"
            aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <span className="customer-breadcrumb">
            Hesabım <ChevronRight size={14} /> <strong>Ana sayfa</strong>
          </span>
          <div className="customer-profile">
            <div>
              <strong>{account.username}</strong>
              <span>{status}</span>
            </div>
            <span className="customer-avatar">
              {account.username.slice(0, 2).toLocaleUpperCase('tr-TR')}
            </span>
          </div>
        </header>
        <main id="home" className="customer-content">
          <div className="customer-page-title">
            <div>
              <span className="customer-eyebrow">FIVEISO / HESAP MERKEZİ</span>
              <h1>Ana sayfa</h1>
            </div>
            <span className="customer-session">
              <i /> Oturum açık
            </span>
          </div>
          <section className="customer-welcome customer-card">
            <div>
              <span className="customer-eyebrow">
                <Sparkles size={15} /> HER ŞEY BURADA BAŞLAR
              </span>
              <h2>
                Tekrar hoş geldin, <span>{account.username}</span>
              </h2>
              <p>
                {account.status === 'unconfigured'
                  ? 'Hesabın hazır. Bir paket seçerek sunucunu FiveISO ile yönetmeye başla.'
                  : 'Hesabını buradan takip edebilir, panel erişimin için destek alabilirsin.'}
              </p>
              <a className="customer-primary" href={packages}>
                Paketleri keşfet <ArrowUpRight size={17} />
              </a>
            </div>
            <div className="customer-welcome-art" aria-hidden="true">
              <ShieldCheck />
            </div>
          </section>
          <div className="customer-stats">
            {[
              {
                Icon: Activity,
                label: 'Hesap durumu',
                value: 'Oturum açık',
                tone: 'green',
              },
              {
                Icon: KeyRound,
                label: 'Paket durumu',
                value: status,
                tone: 'purple',
              },
              {
                Icon: Server,
                label: 'Atanan sunucular',
                value: String(account.serverCount),
                tone: 'cyan',
              },
              {
                Icon: Mail,
                label: 'E-posta doğrulaması',
                value: account.emailVerified ? 'Doğrulandı' : 'Doğrulanmamış',
                tone: 'peach',
              },
            ].map(({ Icon, label, value, tone }) => (
              <article
                className={`customer-card customer-stat ${tone}`}
                key={label}
              >
                <span className="customer-stat-icon">
                  <Icon size={22} />
                </span>
                <div>
                  <p>{label}</p>
                  <strong>{value}</strong>
                </div>
              </article>
            ))}
          </div>
          <section id="servers" className="customer-card customer-servers">
            <div className="customer-section-heading">
              <h2>
                <Server size={19} /> Sunucularım
              </h2>
              <span>{account.serverCount} sunucu</span>
            </div>
            <div className="customer-empty">
              <span className="customer-empty-icon">
                <Server size={29} />
              </span>
              <h3>
                {account.serverCount
                  ? 'Sunucu erişimin şu anda kapalı'
                  : 'Henüz bir sunucun yok'}
              </h3>
              <p>
                {account.serverCount
                  ? 'Paketini yenilemek veya erişim durumunu öğrenmek için destek ekibiyle iletişime geç.'
                  : 'Paketin etkinleştirildiğinde sunucuların burada görünecek. Kurulumdan canlı yönetime kadar her şey tek panelde.'}
              </p>
              <a
                className="customer-secondary"
                href={account.serverCount ? support : packages}
              >
                {account.serverCount ? 'Destek al' : 'Paketleri incele'}
                <ArrowUpRight size={16} />
              </a>
            </div>
          </section>
          <div className="customer-bottom-grid">
            <section id="licenses" className="customer-card customer-detail">
              <h2>
                <KeyRound size={19} /> Lisans özeti
              </h2>
              <dl>
                <div>
                  <dt>Paket</dt>
                  <dd className="customer-status">{status}</dd>
                </div>
                <div>
                  <dt>Sunucu sayısı</dt>
                  <dd>{account.serverCount}</dd>
                </div>
                <div>
                  <dt>Bitiş tarihi</dt>
                  <dd>
                    {account.expires
                      ? new Date(account.expires).toLocaleDateString('tr-TR')
                      : account.hasPackage
                        ? 'Süresiz'
                        : '—'}
                  </dd>
                </div>
              </dl>
              <a className="customer-text-link" href={packages}>
                Sana uygun paketi bul <ArrowUpRight size={15} />
              </a>
            </section>
            <section className="customer-card customer-detail">
              <h2>
                <BookOpen size={19} /> Faydalı bağlantılar
              </h2>
              <a className="customer-resource" href={docs}>
                <span>
                  <BookOpen size={18} />
                  <span>
                    <strong>Kurulum rehberi</strong>
                    <small>İlk adımından sunucu bağlantısına</small>
                  </span>
                </span>
                <ArrowUpRight size={17} />
              </a>
              <a className="customer-resource" href={support}>
                <span>
                  <CircleHelp size={18} />
                  <span>
                    <strong>Destek merkezi</strong>
                    <small>Soruların için bize ulaş</small>
                  </span>
                </span>
                <ArrowUpRight size={17} />
              </a>
            </section>
            <section className="customer-card customer-detail">
              <h2>
                <ShieldCheck size={19} /> Hesap kontrolü
              </h2>
              <ul className="customer-checklist">
                <li>
                  <span className="done">
                    <Check size={14} />
                  </span>{' '}
                  Hesap oluşturuldu
                </li>
                <li>
                  <span className={account.emailVerified ? 'done' : ''}>
                    {account.emailVerified ? (
                      <Check size={14} />
                    ) : (
                      <Mail size={14} />
                    )}
                  </span>{' '}
                  E-posta{' '}
                  {account.emailVerified ? 'doğrulandı' : 'doğrulanmamış'}
                </li>
                <li>
                  <span>
                    <Package size={14} />
                  </span>{' '}
                  {account.hasPackage
                    ? 'Paket erişimi bekleniyor'
                    : 'Paket seçimi bekleniyor'}
                </li>
              </ul>
            </section>
          </div>
          <footer className="customer-footer">
            FiveISO <span>Sunucun. Kontrolün.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
