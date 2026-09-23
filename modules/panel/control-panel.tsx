'use client';
import { BrandLogo } from '@/components/brand-logo';
import { SectionTheme } from '@/components/ui/section-theme';
import { ResourceWorkspace } from './resource-workspace';
import { PlayerWorkspace } from './player-workspace';
import { TeamManager } from './team-manager';
import { LocationMap } from './location-map';
import { DatabaseTools } from './database-tools';
import { CharacterAccounts } from './character-accounts';
import { LoginPage } from './login-page';
import { GameTools } from './game-tools';
import { LayoutToggle, type PanelLayout } from './layout-toggle';
import { useEffect, useState } from 'react';
import { rememberScroll, useScrollMemory } from './use-scroll-memory';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Boxes,
  BriefcaseBusiness,
  CarFront,
  ContactRound,
  MapPinned,
  Package,
  UsersRound,
  ChevronRight,
  CircleHelp,
  Globe2,
  LayoutDashboard,
  LogOut,
  Network,
  Plus,
  Radio,
  Search,
  Server as ServerIcon,
  Settings2,
  Shield,
  ShieldBan,
  Terminal,
  Users,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/toast-center';
import { Input } from '@/components/ui/input';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePanel } from './use-panel';
import { Dashboard } from './dashboard';
import type { Action } from '@/lib/panel-types';
const navigation = [
  { id: 'overview', label: 'Kontrol merkezi', icon: LayoutDashboard },
  { id: 'players', label: 'Oyuncular', icon: Users },
  { id: 'accounts', label: 'Karakter hesapları', icon: ContactRound },
  { id: 'map', label: 'Canlı konumlar', icon: MapPinned },
  { id: 'vehicles', label: 'Araçlar', icon: CarFront },
  { id: 'items', label: 'Eşyalar', icon: Package },
  { id: 'jobs', label: 'Meslekler', icon: BriefcaseBusiness },
  { id: 'factions', label: 'Çeteler / gruplar', icon: UsersRound },
  { id: 'resources', label: 'Kaynaklar', icon: Boxes },
  { id: 'console', label: 'Konsol', icon: Terminal },
  { id: 'bans', label: 'Yasaklamalar', icon: ShieldBan },
  { id: 'audit', label: 'İşlem kayıtları', icon: Activity },
  { id: 'team', label: 'Ekip ve yetkiler', icon: Shield },
  { id: 'settings', label: 'Bağlantı & kurulum', icon: Settings2 },
];
export function ControlPanel() {
  const panel = usePanel();
  const { data, live, user } = panel;
  const [page, setPageState] = useState(() => { const requested = new URLSearchParams(window.location.search).get('page') || sessionStorage.getItem('fiveiso:page'); return navigation.some(n => n.id === requested) ? requested! : 'overview'; });
  const [selected, setSelected] = useState(() => sessionStorage.getItem('fiveiso:selected-server') || '');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState('');
  const [, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<{
    id: string;
    token: string;
  } | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [layout, setLayout] = useState<PanelLayout>(() => sessionStorage.getItem('fiveiso:layout') === 'list' ? 'list' : 'grid');
  const server = data.servers.find((s) => s.id === selected) || data.servers[0];
  const visibleBans = data.bans.filter((ban) => ban.serverId === server?.id && (ban.license + ban.reason).toLowerCase().includes(query.toLowerCase()));
  const title = navigation.find((n) => n.id === page)?.label;
  const isOwner = user.role === 'owner';
  useScrollMemory(`fiveiso:scroll:${page}`, !panel.loading && live && !isOwner);
  useEffect(() => { sessionStorage.setItem('fiveiso:selected-server', selected); }, [selected]);
  useEffect(() => { sessionStorage.setItem('fiveiso:layout', layout); }, [layout]);
  useEffect(() => {
    sessionStorage.setItem('fiveiso:page', page);
    const url = new URL(window.location.href);
    url.searchParams.set('page', page);
    history.replaceState(null, '', url);
  }, [page]);
  useEffect(() => {
    const onPopState = () => {
      const requested = new URLSearchParams(window.location.search).get('page');
      setPageState(navigation.some((n) => n.id === requested) ? requested! : 'overview');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const allowed = (key: string) =>
    !live || (!isOwner && (!data.features || data.features.includes(key)));
  const canAction = (key: string) =>
    !isOwner && (!!data.manager || !!user.manager || data.permissions?.includes(key) === true || user.permissions?.includes(key) === true);
  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setFeedback('');
    try {
      await fn();
      setFeedback(message);
      notify(message, 'success');
      return true;
    } catch (e) {
      setFeedback((e as Error).message);
      notify((e as Error).message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }
  function ask(action: Action) {
    if (!canAction(action.type)) {
      setFeedback('Bu işlem için yetkiniz yok.');
      notify('Bu işlem için yetkiniz yok.', 'error');
      return;
    }
    setReason(
      action.value ||
        (['kick', 'ban'].includes(action.type)
          ? 'Panel üzerinden yönetim işlemi'
          : ''),
    );
    setPending(action);
  }
  function exportAudit() {
    const blob = new Blob([JSON.stringify(data.audit, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fiveiso-islem-kayitlari.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  const setPage = (id: string) => {
    const next = navigation.some((n) => n.id === id) && allowed(id) ? id : 'overview';
    if (next === page) return;
    rememberScroll(`fiveiso:scroll:${page}`);
    const url = new URL(window.location.href);
    url.searchParams.set('page', next);
    history.pushState(null, '', url);
    setPageState(next);
  };
  const logs = data.audit.filter((a) => !server || a.serverId === server.id);
  if (panel.loading) {
    return <main className="min-h-screen grid place-items-center" role="status">Oturum kontrol ediliyor…</main>;
  }
  if (live && isOwner) {
    window.location.replace('/owner');
    return <main className="min-h-screen grid place-items-center">Owner paneline yönlendiriliyor…</main>;
  }
  if (!live) {
    return <LoginPage busy={busy} onLogin={(username, password) => run(() => panel.login(username, password), 'Giriş yapıldı.')} />;
  }
  return (
    <SectionTheme.Provider value={page}><SidebarProvider
      className="fiveiso-workspace"
      data-page={page}
      style={
        {
          '--sidebar-width': '228px',
          '--section-color':
            (
              {
                players: '#b889f5',
                accounts: '#eea978',
                map: '#65d8aa',
                vehicles: '#5dd5c5',
                items: '#86d99b',
                jobs: '#a3d574',
                factions: '#cad775',
                audit: '#e7cc82',
                console: '#b7c1d1',
                resources: '#edabb5',
                team: '#ea869e',
                settings: '#a6b5ce',
              } as Record<string, string>
            )[page] || '#61dce6',
        } as React.CSSProperties
      }
    >
      <Sidebar>
        <SidebarHeader className="px-6 py-7">
          <div className="brand">
            <BrandLogo />
          </div>
          <p className="text-xs tracking-[.18em] text-muted-foreground mt-1">
            SERVER OPERATIONS
          </p>
        </SidebarHeader>
        <SidebarContent className="px-4">
          <div className="workspace-label">
            KONTROL MERKEZİ <span>01</span>
          </div>
          <SidebarMenu>
            {navigation
              .filter((n) => allowed(n.id))
              .map((n) => (
                <SidebarMenuItem key={n.id} className="">
                  {['overview', 'resources', 'team'].includes(n.id) && (
                    <div className="nav-section-label">
                      {n.id === 'overview'
                        ? 'SUNUCU'
                        : n.id === 'resources'
                          ? 'GELİŞTİRİCİ'
                          : 'YÖNETİM'}
                    </div>
                  )}
                  <SidebarMenuButton
                    isActive={page === n.id}
                    onClick={() => {
                      setPage(n.id);
                      setQuery('');
                    }}
                    className="h-9 my-0.5 px-3 gap-3"
                  >
                    <span className="nav-icon"><n.icon size={19} strokeWidth={1.8} /></span>
                    <span>{n.label}</span>
                    {n.id === 'servers' && (
                      <span className="ml-auto text-xs">
                        {data.servers.length}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
          {isOwner && <a href="/owner" className="text-sm text-primary p-4">Ana sahip paneli ↗</a>}
        </SidebarContent>
        <SidebarFooter className="border-t p-5">
          <div className="flex items-center gap-3">
            <div className="avatar">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground">
                {live ? 'Bağlı oturum' : 'Demo çalışma alanı'}
              </p>
            </div>
            <button
              aria-label={live ? 'Çıkış yap' : 'Giriş yap'}
              onClick={() =>
                live
                  ? run(panel.logout, 'Çıkış yapıldı.')
                  : setModal('login')
              }
              className="ml-auto text-muted-foreground"
            >
              <LogOut size={18} />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <main className="min-w-0 flex-1">
        <header className="topbar">
          <div className="flex items-center gap-3 text-sm">
            <SidebarTrigger />
            <span className="text-muted-foreground hidden sm:inline">
              Çalışma alanı
            </span>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span>{title}</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              aria-label="Kurulum yardımı"
              onClick={() => setPage('settings')}
            >
              <CircleHelp size={19} className="text-muted-foreground" />
            </button>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
            </div>
          </div>
          {!live && (
            <div className="demo-note">
              <Radio size={16} />
              <span>
                Demo çalışma alanı · Örnek veriler gösteriliyor. İşlemler gerçek
                sunucuları etkilemez.
              </span>
              <button onClick={() => setModal('login')}>
                Merkeze giriş <ArrowUpRight size={14} />
              </button>
            </div>
          )}
          {page === 'resources' && allowed('resources') && (
            <ResourceWorkspace
              key={server?.id || 'empty'}
              server={server}
              canAction={canAction}
              onAction={ask}
            />
          )}
          {page === 'players' && allowed('players') && (
            <PlayerWorkspace
              key={(server?.id || 'empty') + live + user.role}
              server={server}
              live={live}
              canAction={canAction}
              allowed={allowed}
              onModerate={ask}
              onNavigate={setPage}
              request={panel.request}
              onAction={async (a) => {
                if (server) return panel.action(server.id, a);
              }}
            />
          )}
          {page === 'map' && allowed('map') && (
            <LocationMap
              key={server?.id || 'empty'}
              locations={server?.locations || []}
              server={server}
              serverId={server?.id}
              canWatch={live && allowed('map')}
              live={live}
              canAction={canAction}
              allowed={allowed}
              onModerate={ask}
              request={panel.request}
              onAction={async (action) => {
                if (server) return panel.action(server.id, action);
              }}
            />
          )}
          {[
            'items',
            'jobs',
            'factions',
          ].includes(page) &&
            allowed(page) && (
              <GameTools
                key={server?.id + ':' + page}
                module={page}
                server={server}
                live={live}
                canAction={canAction}
                onAction={async (a) => {
                  if (server) return panel.action(server.id, a);
                }}
              />
            )}
          {server && page === 'accounts' && allowed('accounts') && (
            <CharacterAccounts
              key={server.id + page + live + (data.permissions || []).join(',')}
              server={server}
              live={live}
              canAction={canAction}
              request={panel.request}
            />
          )}
          {server &&
            page === 'vehicles' &&
            allowed(page) && (
              <DatabaseTools
                key={server.id + page + live + (data.permissions || []).join(',')}
                module={page}
                server={server}
                live={live}
                canAction={canAction}
                request={panel.request}
              />
            )}
          {page === 'overview' && (
            <Dashboard
              data={data}
              server={server}
              live={live}
              mayAct={canAction('announce')}
              onSelect={setSelected}
              onNavigate={setPage}
              onAnnounce={() => setModal('announce')}
              onExport={exportAudit}
              canAction={canAction}
              onServerAction={(type) => ask({ type })}
            />
          )}
          {['bans'].includes(page) && (
            <section className="surface">
              <div className="section-heading">
                <h2>
                  {title}{' '}
                  <span className="text-muted-foreground font-normal">
                    / {server?.name}
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <div className="search-box">
                    <Search size={16} />
                    <Input
                      aria-label="Listede ara"
                      placeholder="Lisans veya sebep ara..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <LayoutToggle value={layout} onChange={setLayout} />
                </div>
              </div>
              {layout === 'list' ? <div className="layout-collection layout-list"><Table>
                <TableHeader>
                  <TableRow>
                    {(page === 'players'
                      ? ['Oyuncu', 'Sunucu ID', 'Ping', 'İşlemler']
                      : page === 'resources'
                        ? ['Kaynak', 'Sürüm', 'Durum', 'İşlemler']
                        : ['Lisans', 'Sebep', 'Tarih', 'İşlemler']
                    ).map((t) => (
                      <TableHead key={t}>{t}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page === 'resources' &&
                    server?.resources
                      .filter((r) =>
                        r.name.toLowerCase().includes(query.toLowerCase()),
                      )
                      .map((r) => (
                        <TableRow key={r.name}>
                          <TableCell className="font-mono">{r.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {r.version || '—'}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`status-pill ${r.state === 'started' ? 'online' : 'offline'}`}
                            >
                              {r.state === 'started' ? 'Çalışıyor' : r.state}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                  !canAction(r.state === 'started' ? 'restart' : 'start') ||
                                  !server.online ||
                                  r.name === 'fiveiso'
                                }
                                onClick={() =>
                                  ask({
                                    type:
                                      r.state === 'started'
                                        ? 'restart'
                                        : 'start',
                                    target: r.name,
                                  })
                                }
                              >
                                {r.state === 'started'
                                  ? 'Yeniden başlat'
                                  : 'Başlat'}
                              </Button>
                              {r.state === 'started' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={
                                    !canAction('stop') ||
                                    !server.online ||
                                    r.name === 'fiveiso'
                                  }
                                  onClick={() =>
                                    ask({ type: 'stop', target: r.name })
                                  }
                                >
                                  Durdur
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  {page === 'bans' &&
                    visibleBans
                      .map((b) => (
                        <TableRow key={b.id}>
                          <TableCell>{b.license}</TableCell>
                          <TableCell>{b.reason}</TableCell>
                          <TableCell>{b.created.slice(0, 10)}</TableCell>
                          <TableCell>
                            {canAction('unban') && <Button
                              variant="outline"
                              onClick={() =>
                                ask({ type: 'unban', target: b.id })
                              }
                            >
                              Yasağı kaldır
                            </Button>}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table></div> : <div className="record-grid ban-card-grid layout-collection layout-grid">
                {visibleBans.map((ban) => <article className="record-card" key={ban.id}>
                  <header><span className="record-symbol"><ShieldBan size={22}/></span><div><h3>{ban.reason}</h3><p>{ban.license}</p></div></header>
                  <dl><div><dt>Tarih</dt><dd>{ban.created.slice(0, 10)}</dd></div></dl>
                  {canAction('unban') && <Button variant="ghost" className="inspect-button" onClick={() => ask({ type: 'unban', target: ban.id })}>Yasağı kaldır</Button>}
                </article>)}
              </div>}
              {((page === 'players' && !server?.players.length) ||
                (page === 'resources' && !server?.resources.length) ||
                (page === 'bans' &&
                  !data.bans.some((b) => b.serverId === server?.id))) && (
                <div className="empty">Henüz kayıt yok.</div>
              )}
            </section>
          )}
          {page === 'console' && (
            <section className="surface">
              <div className="section-heading">
                <h2 className="flex items-center gap-2">
                  <Terminal size={19} /> İşlem konsolu
                </h2>
                <span className="mode-badge">{server?.name}</span>
              </div>
              <div className="console">
                {logs.map((a) => (
                  <p key={a.id}>
                    <span className="text-muted-foreground">
                      [{a.time.slice(11, 19)}]
                    </span>{' '}
                    <span className="text-primary">[{a.status}]</span>{' '}
                    {a.action}
                  </p>
                ))}
                {!logs.length && <p>Henüz işlem kaydı yok.</p>}
              </div>
              {canAction('consoleCommand') && <form
                className="flex gap-3 p-5 border-t"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.currentTarget;
                  const value = String(
                    new FormData(f).get('command') || '',
                  ).trim();
                  if (!server || !value) return;
                  if (await run(
                    () => panel.action(server.id, { type: 'consoleCommand', value }),
                    'Komut sunucuya gönderildi. Sonucu konsol kaydında görünecek.',
                  )) f.reset();
                }}
              >
                <span className="text-primary self-center">❯</span>
                <Input
                  name="command"
                  aria-label="Konsol komutu"
                  placeholder="Örn. ensure qb-core veya script-komutu argüman"
                  required
                  maxLength={500}
                  autoComplete="off"
                />
                <Button type="submit" disabled={busy || !server?.online}>
                  {busy ? 'Gönderiliyor…' : 'Çalıştır'}
                </Button>
              </form>}
            </section>
          )}
          {page === 'audit' && (
            <section className="surface">
              <div className="section-heading">
                <h2>Denetim kaydı</h2>
                <Button variant="outline" onClick={exportAudit}>
                  <ArrowDownToLine size={15} /> Dışa aktar
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Zaman', 'Yetkili', 'Sunucu', 'İşlem', 'Sonuç'].map(
                      (t) => (
                        <TableHead key={t}>{t}</TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.audit.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        {a.time.replace('T', ' ').slice(0, 19)}
                      </TableCell>
                      <TableCell>{a.actor}</TableCell>
                      <TableCell>
                        {data.servers.find((s) => s.id === a.serverId)?.name ||
                          a.serverId}
                      </TableCell>
                      <TableCell>{a.action}</TableCell>
                      <TableCell>{a.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          )}
          {page === 'team' && (
            <section className="surface">
              <div className="section-heading">
                <div>
                  <h2>Ekip ve yetkiler</h2>
                  <p>
                    Ekip hesapları yalnızca bu müşterinin sunucularına erişir.
                  </p>
                </div>
                <Shield className="text-primary" />
              </div>
              {canAction('teamManage') && allowed('team') && (
                <TeamManager request={panel.request} onSaved={panel.refresh} options={data.permissionOptions || {}} users={data.users} roles={data.roles || []} manager={!!data.manager} currentUser={user.username} />
              )}
              <div className="record-grid team-directory">
                {data.users.map((u) => (
                  <div className="record-card team-member" key={u.username}>
                    <div className="avatar">
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      {u.username}
                      <small>{u.manager ? 'Panel sahibi' : u.roleName ? `${u.roleName} · ${u.permissions.length} yetki` : `${u.permissions.length} özel yetki`}</small>
                    </div>
                    <span className="count-badge">{u.manager ? 'sahip' : u.roleName || 'ekip'}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {page === 'settings' && (
            <div className="grid lg:grid-cols-2 gap-6">
              <section className="surface p-6">
                <h2>Discord hesabı</h2>
                <p className="text-muted-foreground mt-3 mb-5 leading-relaxed">Discord hesabını bağladıktan sonra giriş ekranından Discord ile oturum açabilirsin.</p>
                <Button variant="outline" onClick={() => window.location.assign('/api/auth/discord/start?mode=link')}>Discord hesabını bağla</Button>
              </section>
              <section className="surface p-6">
                <Shield className="text-primary mb-5" size={30} />
                <h2>Oyuncu girişleri</h2>
                <p className="text-muted-foreground mt-3 mb-5 leading-relaxed">
                  Girişleri kapatmak yeni bağlantıları engeller; sunucudaki oyuncuları atmaz.
                </p>
                <div className="flex items-center justify-between gap-4">
                  <strong>{server?.joinLocked ? 'Girişler kapalı' : 'Girişler açık'}</strong>
                  {canAction('setJoinLock') && <Button
                    variant={server?.joinLocked ? 'default' : 'destructive'}
                    disabled={busy || !server?.online || !server?.capabilities?.includes('setJoinLock')}
                    onClick={() => {
                      if (!server) return;
                      void run(
                        () => panel.action(server.id, { type: 'setJoinLock', params: { enabled: !server.joinLocked } }),
                        server.joinLocked ? 'Oyuncu girişleri açılıyor.' : 'Oyuncu girişleri kapatılıyor.',
                      );
                    }}
                  >
                    {server?.joinLocked ? 'Girişleri aç' : 'Girişleri kapat'}
                  </Button>}
                </div>
                {!server?.capabilities?.includes('setJoinLock') && (
                  <p className="text-sm text-amber-200 mt-4">Bu ayar için güncel fiveiso sürümünü sunucuya kurun.</p>
                )}
              </section>
              <section className="surface p-6">
                <Network className="text-primary mb-5" size={30} />
                <h2>Ana makine üzerinden kontrol</h2>
                <p className="text-muted-foreground mt-3 leading-relaxed">
                  Merkez servisi kendi bilgisayarında çalışır. FiveM ajanı her
                  sunucudan merkeze bağlantı kurar; sunucuların aynı makinede
                  olması gerekmez.
                </p>
                <ol className="setup-list">
                  <li>
                    Projedeki KURULUM.md dosyasını takip ederek merkez servisini
                    başlat.
                  </li>
                  <li>Yönetici hesabınla yerel panele giriş yap.</li>
                  <li>Sunucu ekle ve o sunucu için üretilen anahtarı al.</li>
                  <li>
                    fiveiso kaynağını FiveM sunucusuna kopyala; merkez
                    adresini, sunucu kimliğini ve anahtarı tanımla.
                  </li>
                  <li>
                    Ajan başladığında oyuncular ve kaynaklar otomatik görünür.
                  </li>
                </ol>
                <Button onClick={() => setModal('login')}>
                  Merkeze giriş yap <ArrowUpRight size={16} />
                </Button>
              </section>
              <section className="surface p-6">
                <h2>Bağlantı bilgileri</h2>
                <dl className="settings-list">
                  <dt>Çalışma modu</dt>
                  <dd>{live ? 'Canlı' : 'Demo'}</dd>
                  <dt>Veri yenileme</dt>
                  <dd>Komutlar 250 ms · Oyun verileri 5 saniye</dd>
                  <dt>Bağlantı yönü</dt>
                  <dd>Sunucu → ana makine</dd>
                  <dt>Kimlik doğrulama</dt>
                  <dd>Oturum + sunucu anahtarı</dd>
                  <dt>Veri saklama</dt>
                  <dd>Ana makinede SQLite</dd>
                </dl>
                <p className="text-muted-foreground text-sm leading-relaxed mt-6">
                  İnternetten kullanımda merkezin HTTPS adresini veya özel VPN
                  ağını kullan. Sunucu anahtarını oyuncularla paylaşma. Bu
                  yayımlanan demo, yerel ağındaki merkeze doğrudan bağlanmaz.
                </p>
              </section>
            </div>
          )}
        </div>
      </main>
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open) {
            setModal('');
            setCredentials(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg p-6">
          <DialogHeader>
            <DialogTitle>
              {modal === 'server'
                ? 'Yeni sunucu bağla'
                : modal === 'login'
                  ? 'Merkeze giriş yap'
                  : 'Sunucu duyurusu'}
            </DialogTitle>
            <DialogDescription>
              {modal === 'login'
                ? 'Kendi makinenizde çalışan panel adresinde kullanın.'
                : modal === 'server'
                  ? 'Her sunucu için ayrı bir bağlantı anahtarı oluşturulur.'
                  : 'Mesaj seçili sunucudaki tüm oyunculara iletilir.'}
            </DialogDescription>
          </DialogHeader>
          {credentials ? (
            <div>
              <p className="text-sm text-primary mb-3">
                {live
                  ? 'Anahtar yalnızca şimdi gösterilir. Güvenli bir yere kaydet.'
                  : 'Demo anahtarıdır; gerçek bağlantı kurulmaz.'}
              </p>
              <pre className="break-all whitespace-pre-wrap bg-background p-4 rounded-lg text-xs">{`set fiveiso_server_id "${credentials.id}"\nset fiveiso_token "${credentials.token}"\nset fiveiso_url "https://panel.fiveiso.com"\nadd_ace resource.fiveiso command allow\nensure fiveiso`}</pre>
            </div>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (modal === 'login') {
                  if (
                    await run(
                      () =>
                        panel.login(
                          String(f.get('username')),
                          String(f.get('password')),
                        ),
                      'Merkeze bağlanıldı.',
                    )
                  )
                    setModal('');
                } else if (modal === 'server') {
                  await run(
                    async () =>
                      setCredentials(
                        await panel.addServer(
                          String(f.get('name')),
                          String(f.get('region')),
                          String(f.get('framework')),
                        ),
                      ),
                    'Sunucu kaydı oluşturuldu.',
                  );
                } else if (server) {
                  setModal('');
                  ask({ type: 'announce', value: String(f.get('message')) });
                }
              }}
            >
              {modal === 'login' ? (
                <>
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
                </>
              ) : modal === 'server' ? (
                <>
                  <label>
                    Sunucu adı
                    <Input
                      className="mt-2"
                      name="name"
                      placeholder="Los Santos Roleplay"
                      maxLength={80}
                      required
                    />
                  </label>
                  <label>
                    Konum
                    <Input
                      className="mt-2"
                      name="region"
                      placeholder="İstanbul, TR"
                      maxLength={80}
                      required
                    />
                  </label>
                  <label>
                    Framework
                    <Input
                      className="mt-2"
                      name="framework"
                      placeholder="QBCore / ESX / Standalone"
                      maxLength={40}
                      required
                    />
                  </label>
                </>
              ) : (
                <label>
                  Duyuru mesajı
                  <Input
                    name="message"
                    className="mt-2"
                    maxLength={300}
                    required
                  />
                </label>
              )}
              <Button
                type="submit"
                disabled={
                  busy || (modal === 'announce' && (!canAction('announce') || !server?.online))
                }
              >
                {busy
                  ? 'İşleniyor…'
                  : modal === 'login'
                    ? 'Giriş yap'
                    : modal === 'server'
                      ? 'Sunucu oluştur'
                      : 'Devam et'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>İşlemi onayla</AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.type === 'kick'
              ? 'Oyuncuyu uzaklaştırmak istediğine emin misin?'
              : pending?.type === 'ban'
                ? 'Oyuncuyu yasaklamak istediğine emin misin?'
                : pending?.type === 'unban'
                  ? 'Oyuncunun yasağını kaldırmak istediğine emin misin?'
              : pending?.type === 'serverStart'
                ? 'Sunucuyu başlatmak istediğine emin misin?'
                : pending?.type === 'serverStop'
                  ? 'Sunucuyu durdurmak istediğine emin misin?'
                  : pending?.type === 'serverRestart'
                    ? 'Sunucuyu yeniden başlatmak istediğine emin misin?'
              : pending?.type === 'start'
                    ? 'Kaynağı başlatmak istediğine emin misin?'
                    : pending?.type === 'stop'
                      ? 'Kaynağı durdurmak istediğine emin misin?'
                      : pending?.type === 'restart'
                        ? 'Kaynağı yeniden başlatmak istediğine emin misin?'
                        : pending?.type === 'announce'
                          ? 'Duyuruyu göndermek istediğine emin misin?'
                          : 'Bu işlemi uygulamak istediğine emin misin?'}
          </AlertDialogDescription>
          {pending?.type === 'announce' && (
            <label>
              Mesaj
              <Input
                className="mt-2"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
              />
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Hayır</AlertDialogCancel>
            <Button
              disabled={
                busy ||
                (pending?.type === 'announce' &&
                  !reason.trim())
              }
              onClick={async () => {
                if (
                  server &&
                  pending &&
                  (await run(
                    () =>
                      panel.action(server.id, { ...pending, value: reason }),
                    live
                      ? 'İşlem kuyruğa alındı. Sonucunu kayıtlardan takip edebilirsin.'
                      : 'Demo işlemi uygulandı.',
                  ))
                )
                  setPending(null);
              }}
            >
              Evet
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider></SectionTheme.Provider>
  );
}
