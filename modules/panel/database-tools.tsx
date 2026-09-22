'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/toast-center';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Server } from '@/lib/panel-types';
import { Car, Search } from 'lucide-react';
import { LayoutToggle, type PanelLayout } from './layout-toggle';
type Row = Record<string, string | number>;
type Result = {
  status: string;
  result?: string;
  data?: { rows?: Row[]; more?: boolean };
};
export function DatabaseTools({
  module,
  server,
  live,
  canAction,
  request,
}: {
  module: string;
  server: Server;
  live: boolean;
  canAction: (action: string) => boolean;
  request: <T = unknown>(path: string, body?: unknown) => Promise<T>;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [layout, setLayout] = useState<PanelLayout>('grid');
  const generation = useRef(0);
  const searchVersion = useRef(0);
  const loadMore = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const type =
    module === 'accounts'
      ? 'dbCharacters'
      : module === 'economy'
        ? 'dbBalances'
        : 'dbVehicles';
  const writeType =
    module === 'accounts'
      ? 'dbSetCharacter'
      : module === 'economy'
        ? 'dbSetBalance'
        : 'dbSetGarage';
  const cols =
    module === 'accounts'
      ? ['identifier', 'firstname', 'lastname']
      : module === 'economy'
        ? ['identifier', 'cash', 'bank']
        : ['owner', 'plate', 'model', 'garage'];
  const labels: Record<string, string> = {
    identifier: 'Karakter kimliği',
    firstname: 'Ad',
    lastname: 'Soyad',
    cash: 'Nakit',
    bank: 'Banka',
    owner: 'Karakter sahibi',
    plate: 'Plaka',
    model: 'Model',
    garage: 'Garaj',
  };
  async function execute(action: unknown) {
    const current = generation.current;
    const queued = await request<{ id: string }>(
      `/servers/${encodeURIComponent(server.id)}/actions`,
      action,
    );
    for (let i = 0; i < 240; i++) {
      await new Promise((r) => setTimeout(r, 250));
      if (current !== generation.current) throw Error('Görünüm kapatıldı.');
      const result = await request<Result>(
        `/commands/${encodeURIComponent(queued.id)}`,
      );
      if (result.status === 'completed') return result;
      if (['failed', 'expired', 'cancelled'].includes(result.status))
        throw Error(result.result || 'İşlem tamamlanamadı.');
    }
    throw Error(
      'Sonuç bekleme süresi doldu. İşlem kayıtlarını kontrol edin; tekrar göndermeden önce kaydı sorgulayın.',
    );
  }
  async function search(next: number, append = false) {
    if (!ready) return;
    const version = ++searchVersion.current;
    const current = generation.current;
    if (!append) setLoaded(false);
    setBusy(true);
    setMessage(append ? 'Yeni kayıtlar yükleniyor…' : 'Sunucu veritabanı sorgulanıyor…');
    try {
      const result = await execute({ type, params: { query, page: next } });
      if (current !== generation.current || version !== searchVersion.current) return;
      if (!Array.isArray(result.data?.rows)) throw Error('Sunucudan kayıt listesi alınamadı. Yeniden sorgulayın.');
      setRows((currentRows) => append ? [...currentRows, ...result.data!.rows!] : result.data!.rows!);
      setLoaded(true);
      setMore(!!result.data?.more);
      setPage(next);
      setMessage(result.data.more ? 'Aşağı kaydırdıkça yeni kayıtlar yüklenecek.' : 'Tüm kayıtlar yüklendi.');
    } catch (e) {
      if (current !== generation.current || version !== searchVersion.current) return;
      if (!append) setRows([]);
      setMessage((e as Error).message);
      notify((e as Error).message, 'error');
    } finally {
      if (current === generation.current) if (version === searchVersion.current) setBusy(false);
    }
  }
  const mayRead = canAction(type);
  const mayWrite = canAction(writeType);
  const ready = live && mayRead && server.online && !!server.capabilities?.includes(type);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => { void search(0); }, 300);
    return () => { clearTimeout(timer); searchVersion.current++; };
  }, [module, server.id, ready, query]);
  useEffect(() => {
    const target = loadMore.current;
    if (!target || !loaded || !more || busy) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void search(page + 1, true);
    }, { rootMargin: '300px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loaded, more, busy, page]);
  return (
    <section className="vehicle-workspace space-y-4">
      <form
        className="directory-toolbar record-search-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          void search(0);
        }}
      >
        <div className="search-box">
          <Search size={19} />
          <Input
            aria-label="Veritabanında ara"
            placeholder={
              module === 'vehicles'
                ? 'Plaka veya karakter kimliği'
                : 'Karakter kimliği veya ad'
            }
            maxLength={80}
            value={query}
            onChange={(e) => { searchVersion.current++; setLoaded(false); setMore(false); setQuery(e.target.value); }}
          />
        </div>
        <LayoutToggle value={layout} onChange={setLayout} />
      </form>
      {!live ? <p className="text-sm text-muted-foreground">Kayıtları görmek için merkez hesabınızla giriş yapın.</p> : !mayRead ? <p className="text-sm text-amber-200">Hesabınıza bu sorgu yetkisi verilmemiş.</p> : !server.online ? <p className="text-sm text-amber-200">Sunucu çevrimdışı. Veritabanı sorgusu için ajan bağlantısını bekleyin.</p> : !server.capabilities?.includes(type) && (
        <p className="text-sm text-amber-200">
          Veritabanı bağlantısı hazır değil. Müşteri scriptindeki bağlantı ve
          şema ayarlarını kontrol edin.
        </p>
      )}
      {busy && <p role="status" className="text-sm text-primary">Kayıtlar sunucudan yükleniyor…</p>}
      {loaded && !rows.length && <p className="empty">Aramanıza uygun kayıt bulunamadı.</p>}
      {layout === 'list' ? <div className="layout-collection layout-list"><Table>
        <TableHeader>
          <TableRow>
            {cols.map((c) => (
              <TableHead key={c}>{labels[c]}</TableHead>
            ))}
            {mayWrite && <TableHead>İşlem</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {cols.map((c) => (
                <TableCell key={c}>{String(r[c] ?? '—')}</TableCell>
              ))}
              {mayWrite && <TableCell>
                <Button
                  variant="outline"
                  disabled={
                    busy || !server.capabilities?.includes(writeType)
                  }
                  onClick={() => setSelected(r)}
                >
                  Düzenle
                </Button>
              </TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table></div> : <div className="record-grid database-card-grid layout-collection layout-grid">
        {rows.map((r, i) => (
          <article
            className={`record-card${mayWrite && server.capabilities?.includes(writeType) ? ' clickable-card' : ''}`}
            key={String(r.plate || r.identifier || i)}
            role={mayWrite && server.capabilities?.includes(writeType) ? 'button' : undefined}
            tabIndex={mayWrite && server.capabilities?.includes(writeType) ? 0 : undefined}
            onClick={() => { if (mayWrite && server.capabilities?.includes(writeType) && !busy) setSelected(r); }}
            onKeyDown={(event) => {
              if (mayWrite && server.capabilities?.includes(writeType) && !busy && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                setSelected(r);
              }
            }}
          >
            <header><span className="record-symbol"><Car size={22} /></span><div><h3>{String(r.plate || r.identifier || 'Kayıt')}</h3><p>{String(r.model || r.firstname || 'Sunucu veritabanı')}</p></div></header>
            <dl>{cols.slice(0, 4).map((c) => <div key={c}><dt>{labels[c]}</dt><dd>{String(r[c] ?? '—')}</dd></div>)}</dl>
          </article>
        ))}
      </div>}
      <div ref={loadMore} className="py-3 text-center text-sm text-muted-foreground" role="status">
        {busy ? 'Kayıtlar yükleniyor…' : more ? `${rows.length} kayıt yüklendi · Devamı için aşağı kaydırın` : loaded ? `${rows.length} kayıt · Listenin sonu` : ''}
      </div>
      <p className="text-sm text-muted-foreground">
        Değişiklikler doğrudan sunucu veritabanına uygulanır.
      </p>
      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!busy && !v) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Veritabanı kaydını düzenle</DialogTitle>
          <DialogDescription>
            {String(selected?.identifier || selected?.plate || '')} · Değişiklik
            kalıcıdır ve işlem kaydına yazılır.
          </DialogDescription>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selected) return;
              const f = new FormData(e.currentTarget);
              let params: Record<string, string | number>;
              if (module === 'accounts')
                params = {
                  firstname: String(f.get('firstname')),
                  lastname: String(f.get('lastname')),
                  expected: String(selected.expected),
                };
              else if (module === 'economy') {
                const account = String(f.get('account'));
                params = {
                  account,
                  amount: Number(f.get('amount')),
                  expected: Number(selected[account]),
                };
              } else
                params = {
                  garage: String(f.get('garage')),
                  expected: String(selected.garage || ''),
                };
              setBusy(true);
              setMessage('Değişiklik sonucu bekleniyor…');
              try {
                await execute({
                  type: writeType,
                  target: String(selected.identifier || selected.plate),
                  value: 'Panel veritabanı düzenlemesi',
                  params,
                });
                setSelected(null);
                setRows([]);
                setMessage(
                  'Kayıt güncellendi. Güncel değerleri görmek için yeniden sorgulayın.',
                );
                notify('Kayıt başarıyla güncellendi.', 'success');
              } catch (e) {
                setMessage((e as Error).message);
                notify((e as Error).message, 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            {module === 'accounts' ? (
              <>
                {['firstname', 'lastname'].map((c) => (
                  <label key={c}>
                    {labels[c]}
                    <Input
                      name={c}
                      defaultValue={String(selected?.[c] || '')}
                      maxLength={40}
                      required
                    />
                  </label>
                ))}
              </>
            ) : module === 'economy' ? (
              <>
                <fieldset>
                  <legend>Hesap</legend>
                  <RadioGroup name="account" defaultValue="bank">
                    <label className="flex items-center gap-2">
                      <RadioGroupItem value="bank" /> Banka ({selected?.bank})
                    </label>
                    <label className="flex items-center gap-2">
                      <RadioGroupItem value="cash" /> Nakit ({selected?.cash})
                    </label>
                  </RadioGroup>
                </fieldset>
                <label>
                  Yeni toplam bakiye
                  <Input
                    name="amount"
                    type="number"
                    min={0}
                    max={100000000}
                    step={1}
                    required
                  />
                </label>
              </>
            ) : (
              <label>
                Yeni garaj kodu
                <Input
                  name="garage"
                  defaultValue={String(selected?.garage || '')}
                  maxLength={50}
                  required
                />
              </label>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? 'Sonuç bekleniyor…' : 'Onayla ve kaydet'}
            </Button>
            {message && <p role="status">{message}</p>}
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
