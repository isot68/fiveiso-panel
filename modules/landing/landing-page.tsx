import { BrandLogo } from '@/components/brand-logo';
import { ArrowUpRight, ArrowRight, Activity, BookOpen, Check, ChevronDown, Code2, Crown, Layers, MapPin, Maximize2, MessageCircle, Server, ShieldCheck, Terminal, Users, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useScrollMemory } from '../panel/use-scroll-memory';
import './landing.css';

const panelUrl = 'https://panel.fiveiso.com/';
const preview = '/assets/panel-overview.webp?v=brand';
const features = [
  { icon: Layers, title: 'Gelişmiş web yönetim paneli', text: 'Sunucularını, oyuncularını, kaynaklarını ve ekip işlemlerini tek bir tarayıcı ekranından yönet.' },
  { icon: MapPin, title: 'Canlı oyuncu haritası', text: 'Oyuncu konumlarını takip et. Harita işaretleri ve yetkili konum işlemleriyle sahadaki ekibine destek ol.' },
  { icon: Users, title: 'Oyuncu ve karakter bilgileri', text: 'Karakter hesapları, araçlar, meslekler ve envanter bilgilerini sunucu adaptörünün sunduğu kapsamda incele.' },
  { icon: Terminal, title: 'Kaynaklar ve konsol', text: 'Kaynak durumlarını izle, yetkin dahilinde yeniden başlat ve FiveM konsol komutlarının sonuçlarını gör.' },
  { icon: ShieldCheck, title: 'Ayrıntılı ekip yetkileri', text: 'Her ekip üyesine görevine uygun erişim ver. Görüntüleme ve işlem yetkilerini ayrı ayrı belirle.' },
  { icon: Activity, title: 'İşlem kayıtları', text: 'Kim, hangi sunucuda, hangi işlemi yaptı? Moderasyon ve sunucu işlemlerinin sonuçlarını takip et.' },
];
const benefits = [
  { icon: Server, title: 'Birden fazla sunucu', text: 'Farklı makinelerdeki FiveM sunucularını aynı merkezde topla ve çalışma alanları arasında geçiş yap.' },
  { icon: ShieldCheck, title: 'Kontrollü erişim', text: 'Sunucu anahtarları, hesap yetkileri ve müşteri bazında erişim kontrolleriyle işlemlerini sınırlandır.' },
  { icon: Users, title: 'Ekip için tasarlandı', text: 'Oyuncu bilgilerini, yetkileri ve işlem geçmişini ekibinin günlük çalışma düzenine taşı.' },
  { icon: Code2, title: 'Framework adaptörleri', text: 'QBCore, Qbox ve ESX için sunucu verilerine bağlanan adaptörlerle mevcut kurulumuna uyum sağla.' },
];
const questions = [
  ['FiveISO nasıl çalışır?', 'FiveM sunucuna kurulan fiveiso kaynağı panelin HTTPS API’sine bağlanır. Sunucu verilerini iletir, yetkili işlemleri alır ve sonuçlarını panele bildirir. Komut bildirimleri için WebSocket kanalı kullanılır.'],
  ['Web paneli ayrı bir kurulum gerektiriyor mu?', 'Ekibin panel.fiveiso.com adresinden tarayıcıyla giriş yapar. FiveM sunucusuna ise fiveiso kaynağı kurulur ve panelin ürettiği sunucu kimliği ile anahtar tanımlanır.'],
  ['Hangi framework’ler destekleniyor?', 'QBCore, Qbox ve ESX adaptörleri bulunur. Veritabanı, garaj ve envanter özellikleri sunucundaki kaynaklara ve yapılandırmaya göre değişebilir.'],
  ['Ekip üyelerimin yetkilerini ayırabilir miyim?', 'Evet. Hangi bölümlerin görüleceğini ve hangi işlemlerin yapılabileceğini rol ve hesap yetkileriyle belirleyebilirsin. Yetki kontrolleri API tarafında da uygulanır.'],
  ['Sunucuyu panelden açıp kapatabilir miyim?', 'FiveM dışında çalışan FiveISO Host yapılandırıldığında sunucu başlatma, durdurma ve yeniden başlatma işlemleri kullanılabilir. Yalnızca fiveiso kaynağının kurulması bu işlev için yeterli değildir.'],
  ['FiveISO bir anticheat ürünü mü?', 'FiveISO bir sunucu yönetim ve moderasyon merkezidir. Oyuncu, kaynak, yetki ve kayıt araçları sunar; anticheat algılama ürünü olarak sunulmaz.'],
  ['Canlı ekran ve oyuncu araçları nasıl açılır?', 'İlgili modülün ve hesap yetkisinin açık olması, FiveM kaynağının bağlı olması gerekir. Araçların kullanılabilirliği sunucunun bildirdiği özelliklere bağlıdır.'],
  ['Kurulum adımlarını nerede bulabilirim?', 'Aşağıdaki kurulum rehberinde kaynak klasörü, server.cfg bağlantı ayarları ve ilk bağlantı kontrolleri bulunur. Sunucu anahtarını yalnızca kendi sunucu yapılandırmanda sakla.'],
];

