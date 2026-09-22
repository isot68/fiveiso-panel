import { ArrowUpRight, ArrowRight, Boxes, Users, MapPin, Shield, Terminal, Activity, Layers, Zap, ChevronDown, Server, BriefcaseBusiness } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useScrollMemory } from '../panel/use-scroll-memory';
import './landing.css';

const features = [
  { icon: Users, title: 'Oyuncular', text: 'Oyuncu bilgileri, karakter hesapları ve moderasyon işlemleri.', color: '#b79ae8' },
  { icon: MapPin, title: 'Canlı harita', text: 'Oyuncu konumlarını takip et, harita işaretlerini yönet.', color: '#71cad9' },
  { icon: Boxes, title: 'Sunucu envanteri', text: 'Eşyalar, kayıtlı araçlar, meslekler ve çeteler tek yerde.', color: '#a6cd83' },
  { icon: Terminal, title: 'Kaynaklar & konsol', text: 'Kaynak durumlarını görüntüle ve sunucu komutlarını gönder.', color: '#e6b28b' },
  { icon: Shield, title: 'Ekip yetkileri', text: 'Her ekip üyesine ihtiyacı olan bölümleri ve işlemleri aç.', color: '#db96b3' },
  { icon: Activity, title: 'İşlem kayıtları', text: 'Ekip işlemlerini, sonuçlarını ve sunucu durumunu takip et.', color: '#91aee8' },
];
export function LandingPage() {
  useScrollMemory('fiveiso:scroll:landing', true);
  const root = useRef<HTMLDivElement>(null);
  const [purchase, setPurchase] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const elements = root.current?.querySelectorAll('main > section:not(.landing-hero), .landing-feature-grid article');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    elements?.forEach((element) => { element.classList.add('scroll-reveal'); observer.observe(element); });
    return () => { observer.disconnect(); elements?.forEach((element) => element.classList.remove('scroll-reveal', 'reveal-visible')); };
  }, []);
  return <div className="fiveiso-landing" ref={root}>
    <header className="landing-nav landing-width">
      <a href="/" className="landing-brand" aria-label="FiveISO ana sayfa"><Layers size={26} strokeWidth={2.2} /> FiveISO<span>®</span></a>
      <nav aria-label="Ana menü"><a href="#ozellikler">Özellikler</a><a href="#panel">Panel</a><a href="#sorular">Sıkça sorulanlar</a></nav>
      <div className="landing-nav-actions"><a href="/panel" className="landing-button landing-button-small landing-button-outline">Panele giriş <ArrowUpRight size={17} /></a><button type="button" className="landing-button landing-button-small" onClick={() => setPurchase(true)}>Satın al <ArrowUpRight size={17} /></button></div>
    </header>
    {purchase && <div className="landing-purchase-overlay" onClick={() => setPurchase(false)}><section role="dialog" aria-modal="true" aria-labelledby="purchase-title" className="landing-purchase-dialog" onClick={(event) => event.stopPropagation()}><h2 id="purchase-title">FiveISO satın al</h2><p>Satış bağlantısı henüz tanımlanmadı.</p><button autoFocus className="landing-button" onClick={() => setPurchase(false)} onKeyDown={(event) => { if (event.key === 'Escape') setPurchase(false); }}>Kapat</button></section></div>}
    <main>
      <section className="landing-hero landing-width">
        <div className="landing-kicker"><span /> FIVEM SUNUCU YÖNETİMİ</div>
        <h1>Sunucun senin.<br /><span>Kontrol sende.</span></h1>
        <p>Oyuncuların, ekibin ve sunucu işlemlerin.<br />Hepsini tek bir merkezden yönet.</p>
        <div className="landing-actions"><a className="landing-button" href="/panel">Kontrol merkezine gir <ArrowUpRight size={19} /></a><a className="landing-link" href="#panel">Paneli keşfet <ArrowRight size={18} /></a></div>
        <div className="landing-platforms"><span>FiveISO AGENT İLE BAĞLANIR</span><b>FiveM</b><i /><b>QBCore</b><i /><b>Qbox</b></div>
      </section>
      <section id="panel" className="landing-preview-section landing-width" aria-label="Panel önizlemesi">
        <div className="landing-preview-label"><span><Layers size={15} /> FiveISO CONTROL CENTER</span><span>Arayüz önizlemesi · Örnek veriler</span></div>
        <div className="landing-preview">
          <aside><div className="preview-brand">N<span> / </span></div>{[[Activity, 'Kontrol merkezi'], [Users, 'Oyuncular'], [MapPin, 'Canlı konumlar'], [Boxes, 'Eşyalar'], [BriefcaseBusiness, 'Meslekler'], [Terminal, 'Konsol']].map(([Icon, label], i) => { const Glyph = Icon as typeof Activity; return <div key={String(label)} className={i === 0 ? 'active' : ''}><Glyph size={17} /><span>{String(label)}</span></div>; })}</aside>
          <div className="preview-main"><div className="preview-top"><span>Çalışma alanı / Kontrol merkezi</span><span><span className="preview-dot" /> FiveISO Roleplay</span></div><h2>Kontrol merkezi</h2>
            <div className="preview-stats">{[['128', 'Çevrimiçi oyuncu', '+12'], ['246', 'Aktif kaynak', 'Çalışıyor'], ['24 ms', 'Ortalama ping', 'Stabil']].map(([value, label, badge]) => <div key={label}><span>{label}<Activity size={16} /></span><strong>{value}</strong><small>{badge}</small></div>)}</div>
            <div className="preview-chart"><div><h3>Oyuncu trafiği</h3><span>Son 24 saat</span></div><svg viewBox="0 0 760 140" role="img" aria-label="Örnek oyuncu trafiği grafiği"><defs><linearGradient id="landing-chart" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b79ae8" stopOpacity=".25" /><stop offset="1" stopColor="#b79ae8" stopOpacity="0" /></linearGradient></defs><path d="M0 32H760 M0 70H760" fill="none" stroke="#ffffff08" /><path d="M0 106 45 96 85 102 125 76 170 84 215 60 260 68 305 47 350 65 395 31 440 43 485 25 535 39 585 14 630 29 680 10 720 21 760 8V140H0Z" fill="url(#landing-chart)" /><path d="M0 106 45 96 85 102 125 76 170 84 215 60 260 68 305 47 350 65 395 31 440 43 485 25 535 39 585 14 630 29 680 10 720 21 760 8" fill="none" stroke="#b79ae8" strokeWidth="2.5" strokeLinejoin="round" /></svg><div className="preview-times"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span></div></div>
            <div className="preview-bottom"><span><Shield size={17} /> Ekip yönetimi</span><span><Server size={17} /> Sunucu işlemleri</span><span><Zap size={17} /> Canlı veriler</span></div>
          </div>
        </div>
      </section>
      <section id="ozellikler" className="landing-features landing-width"><div className="landing-section-title"><span className="landing-kicker">TEK BİR ÇALIŞMA ALANI</span><h2>Yönetimin her parçası.<br /><span>Aynı merkezde.</span></h2><p>Sunucu yönetiminde kullandığın araçlar, FiveISO düzeniyle bir arada.</p></div><div className="landing-feature-grid">{features.map(({ icon: Icon, title, text, color }) => <article key={title}><span className="landing-feature-icon" style={{ color }}><Icon size={25} strokeWidth={1.8} /></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section className="landing-connection landing-width"><div><span className="landing-kicker">SUNUCUDAN MERKEZE</span><h2>Bağla. Yönet.<br /><span>Kontrolü elinde tut.</span></h2><p>FiveISO Agent sunucun ile panel arasında bağlantı kurar. Ekip üyeleri yetkileri dahilinde tarayıcıdan işlemlerini yürütür.</p><a className="landing-link" href="/panel">Çalışma alanını aç <ArrowUpRight size={18} /></a></div><div className="landing-flow"><div><Server /><strong>FiveM sunucun</strong><span>FiveISO Agent</span></div><span className="flow-line" /><div><Layers /><strong>FiveISO</strong><span>Kontrol merkezi</span></div></div></section>
      <section id="sorular" className="landing-faq landing-width"><div className="landing-section-title"><span className="landing-kicker">SIKÇA SORULANLAR</span><h2>Aklındaki sorular.</h2></div>{[
        ['FiveISO nasıl çalışır?', 'Sunucundaki FiveISO Agent, sunucu bilgilerini merkeze iletir ve yetkili panel işlemlerini sunucuda uygular.'],
        ['Ekibime farklı yetkiler verebilir miyim?', 'Evet. Ekip üyelerinin görebileceği bölümleri ve gerçekleştirebileceği işlemleri ayrı ayrı belirleyebilirsin.'],
        ['Paneli kullanmak için oyunda olmam gerekiyor mu?', 'Hayır. Merkez hesabınla tarayıcıdan giriş yapabilirsin. Canlı sunucu işlemleri için ajan bağlantısının açık olması gerekir.'],
        ['Sunucuyu panelden açıp kapatabilir miyim?', 'Sunucudan bağımsız çalışan FiveISO Host bağlı olduğunda başlatma, durdurma ve yeniden başlatma işlemlerini kullanabilirsin.'],
      ].map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</section>
      <section className="landing-cta landing-width"><Layers size={32} /><h2>Sunucunun yeni<br /><span>kontrol merkezi.</span></h2><a className="landing-button" href="/panel">FiveISO'a giriş yap <ArrowUpRight size={19} /></a></section>
    </main>
    <footer className="landing-footer landing-width"><a href="/" className="landing-brand"><Layers size={21} /> FiveISO</a><span>© {new Date().getFullYear()} FiveISO</span><a href="/panel">Panel <ArrowUpRight size={15} /></a></footer>
  </div>;
}

