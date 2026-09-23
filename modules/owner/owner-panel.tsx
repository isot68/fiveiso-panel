'use client';
import { ResourceInstallation } from '../panel/resource-installation';
import { BrandLogo } from '@/components/brand-logo';
import { useEffect, useState } from 'react';
import { useScrollMemory } from '../panel/use-scroll-memory';
import {
  Crown,
  Users,
  Server,
  ShieldCheck,
  Plus,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/toast-center';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePanel } from '../panel/use-panel';
type Tenant = {
  id: string;
  name: string;
  enabled: number;
  expires: string | null;
  features: string[];
};
type OwnerData = {
  features: Record<string, string>;
  tenants: Tenant[];
  users: { username: string; role: string; tenantId: string; email?: string; manager?: number }[];
  servers: { id: string; name: string; region: string; framework: string; tenantId: string }[];
};
const labels = {
  overview: 'Kontrol merkezi',
  players: 'Oyuncular',
  accounts: 'Karakterler',
  map: 'Canlı konumlar',
  vehicles: 'Araçlar',
  items: 'Envanter',
  jobs: 'Meslekler',
  factions: 'Çeteler',
  economy: 'Ekonomi',
  resources: 'Kaynaklar',
  console: 'Konsol',
  bans: 'Yasaklamalar',
  audit: 'Kayıtlar',
  team: 'Yetkililer',
  settings: 'Ayarlar',
};
export function OwnerPanel() {
  const panel = usePanel();
  useScrollMemory('fiveiso:scroll:owner', !panel.loading && panel.live && panel.user.role === 'owner');
  const [data, setData] = useState<OwnerData>({
    features: labels,
    tenants: [],
    users: [],
    servers: [],
  });
  const [, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState('');
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [features, setFeatures] = useState<string[]>(Object.keys(labels));
  const [enabled, setEnabled] = useState(true);
  const [tenantId, setTenantId] = useState('');
  const [secret, setSecret] = useState('');
  const [licenseServer, setLicenseServer] = useState('');
  const [section, setSection] = useState('overview');
  const [serverEdit, setServerEdit] = useState<OwnerData['servers'][number] | null>(null);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage('');
    try {
      await fn();
      notify('İşlem başarıyla tamamlandı.', 'success');
    } catch (e) {
      setMessage((e as Error).message);
      notify((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setData(await panel.request<OwnerData>('/owner'));
  }
  useEffect(() => {
    if (panel.live && panel.user.role === 'owner') void run(refresh);
  }, [panel.live, panel.user.role]);
  function edit(t: Tenant | null) {
    setEditing(t);
    setFeatures(t?.features || Object.keys(labels));
    setEnabled(t ? !!t.enabled : true);
    setModal('tenant');
  }
  async function remove(kind: 'tenant' | 'user' | 'server', id: string, name: string) {
    const detail = kind === 'tenant' ? 'Bu müşterinin kullanıcıları, sunucuları ve lisansları da silinecek.' : kind === 'server' ? 'Sunucunun lisansı ve bağlantısı da iptal edilecek.' : 'Kullanıcının oturumları da kapatılacak.';
    if (!window.confirm(`${name} silinsin mi? ${detail} Bu işlem geri alınamaz.`)) return;
    await run(async () => { await panel.request('/owner/delete', { kind, id }); await refresh(); });
  }
  if (panel.loading) return <main className="owner-auth-shell"><p>Yükleniyor…</p></main>;
  if (!panel.live) return <main className="owner-auth-shell"><section className="glass-panel owner-login">
            <Crown size={30} className="text-primary" />
            <h2>Ana panel girişi</h2>
            <p className="text-muted-foreground text-sm">
              Bu alan yalnızca sahip hesabına açıktır. Müşteri hesapları kendi
              sunucu panelini kullanır.
            </p>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(() =>
                  panel.login(
                    String(f.get('username')),
                    String(f.get('password')),
                  ),
                );
              }}
            >
              <label>
                Kullanıcı adı
                <Input
                  className="mt-2"
                  name="username"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Parola
                <Input
                  className="mt-2"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <Button type="submit" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Ana panele giriş yap'}</Button>
            </form>
            <p className="text-xs text-muted-foreground">
              İlk sahip hesabını kurulum rehberindeki owner rolüyle oluştur.
            </p>
          </section></main>;
  if (panel.user.role !== 'owner') return <main className="owner-auth-shell"><section className="glass-panel owner-login"><h2>Bu hesap ana panele erişemez.</h2><a href="/panel">Kendi sunucu paneline git →</a></section></main>;
  return (
    <main className="owner-shell">
      <aside className="owner-sidebar">
        <a href="/owner" className="brand"><BrandLogo /></a>

        <nav className="owner-nav" aria-label="Sahip paneli">
          <span>YÖNETİM</span>
          <a href="#owner-overview" data-active={section === 'overview'} onClick={() => setSection('overview')}><Crown size={17} /> Genel bakış</a>
          {panel.live && panel.user.role === 'owner' && <>
            <a href="#owner-tenants" data-active={section === 'tenants'} onClick={() => setSection('tenants')}><ShieldCheck size={17} /> Müşteriler</a>
            <a href="#owner-users" data-active={section === 'users'} onClick={() => setSection('users')}><Users size={17} /> Kullanıcılar</a>
            <a href="#owner-servers" data-active={section === 'servers'} onClick={() => setSection('servers')}><Server size={17} /> Sunucular</a>
          </>}
        </nav>
        <div className="owner-sidebar-account"><span>NX</span><div><strong>{panel.user.username || 'Sahip paneli'}</strong><small>Yönetim alanı</small></div></div>
      </aside>
      <div className="owner-main">
      <header className="owner-header">
        <div className="owner-breadcrumb">Çalışma alanı <span>›</span> Sahip paneli</div>
        <div className="flex items-center gap-4">
          {panel.live && (
            <><Button variant="outline" onClick={() => window.location.assign('/api/auth/discord/start?mode=link')}>Discord hesabını bağla</Button><Button variant="outline" onClick={() => run(panel.logout)}>
              <LogOut size={15} />
              Çıkış
            </Button></>
          )}
        </div>
      </header>
      <div className="owner-content" id="owner-overview">
        <nav className="owner-section-tabs" aria-label="Yönetim bölümleri">{Object.entries({overview:'Genel bakış',tenants:'Müşteriler',users:'Kullanıcılar',servers:'Sunucular'}).map(([id,label]) => <Button key={id} variant={section === id ? 'default' : 'outline'} onClick={() => setSection(id)}>{label}</Button>)}</nav>
        <div className="page-heading">
          <div>
            <div className="eyebrow">ANA YÖNETİM / SAHİP PANELİ</div>
            <h1>{{overview:'Kontrol sende.', tenants:'Müşteriler ve paketler', users:'Kullanıcı hesapları', servers:'Sunucu yönetimi'}[section]}</h1>
            <p className="text-muted-foreground mt-3">
              Müşteriler, erişim süreleri, sunucular ve modül paketleri.
            </p>
          </div>
          {panel.live && panel.user.role === 'owner' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setModal('user')}>
                <Users size={16} />
                Kullanıcı oluştur
              </Button>
              <Button onClick={() => edit(null)}>
                <Plus size={16} />
                Müşteri oluştur
              </Button>
            </div>
          )}
        </div>
          <>
            <div className="owner-stats" hidden={section !== 'overview'}>
              {[
                {
                  label: 'Müşteri çalışma alanı',
                  value: data.tenants.length,
                  icon: Users,
                },
                {
                  label: 'Tanımlı kullanıcı',
                  value: data.users.length,
                  icon: ShieldCheck,
                },
                {
                  label: 'Bağlı sunucu kaydı',
                  value: data.servers.length,
                  icon: Server,
                },
              ].map((s) => (
                <div className="glass-panel p-6" key={s.label}>
                  <s.icon className="text-primary" size={21} />
                  <strong className="block text-3xl mt-3">{s.value}</strong>
                  <span className="text-sm text-muted-foreground">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            <section className="glass-panel mt-6" id="owner-tenants" hidden={!['overview','tenants'].includes(section)}>
              <div className="section-heading">
                <h2>Müşteriler ve paketler</h2>
                <span className="text-sm text-muted-foreground">
                  Değişiklikler API yetkilerine anında uygulanır
                </span>
              </div>
              {data.tenants.map((t) => (
                <div key={t.id} className="activity-row">
                  <div className="avatar">
                    {t.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <strong>{t.name}</strong>
                    <small>
                      {t.features.length} modül ·{' '}
                      {t.expires
                        ? `Bitiş: ${t.expires.slice(0, 10)}`
                        : 'Süresiz'}{' '}
                      · {data.servers.filter((s) => s.tenantId === t.id).length}{' '}
                      sunucu
                    </small>
                  </div>
                  <span className="status-pill">
                    {!t.enabled
                      ? 'Durduruldu'
                      : t.expires && Date.parse(t.expires) < Date.now()
                        ? 'Süresi doldu'
                        : 'Aktif'}
                  </span>
                  <Button variant="outline" onClick={() => edit(t)}>
                    Düzenle
                  </Button>
                  <Button variant="destructive" disabled={busy} onClick={() => void remove('tenant', t.id, t.name)}>Sil</Button>
                </div>
              ))}
            </section>
            <div className="owner-columns mt-6" style={section !== 'overview' ? {gridTemplateColumns:'1fr'} : undefined}>
              <section className="glass-panel" id="owner-users" hidden={!['overview','users'].includes(section)}>
                <div className="section-heading">
                  <h2>Kullanıcı hesapları</h2>
                </div>
                {data.users.map((u) => (
                  <div className="activity-row" key={u.username}>
                    <Users size={17} />
                    <div className="flex-1">
                      {u.username}
                      <small>
                        {u.manager ? 'Müşteri yöneticisi' : 'Ekip üyesi'} ·{' '}
                        {data.tenants.find((t) => t.id === u.tenantId)?.name ||
                          'Ana panel sahibi'}
                      </small>
                    </div>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setTenantId(u.tenantId);
                          setModal('user:' + u.username);
                        }}
                      >
                        Düzenle
                      </Button>
                      <Button variant="destructive" disabled={busy} onClick={() => void remove('user', u.username, u.username)}>Sil</Button>
                  </div>
                ))}
              </section>
              <section className="glass-panel" id="owner-servers" hidden={!['overview','servers'].includes(section)}>
                <div className="section-heading">
                  <h2>Sunucu atamaları</h2>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSecret('');
                      setModal('server');
                    }}
                  >
                    Sunucu ekle
                  </Button>
                </div>
                {data.servers.map((s) => (
                  <div className="activity-row" key={s.id}>
                    <div className="flex-1">
                      {s.name}
                      <small>
                        {data.tenants.find((t) => t.id === s.tenantId)?.name}
                      </small>
                    </div>
                    <Button variant="outline" onClick={() => setServerEdit(s)}>Düzenle</Button>
                    <Button variant="destructive" disabled={busy} onClick={() => void remove('server', s.id, s.name)}>Sil</Button>
                    <Button variant="outline" onClick={() => setLicenseServer(s.id)}>Kurulum / lisans</Button>
                    <Select
                      value={s.tenantId}
                      onValueChange={(v) => {
                        if (v && v !== s.tenantId)
                          void run(async () => {
                            await panel.request('/owner/assign-server', {
                              serverId: s.id,
                              tenantId: v,
                            });
                            await refresh();
                          });
                      }}
                    >
                      <SelectTrigger aria-label={`${s.name} müşterisi`}>
                        <SelectValue>
                          {data.tenants.find((t) => t.id === s.tenantId)
                            ?.name || 'Müşteri seç'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {data.tenants.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </section>
            </div>
          </>
      </div>
      </div>
      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal('')}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogTitle>
            {modal === 'tenant'
              ? 'Müşteri paketi ve erişimi'
              : modal === 'server'
                ? 'Sunucu kaydı'
                : 'Kullanıcı hesabı'}
          </DialogTitle>
          <DialogDescription>
            Bu ayarları yalnızca ana panel sahibi değiştirebilir.
          </DialogDescription>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                if (modal === 'tenant') {
                  await panel.request('/owner/tenants', {
                    id: editing?.id,
                    name: f.get('name'),
                    enabled,
                    features,
                    expires: f.get('expires')
                      ? new Date(
                          String(f.get('expires')) + 'T23:59:59+03:00',
                        ).toISOString()
                      : null,
                  });
                } else if (modal === 'server') {
                  const s = await panel.addServer(
                    String(f.get('name')),
                    String(f.get('region')),
                    String(f.get('framework')),
                  );
                  await panel.request('/owner/assign-server', { serverId: s.id, tenantId: String(f.get('serverTenantId')) });
                  setSecret('');
                  setModal('');
                  setLicenseServer(s.id);
                  await refresh();
                  return;
                } else {
                  await panel.request('/owner/users', {
                    username: f.get('username'),
                    password: f.get('password'),
                    tenantId,
                  });
                }
                await refresh();
                setModal('');
              });
            }}
          >
            {modal === 'tenant' ? (
              <>
                <label>
                  Müşteri adı
                  <Input
                    name="name"
                    defaultValue={editing?.name || ''}
                    required
                    maxLength={80}
                  />
                </label>
                <label>
                  Paket bitiş tarihi (boş = süresiz)
                  <Input
                    name="expires"
                    type="date"
                    defaultValue={editing?.expires?.slice(0, 10) || ''}
                  />
                </label>
                <label className="flex justify-between items-center">
                  Panel erişimi açık
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </label>
                <div className="feature-grid">
                  {Object.entries(data.features).map(([key, label]) => (
                    <label className="flex gap-2 items-center" key={key}>
                      <Checkbox
                        checked={features.includes(key)}
                        disabled={key === 'overview'}
                        onCheckedChange={(v) =>
                          setFeatures((prev) =>
                            v ? [...prev, key] : prev.filter((k) => k !== key),
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </>
            ) : modal === 'server' ? (
              <>
                <label>Müşteri
                  <select name="serverTenantId" required defaultValue="" className="w-full rounded-md border bg-background p-2">
                    <option value="" disabled>Müşteri seç</option>
                    {data.tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                <Input
                  name="name"
                  aria-label="Sunucu adı"
                  placeholder="Sunucu adı"
                  required
                />
                <Input
                  name="region"
                  aria-label="Konum"
                  placeholder="İstanbul, TR"
                  required
                />
                <Input
                  name="framework"
                  aria-label="Framework"
                  placeholder="qbx_core / qb-core / esx"
                  required
                />
                {secret && (
                  <pre className="text-xs whitespace-pre-wrap break-all bg-background p-3">
                    {secret}
                  </pre>
                )}
              </>
            ) : (
              <>
                <label>
                  Kullanıcı adı
                  <Input
                    name="username"
                    defaultValue={modal.split(':')[1] || ''}
                    readOnly={modal.includes(':')}
                    pattern="[a-zA-Z0-9_.-]{3,40}"
                    required
                  />
                </label>
                <label>
                  {modal.includes(':')
                    ? 'Yeni parola (boş bırakılırsa korunur)'
                    : 'Parola'}
                  <Input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    required={!modal.includes(':')}
                  />
                </label>
                <label>
                  Müşteri
                  <Select
                    value={tenantId}
                    onValueChange={(v) => setTenantId(v || '')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {data.tenants.find((t) => t.id === tenantId)?.name ||
                          'Müşteri seç'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {data.tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <p className="text-sm text-muted-foreground">Bu hesap müşteri yöneticisi olur. Ekip yetkilerini kullanıcı kendi panelinden oluşturur.</p>
              </>
            )}
            <Button type="submit"
              disabled={
                busy ||
                (modal.startsWith('user') && !tenantId) ||
                (modal === 'server' && !!secret)
              }
            >
              {busy ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!licenseServer} onOpenChange={open => !open && setLicenseServer('')}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogTitle>FiveISO kurulumu ve lisansı</DialogTitle>
          <DialogDescription>Sunucuya özel paketi oluştur, indir veya taşımak için lisansı sil.</DialogDescription>
          {licenseServer && <ResourceInstallation key={licenseServer} serverId={licenseServer} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!serverEdit} onOpenChange={open => !open && setServerEdit(null)}>
        <DialogContent><DialogTitle>Sunucuyu düzenle</DialogTitle><DialogDescription>Sunucu adı, konumu ve framework bilgisini güncelle.</DialogDescription>
          {serverEdit && <form className="grid gap-4" onSubmit={e => {e.preventDefault();const f=new FormData(e.currentTarget);void run(async()=>{await panel.request('/owner/servers',{id:serverEdit.id,name:f.get('name'),region:f.get('region'),framework:f.get('framework')});setServerEdit(null);await refresh();});}}>
            <label>Sunucu adı<Input name="name" defaultValue={serverEdit.name} required maxLength={80}/></label>
            <label>Konum<Input name="region" defaultValue={serverEdit.region} required maxLength={80}/></label>
            <label>Framework<Input name="framework" defaultValue={serverEdit.framework} required maxLength={80}/></label>
            <Button type="submit" disabled={busy}>Kaydet</Button>
          </form>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
