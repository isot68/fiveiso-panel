'use client';
import { RecordCards } from './record-cards';
import { ItemCatalogFilters, type ItemFilter } from './item-catalog';
import {
  HeartPulse,
  Snowflake,
  Flame,
  Skull,
  MessageCircle,
  MapPin,
  PackagePlus,
  PackageMinus,
  Wallet,
  BriefcaseBusiness,
  Users,
  Car,
  Wrench,
  Trash2,
  Layers,
  Search,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/toast-center';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Action, Server } from '@/lib/panel-types';
import './game-tools.css';
import { LayoutToggle, type PanelLayout } from './layout-toggle';
const actions: Record<
  string,
  { label: string; module: string; fields?: string[] }
> = {
  heal: { label: 'İyileştir', module: 'players' },
  revive: { label: 'Canlandır', module: 'players' },
  freeze: { label: 'Dondur', module: 'players' },
  unfreeze: { label: 'Dondurmayı kaldır', module: 'players' },
  kill: { label: 'Karakteri öldür', module: 'players' },
  message: { label: 'Özel mesaj', module: 'players' },
  setBucket: {
    label: 'Routing bucket değiştir',
    module: 'players',
    fields: ['bucket'],
  },
  teleport: {
    label: 'Koordinata ışınla',
    module: 'map',
    fields: ['coordinates'],
  },
  giveItem: { label: 'Eşya ver', module: 'items', fields: ['name', 'amount'] },
  removeItem: { label: 'Eşya al', module: 'items', fields: ['name', 'amount'] },
  addMoney: { label: 'Para ekle', module: 'economy', fields: ['amount'] },
  removeMoney: { label: 'Para al', module: 'economy', fields: ['amount'] },
  setJob: { label: 'Meslek ata', module: 'jobs', fields: ['name', 'grade'] },
  setGang: { label: 'Çete ata', module: 'factions', fields: ['name', 'grade'] },
  createJob: { label: 'Meslek ekle', module: 'jobs' },
  updateJob: { label: 'Meslek düzenle', module: 'jobs' },
  deleteJob: { label: 'Meslek sil', module: 'jobs' },
  createGang: { label: 'Çete ekle', module: 'factions' },
  spawnVehicle: {
    label: 'Araç oluştur',
    module: 'vehicles',
    fields: ['model'],
  },
  repairVehicle: { label: 'Aracı onar', module: 'vehicles' },
  deleteVehicle: { label: 'Aracı sil', module: 'vehicles' },
};
const names: Record<string, string> = {
  name: 'Kod / isim',
  amount: 'Miktar',
  grade: 'Rütbe',
  model: 'Araç model kodu',
  bucket: 'Routing bucket',
  coordinates: 'Koordinat (X, Y, Z)',
};
const confirmations: Record<string, string> = {
  heal: 'Oyuncuyu iyileştirmek', revive: 'Oyuncuyu canlandırmak',
  freeze: 'Oyuncuyu dondurmak', unfreeze: 'Oyuncunun dondurmasını kaldırmak',
  kill: 'Oyuncunun karakterini öldürmek', message: 'Oyuncuya özel mesaj göndermek',
  setBucket: 'Oyuncunun routing bucket değerini değiştirmek',
  teleport: 'Oyuncuyu belirttiğiniz koordinata ışınlamak',
  giveItem: 'Oyuncuya eşya vermek', removeItem: 'Oyuncudan eşya almak',
  addMoney: 'Oyuncuya para eklemek', removeMoney: 'Oyuncudan para almak',
  setJob: 'Oyuncuya meslek atamak', setGang: 'Oyuncuya çete atamak',
  createJob: 'Yeni meslek eklemek', createGang: 'Yeni çete eklemek',
  deleteJob: 'Bu mesleği silmek',
  spawnVehicle: 'Oyuncu için araç oluşturmak', repairVehicle: 'Oyuncunun aracını onarmak',
  deleteVehicle: 'Oyuncunun aracını silmek',
};
const columns: Record<string, string[]> = {
  accounts: ['id', 'name', 'identifier', 'job', 'grade', 'gang'],
  items: ['id', 'name', 'label', 'amount'],
  economy: ['id', 'name', 'cash', 'bank'],
  jobs: ['name', 'label', 'grade', 'rank', 'salary'],
  factions: ['name', 'label', 'grade', 'rank'],
  vehicles: ['id', 'model', 'plate', 'owner'],
  map: ['id', 'name', 'x', 'y', 'z', 'bucket'],
};
const labels: Record<string, string> = {
  id: 'ID',
  name: 'İsim',
  identifier: 'Karakter kimliği',
  job: 'Meslek',
  grade: 'Rütbe',
  gang: 'Çete',
  label: 'Etiket',
  amount: 'Adet',
  cash: 'Nakit',
  bank: 'Banka',
  rank: 'Unvan',
  salary: 'Maaş',
  model: 'Model',
  plate: 'Plaka',
  owner: 'Ağ sahibi',
  bucket: 'Bucket',
};
export function GameTools({
  module,
  server,
  live,
  canAction,
  allowed,
  onAction,
  compact = false,
  focusTarget,
}: {
  module: string;
  compact?: boolean;
  focusTarget?: string;
  server?: Server;
  live: boolean;
  canAction: (action: string) => boolean;
  allowed?: (feature: string) => boolean;
  onAction: (a: Action) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('');
  const [target, setTarget] = useState('');
  const [account, setAccount] = useState('cash');
  const [query, setQuery] = useState('');
  const [itemFilter, setItemFilter] = useState<ItemFilter>('all');
  const [layout, setLayout] = useState<PanelLayout>('grid');
  const [busy, setBusy] = useState(false);
  const [grades, setGrades] = useState<{ id: number; name: string; payment: number; isboss: boolean; sourceGrade?: number }[]>([{ id: 0, name: '', payment: 0, isboss: false }]);
  const [editingJobName, setEditingJobName] = useState('');
  const [groupLabel, setGroupLabel] = useState('');
  const [jobType, setJobType] = useState('');
  const nextGradeId = useRef(1);
  const draggedGrade = useRef<{
    id: number;
    pointerId: number;
    layer: HTMLElement;
    move: (event: PointerEvent) => void;
    stop: (event: PointerEvent) => void;
    blur: () => void;
  } | null>(null);
  const [activeGradeId, setActiveGradeId] = useState<number | null>(null);
  const [defaultDuty, setDefaultDuty] = useState(true);
  const [offDutyPay, setOffDutyPay] = useState(false);
  const creating = kind === 'createJob' || kind === 'updateJob' || kind === 'createGang';
  const [, setMessage] = useState('');
  const targetPlayers = server?.players.length
    ? server.players
    : server?.targets || [];
  const createAction = module === 'jobs' ? 'createJob' : module === 'factions' ? 'createGang' : null;
  const moveGrade = (id: number, targetId: number) => setGrades((current) => {
    const from = current.findIndex((grade) => grade.id === id);
    const to = current.findIndex((grade) => grade.id === targetId);
    if (from < 0 || to < 0 || from === to) return current;
    const reordered = [...current];
    reordered.splice(to, 0, reordered.splice(from, 1)[0]);
    return reordered;
  });
  const endGradeDrag = () => {
    const drag = draggedGrade.current;
    if (drag) {
      window.removeEventListener('pointermove', drag.move);
      window.removeEventListener('pointerup', drag.stop);
      window.removeEventListener('pointercancel', drag.stop);
      window.removeEventListener('blur', drag.blur);
      drag.layer.remove();
    }
    draggedGrade.current = null;
    setActiveGradeId(null);
  };
  useEffect(() => {
    if (!open) endGradeDrag();
    return () => {
      const drag = draggedGrade.current;
      if (drag) {
        window.removeEventListener('pointermove', drag.move);
        window.removeEventListener('pointerup', drag.stop);
        window.removeEventListener('pointercancel', drag.stop);
        window.removeEventListener('blur', drag.blur);
        drag.layer.remove();
        draggedGrade.current = null;
      }
    };
  }, [open]);
  const available = Object.entries(actions).filter(
    ([key, a]) =>
      (module === 'all' ? !['createJob', 'updateJob', 'deleteJob', 'createGang'].includes(key) : a.module === module && !['setJob', 'setGang', 'createJob', 'updateJob', 'deleteJob', 'createGang'].includes(key) && (module !== 'items' || !['giveItem', 'removeItem'].includes(key))) &&
      canAction(key) &&
      (!allowed || allowed(a.module)) &&
      (!live || server?.capabilities?.includes(key)),
  );
  const itemCatalog = server?.itemCatalog || [];
  const rows = module === 'items' ? itemCatalog : (server?.[
    module === 'map' ? 'locations' : (module as keyof Server)
  ] || []) as Record<string, unknown>[];
  const filtered = Array.isArray(rows)
    ? rows.filter((r) =>
        JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
      )
    : [];
  const tileIcons: Record<string, typeof HeartPulse> = {
    heal: HeartPulse,
    revive: Flame,
    freeze: Snowflake,
    unfreeze: Snowflake,
    kill: Skull,
    message: MessageCircle,
    teleport: MapPin,
    giveItem: PackagePlus,
    removeItem: PackageMinus,
    addMoney: Wallet,
    removeMoney: Wallet,
    setJob: BriefcaseBusiness,
    setGang: Users,
    createJob: BriefcaseBusiness,
    updateJob: BriefcaseBusiness,
    deleteJob: Trash2,
    createGang: Users,
    spawnVehicle: Car,
    repairVehicle: Wrench,
    deleteVehicle: Trash2,
    setBucket: Layers,
  };
  return (
    <section className={compact ? 'compact-game-tools' : 'game-tools-workspace'}>
      {compact && (
        <div className="action-tiles">
          {available.map(([key, a], i) => {
            const Icon = tileIcons[key] || Layers;
            return (
              <Button
                key={key}
                className={'action-tile tone-' + (i % 6)}
                disabled={!server?.online || !focusTarget}
                onClick={() => {
                  setKind(key);
                  setTarget(focusTarget || '');
                  setMessage('');
                  setOpen(true);
                }}
              >
                <Icon size={23} />
                {a.label}
              </Button>
            );
          })}
        </div>
      )}
      {!compact && (
        <>
          <div className="directory-toolbar game-tools-toolbar">
              {module !== 'players' && (
                <div className="search-box">
                  <Search size={19} />
                  <Input
                    placeholder="Kayıtlarda ara"
                    aria-label="Kayıtlarda ara"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              )}
              {module === 'items' && <ItemCatalogFilters items={filtered} filter={itemFilter} onChange={setItemFilter} />}
              <div className="toolbar-end">
              {createAction && canAction(createAction) && <span
                title={live && !server?.capabilities?.includes(createAction) ? 'Sunucu ajanı bu işlemi henüz bildirmiyor. fiveiso-agent kaynağını yeniden başlatın.' : undefined}
              ><Button
                disabled={!server?.online || (live && !server.capabilities?.includes(createAction))}
                onClick={() => {
                  setKind(createAction);
                  setTarget('');
                  nextGradeId.current = 1;
                  setGrades([{ id: 0, name: '', payment: 0, isboss: false }]);
                  setEditingJobName('');
                  setGroupLabel('');
                  setJobType('');
                  setDefaultDuty(true);
                  setOffDutyPay(false);
                  setMessage('');
                  setOpen(true);
                }}
              >{actions[createAction].label}</Button></span>}
              {available.map(([key, action]) => <Button
                key={key}
                disabled={!server?.online || (!key.startsWith('create') && !targetPlayers.length)}
                onClick={() => {
                  setKind(key);
                  setTarget(targetPlayers[0]?.id || '');
                  setMessage('');
                  setOpen(true);
                }}
              >{action.label}</Button>)}
              <LayoutToggle value={layout} onChange={setLayout} />
              </div>
          </div>
          {module !== 'players' && (
            <>
              <RecordCards
                module={module}
                rows={filtered}
                itemFilter={itemFilter}
                layout={layout}
                serverId={server?.id || ''}
                allRows={Array.isArray(rows) ? rows : []}
                columns={columns[module] || []}
                labels={labels}
                onEditJob={module === 'jobs' && canAction('updateJob') && !!server?.online && server.capabilities?.includes('updateJob') ? (name, jobRows) => {
                  const ordered = [...jobRows].sort((a, b) => Number(a.grade) - Number(b.grade));
                  const first = ordered[0];
                  setKind('updateJob');
                  setEditingJobName(name);
                  setGroupLabel(String(first?.label || name));
                  setJobType(typeof first?.type === 'string' ? first.type : '');
                  setDefaultDuty(first?.defaultDuty !== false);
                  setOffDutyPay(first?.offDutyPay === true);
                  setGrades(ordered.map((row, index) => ({ id: index, sourceGrade: Number(row.grade), name: String(row.rank || ''), payment: Number(row.salary || 0), isboss: row.isboss === true })));
                  nextGradeId.current = ordered.length;
                  setMessage('');
                  setOpen(true);
                } : undefined}
                onDeleteJob={module === 'jobs' && canAction('deleteJob') && !!server?.online && server.capabilities?.includes('deleteJob') ? (name) => {
                  setKind('deleteJob');
                  setEditingJobName(name);
                  setMessage('');
                  setOpen(true);
                } : undefined}
              />

              {!filtered.length && (
                <div className="empty">
                  Kayıt bulunamadı. Bu modül için ajan ve framework bağlantısı
                  gerekir.
                </div>
              )}
              {!['items', 'jobs', 'factions'].includes(module) && filtered.length > 250 && (
                <p className="text-sm p-4 text-muted-foreground">
                  İlk 250 kayıt gösteriliyor. Aramayla daraltabilirsin.
                </p>
              )}
            </>
          )}
          {live && !available.length && !['accounts', 'items', 'jobs', 'factions'].includes(module) && (
            <p className="text-sm text-amber-200 p-4">
              Ajan bu modül için işlem desteği bildirmedi. Framework / kaynak
              yapılandırmasını kontrol et.
            </p>
          )}
        </>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={creating ? 'group-create-dialog' : undefined}>
          <DialogTitle>{actions[kind]?.label || 'Sunucu işlemi'}</DialogTitle>
          <DialogDescription>
            {creating
              ? kind === 'updateJob' ? 'Meslek adı, görev ayarları ve rütbeleri düzenle. Değişiklikler sunucuya hemen uygulanır.' : 'Görünen adı, iç kodu ve rütbeleri belirle. Kaydedince sunucuya hemen eklenir.'
              : kind === 'deleteJob' ? `${editingJobName} mesleğini silmek istediğine emin misin? Atanmış karakter varsa işlem engellenir.`
              : `${confirmations[kind] || 'Bu işlemi uygulamak'} istediğine emin misin?`}
          </DialogDescription>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const params: Record<string, unknown> = {};
              if (creating) {
                const name = String(f.get('groupName') || '').trim().toLowerCase();
                const label = String(f.get('groupLabel') || '').trim();
                const selectedType = String(f.get('jobType') || '').trim().toLowerCase();
                const levels = grades.map((grade, index) => ({ grade: index, name: grade.name.trim(), payment: kind === 'createGang' ? 0 : grade.payment, isboss: grade.isboss, ...(kind === 'updateJob' && grade.sourceGrade !== undefined ? { sourceGrade: grade.sourceGrade } : {}) }));
                if (!/^[a-z][a-z0-9_]{1,49}$/.test(name) || !label || label.length > 50 ||
                    (kind !== 'createGang' && selectedType !== '' && !/^[a-z][a-z0-9_]{0,31}$/.test(selectedType)) ||
                    levels.length > 20 || levels.some((grade) => !grade.name || !Number.isInteger(grade.payment) || grade.payment < 0 || grade.payment > 1000000)) {
                  notify('Kod, ad veya rütbe bilgilerini kontrol edin.', 'error');
                  return;
                }
                Object.assign(params, { name, label, grades: levels });
                if (kind === 'createJob' || kind === 'updateJob') {
                  Object.assign(params, { defaultDuty, offDutyPay });
                  if (selectedType) params.type = selectedType;
                }
              }
              if (kind === 'deleteJob') params.name = editingJobName;
              for (const field of actions[kind]?.fields || []) {
                if (field === 'coordinates') {
                  const values = String(f.get(field) || '').trim()
                    .replace(/^(?:vector3|vec3)\s*\(/i, '').replace(/\)$/, '')
                    .split(/[\s,]+/).map(Number);
                  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
                    setMessage('Koordinatı X, Y, Z şeklinde girin.');
                    notify('Koordinatı X, Y, Z şeklinde girin.', 'error');
                    return;
                  }
                  [params.x, params.y, params.z] = values;
                } else params[field] = ['name', 'model'].includes(field)
                    ? String(f.get(field))
                    : Number(f.get(field));
              }
              if (['addMoney', 'removeMoney'].includes(kind))
                params.account = account;
              setBusy(true);
              try {
                const queued = await onAction({
                  type: kind,
                  target,
                  value: kind === 'message'
                    ? String(f.get('message'))
                    : `Panel işlemi: ${actions[kind]?.label || kind}`,
                  params,
                });
                const id = (queued as { id?: string } | undefined)?.id;
                if (live && id) {
                  let completed = false;
                  for (let attempt = 0; attempt < 120; attempt++) {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    const response = await fetch(`/api/commands/${encodeURIComponent(id)}`);
                    if (!response.ok) throw Error('İşlem sonucu alınamadı.');
                    const result = await response.json() as { status: string; result?: string };
                    if (result.status === 'completed') { completed = true; break; }
                    if (['failed', 'cancelled', 'expired'].includes(result.status))
                      throw Error(result.result || 'İşlem uygulanamadı.');
                  }
                  if (!completed) throw Error('İşlem sonucu beklenirken süre doldu. İşlem kayıtlarını kontrol edin.');
                }
                setMessage('İşlem uygulandı.');
                notify('İşlem uygulandı.', 'success');
                setOpen(false);
              } catch (e) {
                setMessage((e as Error).message);
                notify((e as Error).message, 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            {!focusTarget && !creating && <label>
              Oyuncu
              <Select
                value={target}
                disabled={!!focusTarget}
                onValueChange={(v) => setTarget(v || '')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {targetPlayers.find((p) => p.id === target)?.name ||
                      'Oyuncu seç'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {targetPlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      #{p.id} · {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>}
            {creating && <>
              <div className="group-create-basics">
                <label>İç kod <Input key={`${kind}:${editingJobName}`} name="groupName" defaultValue={kind === 'updateJob' ? editingJobName : ''} readOnly={kind === 'updateJob'} placeholder="ornek_meslek" maxLength={50} pattern="[a-z][a-z0-9_]{1,49}" required /></label>
                <label>Görünen ad <Input name="groupLabel" value={groupLabel} onChange={(event) => setGroupLabel(event.target.value)} placeholder={kind === 'createGang' ? 'Örnek Çete' : 'Örnek Meslek'} maxLength={50} required /></label>
              </div>
              {(kind === 'createJob' || kind === 'updateJob') && <div className="group-create-settings">
                <label>Meslek türü <Input name="jobType" value={jobType} onChange={(event) => setJobType(event.target.value)} placeholder="İsteğe bağlı · leo" maxLength={32} pattern="[a-z][a-z0-9_]{0,31}" /></label>
                <label className="group-setting-toggle" title="defaultDuty"><Checkbox checked={defaultDuty} onCheckedChange={(checked) => setDefaultDuty(checked === true)} /> Göreve başlarken aktif</label>
                <label className="group-setting-toggle" title="offDutyPay"><Checkbox checked={offDutyPay} onCheckedChange={(checked) => setOffDutyPay(checked === true)} /> Görev dışında maaş</label>
              </div>}
              <div className="group-grade-editor">
                <strong>Rütbeler <small>Sürükleyerek sıralayın; seviye otomatik belirlenir.</small></strong>
                {grades.map((grade, index) => <div className={`group-grade-row ${kind === 'createGang' ? 'is-gang' : 'is-job'}${activeGradeId === grade.id ? ' is-dragging' : ''}`} data-grade-id={grade.id} key={grade.id}
                    title="Kartı basılı tutup sürükleyerek sırala"
                    onPointerDown={(event) => {
                      if (event.pointerType === 'mouse' && event.button !== 0) return;
                      if ((event.target as HTMLElement).closest('input, button, [role="checkbox"], .group-grade-boss')) return;
                      event.preventDefault();
                      endGradeDrag();
                      const source = event.currentTarget;
                      const bounds = source.getBoundingClientRect();
                      const layer = document.createElement('div');
                      layer.className = 'group-create-dialog group-grade-drag-layer';
                      layer.setAttribute('aria-hidden', 'true');
                      layer.setAttribute('inert', '');
                      layer.style.setProperty('--section-color', getComputedStyle(source).getPropertyValue('--section-color'));
                      const preview = source.cloneNode(true) as HTMLElement;
                      preview.classList.remove('is-dragging');
                      preview.classList.add('group-grade-preview');
                      preview.removeAttribute('data-grade-id');
                      const inputs = source.querySelectorAll('input');
                      preview.querySelectorAll('input').forEach((input, index) => {
                        input.value = inputs[index].value;
                        input.checked = inputs[index].checked;
                      });
                      preview.style.width = `${bounds.width}px`;
                      preview.style.height = `${bounds.height}px`;
                      const offsetX = event.clientX - bounds.left;
                      const offsetY = event.clientY - bounds.top;
                      preview.style.transform = `translate3d(${event.clientX - offsetX}px, ${event.clientY - offsetY}px, 0)`;
                      layer.appendChild(preview);
                      document.body.appendChild(layer);
                      const pointerId = event.pointerId;
                      const move = (pointer: PointerEvent) => {
                        if (pointer.pointerId !== pointerId) return;
                        preview.style.transform = `translate3d(${pointer.clientX - offsetX}px, ${pointer.clientY - offsetY}px, 0)`;
                        const row = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest<HTMLElement>('[data-grade-id]');
                        const targetId = Number(row?.dataset.gradeId);
                        if (row && targetId !== grade.id) {
                          const sourceBounds = source.getBoundingClientRect();
                          const destination = row.getBoundingClientRect();
                          const midpoint = destination.top + destination.height / 2;
                          if (destination.top > sourceBounds.top ? pointer.clientY >= midpoint : pointer.clientY <= midpoint)
                            moveGrade(grade.id, targetId);
                        }
                      };
                      const stop = (pointer: PointerEvent) => {
                        if (pointer.pointerId === pointerId) endGradeDrag();
                      };
                      const blur = () => endGradeDrag();
                      window.addEventListener('pointermove', move);
                      window.addEventListener('pointerup', stop);
                      window.addEventListener('pointercancel', stop);
                      window.addEventListener('blur', blur);
                      draggedGrade.current = { id: grade.id, pointerId, layer, move, stop, blur };
                      setActiveGradeId(grade.id);
                    }}
                  >
                  <span className="group-grade-level" title="Otomatik seviye">{index}</span>
                  <label>Rütbe adı <Input value={grade.name} maxLength={50} onChange={(e) => setGrades((current) => current.map((row) => row.id === grade.id ? { ...row, name: e.target.value } : row))} required /></label>
                  {kind !== 'createGang' && <label>Maaş <Input className="group-payment-input" type="number" min={0} max={1000000} value={grade.payment} onChange={(e) => setGrades((current) => current.map((row) => row.id === grade.id ? { ...row, payment: Number(e.target.value) } : row))} required /></label>}
                  <label className="group-grade-boss"><Checkbox checked={grade.isboss} onCheckedChange={(checked) => setGrades((current) => current.map((row) => row.id === grade.id ? { ...row, isboss: checked === true } : row))} /> Yönetici</label>
                  {grades.length > 1 && <Button type="button" variant="outline" size="icon" aria-label={`${grade.name || `Rütbe ${index}`} sil`} title="Rütbeyi sil" onClick={() => setGrades((current) => current.filter((row) => row.id !== grade.id))}><Trash2 size={16} /></Button>}
                </div>)}
                <Button type="button" variant="outline" disabled={grades.length >= 20} onClick={() => setGrades((current) => [...current, { id: nextGradeId.current++, name: '', payment: 0, isboss: false }])}>Rütbe ekle</Button>
              </div>
            </>}
            {(actions[kind]?.fields || []).map((field) => (
              <label key={kind + field}>
                {names[field]}
                <Input
                  name={field}
                  type={['name', 'model', 'coordinates'].includes(field) ? 'text' : 'number'}
                  placeholder={field === 'coordinates' ? '123.45, -456.78, 28.90' : undefined}
                  required
                />
              </label>
            ))}
            {['addMoney', 'removeMoney'].includes(kind) && (
              <label>
                Hesap
                <Select
                  value={account}
                  onValueChange={(v) => setAccount(v || 'cash')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Nakit</SelectItem>
                    <SelectItem value="bank">Banka</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            )}
            {kind === 'message' && <label>
              Mesaj
              <Input name="message" maxLength={300} required />
            </label>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{creating ? 'Vazgeç' : 'Hayır'}</Button>
              <Button type="submit" variant={kind === 'deleteJob' ? 'destructive' : 'default'} disabled={busy || (!creating && kind !== 'deleteJob' && !target)}>
                {busy ? 'Gönderiliyor…' : kind === 'deleteJob' ? 'Mesleği sil' : kind === 'updateJob' ? 'Değişiklikleri kaydet' : creating ? (kind === 'createJob' ? 'Mesleği ekle' : 'Çeteyi ekle') : 'Evet'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
