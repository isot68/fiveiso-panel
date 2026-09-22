'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Fingerprint,
  Package,
  Search,
  Users,
  Wallet,
  Gamepad2,
  CarFront,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { notify } from '@/components/ui/toast-center';
import { PlayerInventory } from './player-inventory';
import { OwnedVehicles } from './owned-vehicles';
import { ProfileDetails, ProfileMoney } from './profile-details';
import { LayoutToggle, type PanelLayout } from './layout-toggle';
import type { Server } from '@/lib/panel-types';

type Character = {
  identifier: string;
  firstname: string;
  lastname: string;
  playerName?: string;
  job?: string;
  grade?: number;
  gang?: string;
  expected?: string;
  steamHex?: string;
  discord?: string;
};
type Detail = Character & {
  license: string;
  steamHex: string;
  discord: string;
  playerName: string;
  cash: number;
  bank: number;
  gangGrade: number;
  inventory: Record<string, unknown>[];
  jobVersion: string;
  gangVersion: string;
  inventoryVersion: string;
  source?: 'live' | 'database';
};
type Result = {
  status: string;
  result?: string;
  data?: Record<string, unknown>;
};
type Operation =
  | 'dbSetCharacter'
  | 'dbSetBalanceCash'
  | 'dbSetBalanceBank'
  | 'dbSetJob'
  | 'dbSetGang'
  | 'dbInventoryAdd'
  | 'dbInventoryRemove';
const operations: { type: Operation; label: string; icon: typeof Users }[] = [
  { type: 'dbSetCharacter', label: 'Ad soyad değiştir', icon: Fingerprint },
  { type: 'dbSetBalanceCash', label: 'Nakit değiştir', icon: Wallet },
  { type: 'dbSetBalanceBank', label: 'Banka değiştir', icon: Wallet },
  { type: 'dbSetJob', label: 'Meslek ata', icon: BriefcaseBusiness },
  { type: 'dbSetGang', label: 'Çete ata', icon: Users },
  { type: 'dbInventoryAdd', label: 'Eşya ekle', icon: Package },
  { type: 'dbInventoryRemove', label: 'Eşya al', icon: Package },
];

