'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Users,
  Fingerprint,
  BriefcaseBusiness,
  Wifi,
  Wallet,
  MapPin,
  Gamepad2,
  CarFront,
  MessageCircle,
  Shield,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { GameTools } from './game-tools';
import { PlayerInventory } from './player-inventory';
import { OwnedVehicles } from './owned-vehicles';
import { ProfileDetails, ProfileMoney } from './profile-details';
import { LayoutToggle, type PanelLayout } from './layout-toggle';
import type { Action, Server, Player } from '@/lib/panel-types';
const value = (v: unknown) =>
  typeof v === 'string' ? (v || '—') : typeof v === 'number' ? v.toLocaleString('tr-TR') : '—';
export function PlayerWorkspace({
  server,
  live,
  canAction,
  allowed,
  onAction,
  onModerate,
  onNavigate,
  request,
}: {
  server?: Server;
  live: boolean;
  canAction: (action: string) => boolean;
  allowed: (m: string) => boolean;
  onAction: (a: Action) => Promise<unknown>;
  onModerate: (a: Action) => void;
  onNavigate: (m: string) => void;
  request: <T = unknown>(path: string, body?: unknown) => Promise<T>;
}) {
  const [query, setQuery] = useState('');
  const [job, setJob] = useState('all');
  const [sort, setSort] = useState('id');
  const [visible, setVisible] = useState(12);
  const loadMore = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<PanelLayout>('grid');
  const [focus, setFocus] = useState<Player | null>(null);
  const [ownedVehicles, setOwnedVehicles] = useState<Record<string, unknown>[]>([]);
  const [vehiclesBusy, setVehiclesBusy] = useState(false);
  const [profileExtra, setProfileExtra] = useState<Record<string, unknown>>({});
  const [profileRevision, setProfileRevision] = useState(0);
  const account = (id: string) =>
    server?.accounts?.find((r) => String(r.id) === id);
  const players = server?.players || [];
  const jobs = [
    ...new Set(
      players.map((p) => (typeof account(p.id)?.job === 'string' ? account(p.id)!.job as string : '')).filter(Boolean),
    ),
  ];
  const filtered = players
    .filter(
      (p) =>
        (
          p.name +
          ' ' +
          p.id +
          ' ' +
          value(account(p.id)?.name) +
          ' ' +
          value(account(p.id)?.identifier)
        )
          .toLocaleLowerCase('tr')
          .includes(query.toLocaleLowerCase('tr')) &&
        (job === 'all' || account(p.id)?.job === job),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'tr')
        : sort === 'ping'
          ? b.ping - a.ping
          : Number(a.id) - Number(b.id),
    );
  const filterKey = `${query}\u0000${job}\u0000${sort}`;
  useEffect(() => setVisible(12), [filterKey]);
  useEffect(() => {
    const target = loadMore.current;
    if (!target || visible >= filtered.length) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible((count) => Math.min(count + 12, filtered.length));
    }, { rootMargin: '300px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [visible, filtered.length, filterKey]);
  const selected =
    focus &&
    players.find((p) => p.id === focus.id && p.license === focus.license);
  const details = selected ? account(selected.id) : undefined;
  const money = server?.economy?.find((r) => String(r.id) === selected?.id);
  const location = server?.locations?.find(
    (r) => String(r.id) === selected?.id,
  );
  const inventory =
    server?.items?.filter((r) => String(r.id) === selected?.id) || [];
  const steamHex = selected?.steamHex || (typeof details?.steamHex === 'string' ? details.steamHex : '');
  const discord = selected?.discord || (typeof details?.discord === 'string' ? details.discord : '');
  const vehicleAccess = !!selected && allowed('vehicles') && canAction('dbVehicles') && server?.capabilities?.includes('dbVehicles');
  useEffect(() => {
    let cancelled = false;
    setOwnedVehicles([]);
    const identifier = typeof details?.identifier === 'string' ? details.identifier : '';
    if (!vehicleAccess || !server || !identifier) { setVehiclesBusy(false); return; }
    setVehiclesBusy(true);
    void (async () => {
      try {
        const queued = await request<{ id: string }>(`/servers/${encodeURIComponent(server.id)}/actions`, {
          type: 'dbVehicles', params: { query: identifier, page: 0 },
        });
        for (let attempt = 0; attempt < 240; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          const result = await request<{ status: string; result?: string; data?: { rows?: Record<string, unknown>[] } }>(`/commands/${encodeURIComponent(queued.id)}`);
          if (result.status === 'completed') {
            const rows = Array.isArray(result.data?.rows) ? result.data.rows : [];
            if (!cancelled) setOwnedVehicles(rows.filter((row) => String(row.owner) === identifier));
            return;
          }
          if (['failed', 'expired', 'cancelled'].includes(result.status)) throw Error(result.result || 'Araçlar alınamadı.');
        }
        throw Error('Araç sorgusu zaman aşımına uğradı.');
      } catch {
        if (!cancelled) setOwnedVehicles([]);
      } finally {
        if (!cancelled) setVehiclesBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected?.id, details?.identifier, vehicleAccess, server?.id]);
  useEffect(() => {
    let cancelled = false;
    setProfileExtra({});
    const identifier = String(details?.identifier || '');
    if (!selected || !server || !identifier || !canAction('dbCharacterDetail') || !server.capabilities?.includes('dbCharacterDetail')) return;
    void (async () => {
      try {
        const queued = await request<{id:string}>(`/servers/${encodeURIComponent(server.id)}/actions`, {type:'dbCharacterDetail',target:identifier,params:{}});
        for (let i=0;i<240&&!cancelled;i++) {
          await new Promise(resolve=>setTimeout(resolve,250));
          if (cancelled) return;
          const result=await request<{status:string;data?:Record<string,unknown>}>(`/commands/${encodeURIComponent(queued.id)}`);
          if (result.status==='completed') { if (!cancelled) setProfileExtra(result.data || {}); return; }
          if (['failed','expired','cancelled'].includes(result.status)) return;
        }
      } catch { /* Live snapshot fields remain available if the detail request fails. */ }
    })();
    return () => { cancelled = true; };
  }, [selected?.id, details?.identifier, server?.id, profileRevision]);
  const metric = (label: string, v: unknown) => (
    <div className="profile-field">
      <span>{label}</span>
      <strong>{value(v)}</strong>
    </div>
  );
  if (focus)
    return (
      <section className="player-workspace profile-detail">
        <Button variant="ghost" onClick={() => setFocus(null)} className="mb-5">
          <ArrowLeft size={16} /> Oyunculara dön
        </Button>
        {!selected ? (
          <div className="empty">
            Oyuncu oturumu sona erdi. Yeni oturumu listeden seçin.
          </div>
        ) : (
          <>
            <div className="profile-layout">
              <div className="profile-information">
            <div className="profile-heading">
              <span className="character-avatar large">
                {selected.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <h2>{value(details?.name || selected.name)}</h2>
                <p>
                  {selected.name}{' '}
                  <span className="presence">
                    ● {server?.online ? 'Çevrimiçi' : 'Son alınan kayıt'}
                  </span>
                </p>
              </div>
              <span className="id-tag">ID {selected.id}</span>
            </div>

                <Tabs defaultValue="general">
                  <TabsList variant="line">
                    <TabsTrigger value="general" title="Genel bilgiler"><Fingerprint size={18} /> Genel bilgiler</TabsTrigger>
                    {allowed('items') && (
                      <TabsTrigger value="inventory" title="Envanter"><Wallet size={18} />
                        Envanter · {inventory.length}
                      </TabsTrigger>
                    )}
                    {vehicleAccess && (
                      <TabsTrigger value="vehicles" title="Araçlar"><CarFront size={18} />
                        Araçlar · {ownedVehicles.length}
                      </TabsTrigger>
                    )}
                    {allowed('map') && (
                      <TabsTrigger value="location" title="Konum"><MapPin size={18} /> Konum</TabsTrigger>
                    )}
                  {allowed('economy') && (<TabsTrigger value="money" title="Para"><Wallet size={18}/> Para</TabsTrigger>)}
                  </TabsList>
                  <TabsContent value="general"><ProfileDetails key={String(details?.identifier || selected.id)} data={{...profileExtra, ...details, playerName:selected.name, license:selected.license,steamHex,discord}} server={server!} onlineId={selected.id} onUpdated={()=>setProfileRevision(v=>v+1)} canAction={canAction} request={request}/></TabsContent>
                  {allowed('economy') && (<TabsContent value="money"><ProfileMoney cash={money?.cash} bank={money?.bank}/></TabsContent>)}
                  {allowed('items') && (
                    <TabsContent value="inventory">
                      <PlayerInventory items={inventory} serverId={server?.id || ''} />
                    </TabsContent>
                  )}
                  {vehicleAccess && (
                    <TabsContent value="vehicles">
                      <OwnedVehicles vehicles={ownedVehicles} loading={vehiclesBusy} />
                    </TabsContent>
                  )}
                  {allowed('map') && (
                    <TabsContent value="location">
                      <article className="profile-card green">
                        <h3>
                          <MapPin size={18} /> Son bildirilen konum
                        </h3>
                        {['x', 'y', 'z', 'bucket'].map((c) => (
                          <div key={c}>
                            {metric(c.toUpperCase(), location?.[c])}
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          onClick={() => onNavigate('map')}
                        >
                          Canlı konumları aç <ArrowUpRight size={15} />
                        </Button>
                      </article>
                    </TabsContent>
                  )}
                </Tabs>
              </div>
              <aside className="player-actions">
                <h3>Oyuncu işlemleri</h3>
                <GameTools
                  module="all"
                  compact
                  focusTarget={selected.id}
                  server={server}
                  live={live}
                  canAction={canAction}
                  allowed={allowed}
                  onAction={onAction}
                />
                {(canAction('kick') || canAction('ban')) && <><h4 className="action-group-label">Moderasyon</h4>
                <div className="action-tiles">
                  {canAction('kick') && <Button
                    className="action-tile orange"
                    disabled={!server?.online}
                    onClick={() =>
                      onModerate({ type: 'kick', target: selected.id })
                    }
                  >
                    <ArrowUpRight />
                    Uzaklaştır
                  </Button>}
                  {canAction('ban') && allowed('bans') && <Button
                    className="action-tile red"
                    disabled={!server?.online}
                    onClick={() =>
                      onModerate({ type: 'ban', target: selected.id })
                    }
                  >
                    <Shield />
                    Yasakla
                  </Button>}
                </div></>}
              </aside>
            </div>
          </>
        )}
      </section>
    );
  return (
    <section className="player-workspace">
      <div className="directory-toolbar">
        <div className="search-box">
          <Search size={17} />
          <Input
            aria-label="Oyuncularda ara"
            placeholder="Oyuncu, karakter veya ID ara…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(12);
            }}
          />
        </div>
        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v || 'id');
            setVisible(12);
          }}
        >
          <SelectTrigger aria-label="Oyuncu sıralaması">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id">Sunucu ID</SelectItem>
            <SelectItem value="name">İsim A–Z</SelectItem>
            <SelectItem value="ping">En yüksek ping</SelectItem>
          </SelectContent>
        </Select>
        <LayoutToggle value={layout} onChange={setLayout} />
      </div>
      <div className="directory-filterbar">
        <div className="filter-chips">
          <Button
            variant="ghost"
            aria-pressed={job === 'all'}
            onClick={() => {
              setJob('all');
              setVisible(12);
            }}
          >
            Tümü <span>{players.length}</span>
          </Button>
          {jobs.map((j) => (
            <Button
              key={j}
              variant="ghost"
              aria-pressed={job === j}
              onClick={() => {
                setJob(j);
                setVisible(12);
              }}
            >
              {j}
            </Button>
          ))}
        </div>
        <span>{filtered.length} oyuncu</span>
      </div>
      <div className="directory-layout">
        <div>
          <div
          className={`character-grid layout-collection layout-${layout} ${layout === 'list' ? 'as-list' : ''}`}
          >
            {filtered
              .slice(0, visible)
              .map((p) => {
                const a = account(p.id);
                return (
                  <article
                    className="character-card clickable-card"
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setFocus(p)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setFocus(p);
                      }
                    }}
                  >
                    <div className="character-card-heading">
                      <span className="character-avatar">
                        {p.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <h3>{value(a?.name || p.name)}</h3>
                        <p>ID {p.id}</p>
                      </div>
                      <span
                        className={
                          'character-status ' +
                          (server?.online ? '' : 'offline')
                        }
                        title={
                          server?.online ? 'Çevrimiçi' : 'Sunucu çevrimdışı'
                        }
                      />
                    </div>
                    <dl>
                      <div>
                        <Users size={15} />
                        <dd>{p.name}</dd>
                      </div>
                      <div>
                        <BriefcaseBusiness size={15} />
                        <dd>
                          {a?.job
                            ? value(a.job) + ' · ' + value(a.grade)
                            : 'Meslek bilgisi yok'}
                        </dd>
                      </div>
                      <div>
                        <Fingerprint size={15} />
                        <dd>{value(a?.identifier || p.license)}</dd>
                      </div>
                      {(p.steamHex || (typeof a?.steamHex === 'string' && a.steamHex)) && <div>
                        <Gamepad2 size={15} />
                        <dd>{value(p.steamHex || a?.steamHex)}</dd>
                      </div>}
                      {(p.discord || (typeof a?.discord === 'string' && a.discord)) && <div>
                        <MessageCircle size={15} />
                        <dd>{String(p.discord || a?.discord).replace(/^discord:/, '')}</dd>
                      </div>}
                      <div>
                        <Wifi size={15} />
                        <dd>{p.ping} ms</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
          </div>
          {!filtered.length && (
            <div className="empty">
              <Users className="mx-auto mb-3" />
              Oyuncu bulunamadı.
            </div>
          )}
          <div ref={loadMore} className="py-4 text-center text-sm text-muted-foreground" role="status">
            {Math.min(visible, filtered.length)} / {filtered.length} oyuncu
            {visible < filtered.length ? ' · Aşağı kaydırdıkça yüklenir' : filtered.length ? ' · Listenin sonu' : ''}
          </div>
        </div>
        <aside className="directory-summary">
          <Users size={30} />
          <p>Sunucudaki oyuncular</p>
          <strong>
            {players.length}
            <small> / {server?.maxPlayers || 0}</small>
          </strong>
          <div className="summary-meter">
            <span
              style={{
                width:
                  Math.min(
                    100,
                    (players.length / (server?.maxPlayers || 1)) * 100,
                  ) + '%',
              }}
            />
          </div>
          <p className="text-sm">{server?.name || 'Sunucu seçilmedi'}</p>
          <div className="summary-divider" />
          <h3>Karakter kayıtları</h3>
          <Button
            variant="outline"
            disabled={!allowed('accounts')}
            onClick={() => onNavigate('accounts')}
          >
            Hesapları aç <ArrowUpRight size={15} />
          </Button>
        </aside>
      </div>
    </section>
  );
}