export function LandingPage() {
  useScrollMemory('fiveiso:scroll:landing', true);
  const lightbox = useRef<HTMLDialogElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const elements = Array.from(root.current?.querySelectorAll<HTMLElement>(
      '.landing-hero-copy, .landing-hero-preview, .landing-section-head, .landing-frameworks, .landing-feature-grid article, .landing-dashboard-layout, .landing-price-card, .landing-benefits article, .landing-faq details, .landing-support'
    ) || []);
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        entry.target.classList.toggle('landing-revealed', entry.isIntersecting);
      }
    }, { threshold: 0.08, rootMargin: '-24px 0px -24px 0px' });
    for (const element of elements) {
      const siblings = Array.from(element.parentElement?.children || []);
      const stagger = element.matches('article') ? siblings.indexOf(element) % 3 * 90 : 0;
      element.style.setProperty('--reveal-delay', `${stagger}ms`);
      element.classList.add('landing-reveal');
      observer.observe(element);
    }
    return () => {
      observer.disconnect();
      for (const element of elements) {
        element.classList.remove('landing-reveal', 'landing-revealed');
        element.style.removeProperty('--reveal-delay');
      }
    };
  }, []);
  return <div className="fiveiso-landing" ref={root}>
    <header className="landing-nav landing-width">
      <a href="/" className="landing-brand" aria-label="FiveISO ana sayfa"><BrandLogo /></a>
      <nav aria-label="Ana menü"><a href="#ozellikler">Özellikler</a><a href="#fiyatlar">Paketler</a><a href="#sorular">SSS</a><a href="#destek">İletişim</a></nav>
      <div className="landing-nav-actions"><a className="landing-login-link" href={panelUrl}>Giriş yap <ArrowUpRight size={15} /></a><a className="landing-button landing-button-small" href="#fiyatlar">FiveISO’yu keşfet <ArrowRight size={15} /></a></div>
    </header>

    <main>
      <section className="landing-hero landing-width">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow"><span className="landing-status-dot" /> FIVEM SUNUCULARI İÇİN TASARLANDI</span>
          <h1>Modern sunucular<br />için <span>FiveM<br />kontrol merkezi.</span></h1>
          <p>Oyuncularını takip et, ekibini yönet, sunucunun kontrolünü elinde tut. Canlı veriler ve tarayıcı tabanlı yönetim araçları tek bir çalışma alanında.</p>
          <a href="#fiyatlar" className="landing-button">Paketleri incele <ArrowUpRight size={19} /></a>
          <div className="landing-hero-note"><ShieldCheck size={19} /><span>Sunucun, ekibin ve tüm işlemlerin.<br /><strong>Tek bir merkezden yönet.</strong></span></div>
        </div>
        <figure className="landing-hero-preview">
          <div className="landing-preview-glow" />
          <button className="landing-screen-button" onClick={() => lightbox.current?.showModal()} aria-label="FiveISO kontrol merkezi ekran görüntüsünü büyüt">
            <img src="/assets/panel-overview-hero.webp?v=brand" width="1920" height="1080" alt="FiveISO kontrol merkezi: oyuncu kapasitesi, sunucu durumu, kaynaklar ve oyuncu trafiği" fetchPriority="high" />
            <span className="landing-image-zoom"><Maximize2 size={15} /> Tam ekran</span>
          </button>
          <figcaption><span className="landing-status-dot" /> FiveISO kontrol merkezi <span>Gerçek arayüz · Örnek veriler</span></figcaption>
        </figure>
      </section>

      <section id="ozellikler" className="landing-section landing-width">
        <div className="landing-section-head"><span className="landing-eyebrow">TEMEL ÖZELLİKLER</span><h2>Sunucu yönetiminin<br /><span>her parçası, bir arada.</span></h2><p>Canlı veriler, moderasyon araçları ve framework adaptörleriyle ekibinin ihtiyaç duyduğu kontrol.</p></div>
        <div className="landing-frameworks"><span>FRAMEWORK ADAPTÖRLERİ</span><b><span className="framework-mark">E</span>ESX</b><b><span className="framework-mark">QB</span>QBCore</b><b><span className="framework-mark">Q</span>Qbox</b></div>
        <div className="landing-feature-grid">{features.map(({ icon: Icon, title, text }) => <article key={title}><div className="landing-feature-icon"><Icon size={24} /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section id="panel" className="landing-section landing-dashboard-section">
        <div className="landing-width">
          <div className="landing-section-head"><span className="landing-eyebrow">PANEL ÖNİZLEMESİ</span><h2>Ekibinin ihtiyaç duyduğu her şey.<br /><span>Doğrudan tarayıcıda.</span></h2></div>
          <div className="landing-dashboard-layout">
          <button className="landing-screen-button landing-wide-screen" onClick={() => lightbox.current?.showModal()} aria-label="Panel önizlemesini tam ekran aç"><img src={preview} width="1920" height="1374" alt="FiveISO sunucu panelinin tam ekran önizlemesi, örnek verilerle" loading="lazy" /><span className="landing-image-zoom"><Maximize2 size={15} /> Önizlemeyi büyüt</span></button>
          <div className="landing-dashboard-points">{[
            { icon: Users, title: 'Oyuncu bilgileri', text: 'Oyuncu ve karakter kayıtlarını incele, yetkili moderasyon işlemlerini aynı yerden yürüt.' },
            { icon: Activity, title: 'Canlı durum', text: 'Oyuncu trafiğini, çalışan kaynakları ve sunucu bağlantılarını tek bakışta takip et.' },
            { icon: MapPin, title: 'Harita kontrolü', text: 'Oyuncu konumlarını gör, sunucunun harita işaretlerini ve konum işlemlerini yönet.' },
          ].map(({ icon: Icon, title, text }) => <article key={title}><Icon size={21} /><h3>{title}</h3><p>{text}</p></article>)}</div>
          </div>
        </div>
      </section>

      <section id="fiyatlar" className="landing-section landing-width">
        <div className="landing-section-head"><span className="landing-eyebrow">FİYATLANDIRMA</span><h2>Sunucun için <span>uygun erişim.</span></h2><p>Paket fiyatları ve satın alma bilgileri henüz yayınlanmadı.</p></div>
        <div className="landing-pricing">{[{ title: 'Aylık', icon: Server, caption: 'Dönemlik erişim' }, { title: 'Ömür boyu', icon: Crown, caption: 'Uzun vadeli kullanım' }].map(({ title, icon: Icon, caption }) => <article key={title} className="landing-price-card"><div className="landing-package-art"><div className="landing-package-orbit" /><Icon size={58} strokeWidth={1.2} /><span>FIVEISO</span></div><div className="landing-price-body"><span className="landing-eyebrow">{caption}</span><h3>{title}</h3><p className="landing-price-pending">Fiyat bilgisi yakında</p><ul>{['Tarayıcı tabanlı yönetim paneli', 'Oyuncu ve kaynak araçları', 'Ekip yetkileri ve işlem kayıtları', 'FiveM kaynak bağlantısı'].map(item => <li key={item}><Check size={16} />{item}</li>)}</ul><button className="landing-button" disabled>Henüz satışa açık değil</button></div></article>)}</div>
      </section>

      <section className="landing-section landing-why"><div className="landing-width"><div className="landing-section-head"><span className="landing-eyebrow">NEDEN FIVEISO?</span><h2>FiveM sunucularının<br /><span>günlük işleyişine göre tasarlandı.</span></h2></div><div className="landing-benefits">{benefits.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={25} /><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

      <section id="sorular" className="landing-section landing-width landing-faq"><div className="landing-section-head"><span className="landing-eyebrow">SSS</span><h2>Aklındaki <span>sorular.</span></h2></div><div className="landing-faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</div></section>

      <section id="destek" className="landing-width landing-support"><div className="landing-support-icon"><MessageCircle size={32} /></div><h2>Kurulum için <span>yardım mı gerekiyor?</span></h2><p>Kaynağı sunucuna eklemek, bağlantıyı yapılandırmak ve ilk kontrolleri yapmak için kurulum rehberine göz at.</p><a className="landing-button" href="/kurulum.html"><BookOpen size={18} /> Kurulum rehberini aç <ArrowUpRight size={17} /></a><span className="landing-support-note">Hesabın hazır mı? <a href={panelUrl}>Kontrol merkezine giriş yap <ArrowRight size={14} /></a></span></section>
    </main>

    <footer className="landing-footer landing-width"><div><a href="/" className="landing-brand"><BrandLogo /></a><p>FiveM sunucuların için merkezi yönetim<br />ve ekip araçları.</p></div><nav aria-label="Alt menü"><a href="/kurulum.html">Dokümantasyon</a><a href="#fiyatlar">Paketler</a><a href={panelUrl}>Panele giriş <ArrowUpRight size={14} /></a></nav><span className="landing-copyright">© {new Date().getFullYear()} FiveISO. Tüm hakları saklıdır.</span></footer>
    <dialog ref={lightbox} className="landing-lightbox" onClick={event => { if (event.target === event.currentTarget) lightbox.current?.close(); }}><button className="landing-lightbox-close" onClick={() => lightbox.current?.close()} aria-label="Önizlemeyi kapat"><X size={22} /></button><img src={preview} width="1920" height="1374" alt="FiveISO kontrol merkezinin tam ekran görüntüsü; örnek veriler" /><p>FiveISO kontrol merkezi · Örnek veriler</p></dialog>
  </div>;
}