export function CharacterAccounts({
  server,
  live,
  canAction,
  request,
}: {
  server: Server;
  live: boolean;
  canAction: (action: string) => boolean;
  request: <T = unknown>(path: string, body?: unknown) => Promise<T>;
}) {
  const itemCatalog = server.itemCatalog || [];
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<PanelLayout>('grid');
  const [rows, setRows] = useState<Character[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [ownedVehicles, setOwnedVehicles] = useState<Record<string, unknown>[]>([]);
  const [vehiclesBusy, setVehiclesBusy] = useState(false);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const searchVersion = useRef(0);
  const detailGeneration = useRef(0);
  const searchQuery = useRef('');
  const sentinel = useRef<HTMLOutputElement>(null);
  const ready =
    live &&
    server.online &&
    canAction('dbCharacters') &&
    server.capabilities?.includes('dbCharacters');
  const vehicleAccess =
    canAction('dbVehicles') && server.capabilities?.includes('dbVehicles');

  useEffect(
    () => () => {
      generation.current++;
      detailGeneration.current++;
    },
    [],
  );

  async function execute(action: Record<string, unknown>) {
    const current = generation.current;
    const queued = await request<{ id: string }>(
      `/servers/${encodeURIComponent(server.id)}/actions`,
      action,
    );
    for (let attempt = 0; attempt < 240; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (current !== generation.current) throw Error('Görünüm kapatıldı.');
      const result = await request<Result>(
        `/commands/${encodeURIComponent(queued.id)}`,
      );
      if (result.status === 'completed') return result;
      if (['failed', 'expired', 'cancelled'].includes(result.status))
        throw Error(result.result || 'İşlem tamamlanamadı.');
    }
    throw Error(
      'Sonuç bekleme süresi doldu. Tekrar işlem yapmadan önce kaydı yeniden sorgulayın.',
    );
  }

  async function search(next = 0, append = false) {
    if (!ready) return;
    const version = ++searchVersion.current;
    if (!append) {
      searchQuery.current = query;
      setLoaded(false);
      setRows([]);
    }
    setBusy(true);
    try {
      const result = await execute({
        type: 'dbCharacters',
        params: { query: searchQuery.current, page: next },
      });
      if (version !== searchVersion.current) return;
      const data = result.data as
        | { rows?: Character[]; more?: boolean }
        | undefined;
      if (!Array.isArray(data?.rows))
        throw Error('Karakter listesi alınamadı.');
      setRows((previous) =>
        append ? [...previous, ...data.rows!] : data.rows!,
      );
      setPage(next);
      setMore(!!data.more);
      setLoaded(true);
      setMessage('');
    } catch (error) {
      if (version !== searchVersion.current) return;
      setMessage((error as Error).message);
      notify((error as Error).message, 'error');
    } finally {
      if (version === searchVersion.current) setBusy(false);
    }
  }

  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  });

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void searchRef.current();
    }, 300);
    return () => { clearTimeout(timer); searchVersion.current++; };
  }, [server.id, ready, query]);
  useEffect(() => {
    if (!sentinel.current || !loaded || !more || busy || selected) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void searchRef.current(page + 1, true);
      },
      { rootMargin: '300px' },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loaded, more, busy, page, selected]);

  async function openCharacter(identifier: string) {
    const current = ++detailGeneration.current;
    setSelected(identifier);
    setDetail(null);
    setOwnedVehicles([]);
    setDetailBusy(true);
    try {
      const result = await execute({
        type: 'dbCharacterDetail',
        target: identifier,
        params: {},
      });
      if (current !== detailGeneration.current) return;
      if (!result.data || !Array.isArray(result.data.inventory))
        throw Error('Karakter ayrıntıları alınamadı.');
      setDetail(result.data as Detail);
      setDetailBusy(false);
      if (vehicleAccess) {
        setVehiclesBusy(true);
        try {
          const vehicleResult = await execute({
            type: 'dbVehicles',
            params: { query: identifier, page: 0 },
          });
          if (current !== detailGeneration.current) return;
          const rows = Array.isArray(vehicleResult.data?.rows)
            ? vehicleResult.data.rows as Record<string, unknown>[]
            : [];
          setOwnedVehicles(rows.filter((row) => String(row.owner) === identifier));
        } catch (error) {
          if (current === detailGeneration.current)
            notify((error as Error).message, 'error');
        } finally {
          if (current === detailGeneration.current) setVehiclesBusy(false);
        }
      }
    } catch (error) {
      if (current !== detailGeneration.current) return;
      setMessage((error as Error).message);
      notify((error as Error).message, 'error');
    } finally {
      if (current === detailGeneration.current) setDetailBusy(false);
    }
  }
  const openCharacterRef = useRef(openCharacter);
  useEffect(() => { openCharacterRef.current = openCharacter; });

  const capability = (type: Operation) =>
    type.startsWith('dbSetBalance') ? 'dbSetBalance' : type;
  const available = operations.filter(
    ({ type }) =>
      canAction(capability(type)) &&
      server.capabilities?.includes(capability(type)),
  );
  const online = (identifier: string) =>
    server.accounts?.some(
      (account) => String(account.identifier) === identifier &&
        server.players.some((player) => player.id === String(account.id)),
    ) || false;
  const playerName = (row: Character) => {
    const account = server.accounts?.find(
      (entry) => String(entry.identifier) === row.identifier,
    );
    const player =
      account &&
      server.players.find((entry) => entry.id === String(account.id));
    return player?.name || row.playerName || 'Oyuncu adı kaydedilmedi';
  };
  const activeAccount =
    detail &&
    server.accounts?.find(
      (account) => String(account.identifier) === detail.identifier,
    );
  const activePlayer =
    activeAccount &&
    server.players.find((player) => player.id === String(activeAccount.id));
  const activeEconomy = activePlayer && server.economy?.find(
    (entry) => String(entry.id) === activePlayer.id,
  );
  const displayDetail: Detail | null = detail && activeAccount && activePlayer ? {
    ...detail,
    firstname: typeof activeAccount.firstname === 'string' ? activeAccount.firstname : detail.firstname,
    lastname: typeof activeAccount.lastname === 'string' ? activeAccount.lastname : detail.lastname,
    license: typeof activeAccount.license === 'string' ? activeAccount.license : detail.license,
    steamHex: typeof activeAccount.steamHex === 'string' ? activeAccount.steamHex : detail.steamHex,
    playerName: activePlayer.name,
    job: typeof activeAccount.job === 'string' ? activeAccount.job : detail.job,
    grade: Number(activeAccount.grade ?? detail.grade),
    gang: typeof activeAccount.gang === 'string' ? activeAccount.gang : detail.gang,
    gangGrade: Number(activeAccount.gangGrade ?? detail.gangGrade),
    cash: Number(activeEconomy?.cash ?? detail.cash),
    bank: Number(activeEconomy?.bank ?? detail.bank),
    inventory: server.items ? server.items.filter((item) => String(item.id) === activePlayer.id).map((item) => ({ ...item, count: item.amount ?? item.count })) : detail.inventory,
    source: 'live',
  } : detail;
  const shown = displayDetail;
  const selectedOnline = selected ? online(selected) : false;
  const previousPresence = useRef<{ identifier: string; online: boolean } | null>(null);
  useEffect(() => {
    if (!selected) { previousPresence.current = null; return; }
    const previous = previousPresence.current;
    previousPresence.current = { identifier: selected, online: selectedOnline };
    if (!previous || previous.identifier !== selected || previous.online === selectedOnline) return;
    const timer = setTimeout(() => void openCharacterRef.current(selected), selectedOnline ? 0 : 1500);
    return () => clearTimeout(timer);
  }, [selected, selectedOnline]);
  const activeSteam =
    typeof activeAccount?.steamHex === 'string' ? activeAccount.steamHex : '';
  const field = (label: string, value: string | number | null | undefined) => (
    <div className="profile-field">
      <span>{label}</span>
      <strong>{String(value ?? '—')}</strong>
    </div>
  );

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !detail || !operation) return;
    const form = new FormData(event.currentTarget);
    const textField = (name: string) => {
      const value = form.get(name);
      return typeof value === 'string' ? value.trim() : '';
    };
    const params: Record<string, string | number> = {};
    const type = capability(operation);
    if (operation === 'dbSetCharacter') {
      params.firstname = textField('firstname');
      params.lastname = textField('lastname');
      params.expected = `${detail.firstname}|${detail.lastname}`;
    } else if (type === 'dbSetBalance') {
      params.account = operation === 'dbSetBalanceCash' ? 'cash' : 'bank';
      params.amount = Number(form.get('amount'));
      params.expected = detail[params.account as 'cash' | 'bank'];
    } else if (type === 'dbSetJob' || type === 'dbSetGang') {
      params.name = textField('name');
      params.grade = Number(form.get('grade'));
      params.expected =
        type === 'dbSetJob' ? detail.jobVersion : detail.gangVersion;
    } else {
      params.name = textField('name');
      params.amount = Number(form.get('amount'));
      params.expected = detail.inventoryVersion;
    }
    setBusy(true);
    try {
      await execute({
        type,
        target: selected,
        value: 'Panel karakter işlemi',
        params,
      });
      setOperation(null);
      notify('Karakter kaydı güncellendi.', 'success');
      await openCharacter(selected);
      if (
        type === 'dbSetCharacter' ||
        type === 'dbSetJob' ||
        type === 'dbSetGang'
      )
        await search();
    } catch (error) {
      setMessage((error as Error).message);
      notify((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (selected)
    return (
      <section className="player-workspace profile-detail">
        <Button
          variant="ghost"
          className="mb-5"
          onClick={() => {
            detailGeneration.current++;
            setSelected(null);
            setDetail(null);
          }}
        >
          <ArrowLeft size={16} /> Karakterlere dön
        </Button>
        {detailBusy ? (
          <output>Karakter ayrıntıları yükleniyor…</output>
        ) : !shown ? (
          <div className="empty">
            {message || 'Karakter ayrıntıları görüntülenemedi.'}
          </div>
        ) : (
          <>
            <div className="profile-layout">
              <div className="profile-information">
            <div className="profile-heading">
              <span className="character-avatar large">
                {(shown.firstname[0] || '?') + (shown.lastname[0] || '')}
              </span>
              <div>
                <h2>
                  {shown.firstname} {shown.lastname}
                </h2>
                <p>{shown.identifier} · {selectedOnline ? 'Oyun içi bilgiler' : 'Veritabanı kaydı'}</p>
              </div>
              <span className="id-tag">
                {selectedOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
              </span>
            </div>

                <Tabs defaultValue="general">
                  <TabsList variant="line">
                    <TabsTrigger value="general" title="Genel bilgiler"><Fingerprint size={18} /> Genel bilgiler</TabsTrigger>
                    <TabsTrigger value="inventory" title="Envanter"><Wallet size={18} />
                      Envanter · {shown.inventory.length}
                    </TabsTrigger>
                    {vehicleAccess && (
                      <TabsTrigger value="vehicles" title="Araçlar"><CarFront size={18} />
                        Araçlar · {ownedVehicles.length}
                      </TabsTrigger>
                    )}
                  <TabsTrigger value="money" title="Para"><Wallet size={18}/> Para</TabsTrigger>
                  </TabsList>
                  <TabsContent value="general"><ProfileDetails key={shown.identifier} data={{...shown, ...Object.fromEntries(Object.entries(activeAccount || {}).filter(([,v])=>v!==undefined)), playerName:activePlayer?.name || shown.playerName,steamHex:activeSteam||shown.steamHex}} server={server} onlineId={activePlayer?.id} onUpdated={()=>void openCharacter(shown.identifier)} canAction={canAction} request={request}/></TabsContent>
                  <TabsContent value="money"><ProfileMoney cash={shown.cash} bank={shown.bank}/></TabsContent>
                  <TabsContent value="inventory">
                    <PlayerInventory
                      items={shown.inventory}
                      serverId={server.id}
                      note={selectedOnline ? 'Oyun içindeki envanter · Sunucu yenilemesiyle güncellenir.' : 'Veritabanındaki envanter · Değişiklikler sağdaki işlemlerden yapılır.'}
                    />
                  </TabsContent>
                  {vehicleAccess && (
                    <TabsContent value="vehicles">
                      <OwnedVehicles vehicles={ownedVehicles} loading={vehiclesBusy} />
                    </TabsContent>
                  )}
                </Tabs>
              </div>
              <aside className="player-actions">
                <h3>Karakter işlemleri</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {selectedOnline
                    ? 'Karakter şu anda oyunda. SQL işlemleri, oyuncu çıkınca açılır.'
                    : 'Bu işlemler yalnızca karakter oyunda değilken uygulanır.'}
                </p>
                <div className="action-tiles">
                  {available.map(({ type, label, icon: Icon }, index) => (
                    <Button
                      key={type}
                      className={`action-tile tone-${index % 6}`}
                      disabled={
                        busy || !server.online || selectedOnline
                      }
                      onClick={() => setOperation(type)}
                    >
                      <Icon size={23} />
                      {label}
                    </Button>
                  ))}
                </div>
                {!available.length && (
                  <p className="text-sm text-muted-foreground">
                    Bu hesapta çevrimdışı işlem yetkisi veya ajan desteği
                    bulunmuyor.
                  </p>
                )}
              </aside>
            </div>
          </>
        )}
        <Dialog
          open={!!operation}
          onOpenChange={(open) => {
            if (!open && !busy) setOperation(null);
          }}
        >
          <DialogContent>
            <DialogTitle>
              {operations.find((item) => item.type === operation)?.label}
            </DialogTitle>
            <DialogDescription>
              {detail?.firstname} {detail?.lastname} karakterinin kaydını
              değiştirmek istediğine emin misin? İşlem kaydedilir.
            </DialogDescription>
            <form
              className="grid gap-4"
              onSubmit={(event) => void submit(event)}
            >
              {operation === 'dbSetCharacter' && (
                <>
                  <label htmlFor="character-firstname">
                    Ad
                    <Input
                      id="character-firstname"
                      name="firstname"
                      defaultValue={detail?.firstname}
                      maxLength={40}
                      required
                    />
                  </label>
                  <label htmlFor="character-lastname">
                    Soyad
                    <Input
                      id="character-lastname"
                      name="lastname"
                      defaultValue={detail?.lastname}
                      maxLength={40}
                      required
                    />
                  </label>
                </>
              )}
              {operation?.startsWith('dbSetBalance') && (
                <label htmlFor="character-balance">
                  Yeni toplam bakiye
                  <Input
                    id="character-balance"
                    name="amount"
                    type="number"
                    min={0}
                    max={100000000}
                    step={1}
                    defaultValue={
                      operation === 'dbSetBalanceCash'
                        ? detail?.cash
                        : detail?.bank
                    }
                    required
                  />
                </label>
              )}
              {(operation === 'dbSetJob' || operation === 'dbSetGang') && (
                <>
                  <label htmlFor="character-group-name">
                    {operation === 'dbSetJob' ? 'Meslek kodu' : 'Çete kodu'}
                    <Input
                      id="character-group-name"
                      name="name"
                      list={
                        operation === 'dbSetJob' ? 'fiveiso-jobs' : 'fiveiso-gangs'
                      }
                      maxLength={80}
                      required
                    />
                  </label>
                  <label htmlFor="character-group-grade">
                    Rütbe
                    <Input
                      id="character-group-grade"
                      name="grade"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      defaultValue={0}
                      required
                    />
                  </label>
                  <datalist id="fiveiso-jobs">
                    {server.jobs?.map((job, index) => (
                      <option key={index} value={String(job.name)}>
                        {String(job.label || job.name)}
                      </option>
                    ))}
                  </datalist>
                  <datalist id="fiveiso-gangs">
                    {server.factions?.map((gang, index) => (
                      <option key={index} value={String(gang.name)}>
                        {String(gang.label || gang.name)}
                      </option>
                    ))}
                  </datalist>
                </>
              )}
              {(operation === 'dbInventoryAdd' ||
                operation === 'dbInventoryRemove') && (
                <>
                  <label htmlFor="character-item-name">
                    Eşya kodu
                    <Input
                      id="character-item-name"
                      name="name"
                      list="fiveiso-inventory-items"
                      maxLength={80}
                      required
                    />
                  </label>
                  <label htmlFor="character-item-count">
                    Adet
                    <Input
                      id="character-item-count"
                      name="amount"
                      type="number"
                      min={1}
                      max={1000}
                      step={1}
                      required
                    />
                  </label>
                  <datalist id="fiveiso-inventory-items">
                    {(operation === 'dbInventoryAdd'
                      ? itemCatalog
                      : detail?.inventory || []
                    ).map((item, index) => (
                      <option key={index} value={String(item.name)}>
                        {String(item.label || item.name)}
                      </option>
                    ))}
                  </datalist>
                </>
              )}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOperation(null)}
                >
                  Hayır
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Uygulanıyor…' : 'Evet'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </section>
    );

  return (
    <section className="player-workspace">
      <form
        className="directory-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <div className="search-box">
          <Search size={17} />
          <Input
            aria-label="Karakter ara"
            placeholder="Karakter adı veya kimliği ara…"
            maxLength={80}
            value={query}
            onChange={(event) => { searchVersion.current++; setLoaded(false); setMore(false); setQuery(event.target.value); }}
          />
        </div>
        <LayoutToggle value={layout} onChange={setLayout} />
      </form>
      {!live ? (
        <p>Karakter kayıtları için giriş yapın.</p>
      ) : !server.online ? (
        <p>Sunucu bağlantısı bekleniyor.</p>
      ) : !ready ? (
        <p>Karakter sorgusu için yetki veya ajan desteği bulunmuyor.</p>
      ) : null}
      {busy && (
        <output className="text-sm text-primary mb-3">
          Karakterler yükleniyor…
        </output>
      )}
      {message && (
        <output className="text-sm text-amber-200 mb-3">{message}</output>
      )}
      <div className={`character-grid account-character-grid layout-collection layout-${layout} ${layout === 'list' ? 'as-list' : ''}`}>
        {rows.map((row) => {
          const account = server.accounts?.find((entry) =>
            String(entry.identifier) === row.identifier &&
              server.players.some((player) => player.id === String(entry.id)),
          );
          const firstname = typeof account?.firstname === 'string' ? account.firstname : row.firstname;
          const lastname = typeof account?.lastname === 'string' ? account.lastname : row.lastname;
          const inspectable = canAction('dbCharacterDetail') && server.capabilities?.includes('dbCharacterDetail');
          return (
          <article
            className={`character-card account-character-card${inspectable ? ' clickable-card' : ''}`}
            key={row.identifier}
            role={inspectable ? 'button' : undefined}
            tabIndex={inspectable ? 0 : undefined}
            aria-disabled={!inspectable}
            onClick={() => { if (inspectable) void openCharacter(row.identifier); }}
            onKeyDown={(event) => {
              if (inspectable && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                void openCharacter(row.identifier);
              }
            }}
          >
            <div className="character-card-heading">
              <span className="character-avatar">
                {(firstname[0] || '?') + (lastname[0] || '')}
              </span>
              <div>
                <h3>
                  {firstname} {lastname}
                </h3>
              </div>
              <span
                className={
                  'character-status ' +
                  (online(row.identifier) ? '' : 'offline')
                }
                title={online(row.identifier) ? 'Çevrimiçi' : 'Çevrimdışı'}
              />
            </div>
            <dl>
              <div>
                <Users size={15} />
                <dd>{playerName(row)}</dd>
              </div>
              <div>
                <BriefcaseBusiness size={15} />
                <dd>
                  {(typeof account?.job === 'string' ? account.job : row.job) || 'Meslek bilgisi yok'}{' '}
                  <span className="ml-2">{Number(account?.grade ?? row.grade ?? 0)}</span>
                </dd>
              </div>
              <div>
                <Fingerprint size={15} />
                <dd>{row.identifier}</dd>
              </div>
              {(typeof account?.steamHex === 'string' ? account.steamHex : row.steamHex) && <div>
                <Gamepad2 size={15} />
                <dd>{String(account?.steamHex || row.steamHex)}</dd>
              </div>}
              {(typeof account?.discord === 'string' ? account.discord : row.discord) && <div>
                <MessageCircle size={15} />
                <dd>{String(account?.discord || row.discord).replace(/^discord:/, '')}</dd>
              </div>}
            </dl>
          </article>
        ); })}
      </div>
      {loaded && !rows.length && (
        <div className="empty">Karakter kaydı bulunamadı.</div>
      )}
      <output
        ref={sentinel}
        className="block py-4 text-center text-sm text-muted-foreground"
      >
        {busy
          ? 'Yükleniyor…'
          : more
            ? `${rows.length} karakter yüklendi · Aşağı kaydırdıkça devam eder`
            : loaded
              ? `${rows.length} karakter · Listenin sonu`
              : ''}
      </output>
    </section>
  );
}
