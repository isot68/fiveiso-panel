import { useEffect, useRef, useState } from 'react';
import { Package, Boxes, Crosshair, HeartPulse, UtensilsCrossed, GlassWater, Shapes } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import './player-inventory.css';
import type { PanelLayout } from './layout-toggle';
type Item = Record<string, unknown>;
const filters = [
  { id: 'all', label: 'Tüm eşyalar', icon: Boxes },
  { id: 'weapons', label: 'Silahlar ve mühimmat', icon: Crosshair },
  { id: 'health', label: 'Sağlık', icon: HeartPulse },
  { id: 'food', label: 'Yiyecekler', icon: UtensilsCrossed },
  { id: 'drinks', label: 'İçecekler', icon: GlassWater },
  { id: 'other', label: 'Diğer', icon: Shapes },
] as const;
function imageUrl(serverId: string, item: Item) {
  const candidate = String(item.image || item.name + '.png').split('/').pop() || '';
  return candidate ? `/api/servers/${encodeURIComponent(serverId)}/inventory-images/${encodeURIComponent(candidate)}` : '';
}
function ItemImage({ item, serverId }: { item: Item; serverId: string }) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl(serverId, item);
  return src && !failed ? <img src={src} alt={String(item.label)} loading="lazy" onError={() => setFailed(true)} className="h-20 w-20 object-contain mx-auto" /> : <Package className="h-20 w-20 mx-auto text-muted-foreground" aria-label="Görsel bulunamadı" />;
}
export type ItemFilter = (typeof filters)[number]['id'];
export function ItemCatalogFilters({ items, filter, onChange }: { items: Item[]; filter: ItemFilter; onChange: (filter: ItemFilter) => void }) {
  return <div className="item-catalog-toolbar" role="group" aria-label="Eşya filtreleri">
    {filters.map(({ id, label, icon: Icon }) => <button key={id} type="button" className="item-catalog-filter" aria-label={label} title={label} aria-pressed={filter === id} onClick={() => onChange(id)} disabled={id !== 'all' && !items.some((item) => item.group === id)}>
      <Icon size={21} strokeWidth={2.3} aria-hidden="true" />
    </button>)}
  </div>;
}
export function ItemCatalog({ items, filter, serverId, layout }: { items: Item[]; filter: ItemFilter; serverId: string; layout: PanelLayout }) {
  const [limit, setLimit] = useState(60);
  const sentinel = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const filteredItems = filter === 'all' ? items : items.filter((item) => item.group === filter);
  const listKey = `${filter}:${items.map((item) => item.name).join('|')}`;
  useEffect(() => setLimit(60), [listKey]);
  useEffect(() => {
    if (!sentinel.current || limit >= filteredItems.length) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setLimit((count) => Math.min(count + 60, filteredItems.length));
    }, { rootMargin: '300px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [limit, filteredItems.length, listKey]);
  return <>
    <div className={`item-catalog-grid layout-collection layout-${layout}`}>
      {filteredItems.slice(0, limit).map((item) => <button key={String(item.name)} className="record-card item-card text-center min-w-0" onClick={() => setSelected(item)}>
        <span className="item-card-media"><ItemImage item={item} serverId={serverId} /></span>
        <span className="item-card-identity"><strong>{String(item.label)}</strong><span>{String(item.name)}</span></span>
      </button>)}
    </div>
    <div ref={sentinel} className="py-5 text-center text-sm text-muted-foreground" role="status">
      {filteredItems.length ? `${Math.min(limit, filteredItems.length)} / ${filteredItems.length} eşya${limit < filteredItems.length ? ' · Aşağı kaydırdıkça yüklenir' : ' · Listenin sonu'}` : 'Bu filtrede eşya bulunamadı.'}
    </div>
    <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent>
      <DialogTitle>{String(selected?.label || 'Eşya detayı')}</DialogTitle><DialogDescription>Sunucunun ox_inventory eşya tanımı.</DialogDescription>
      {selected && <><ItemImage key={String(selected.name)} item={selected} serverId={serverId} />{[['Kod', selected.name], ['Ağırlık', `${selected.weight} g`], ['Üst üste eklenebilir', selected.stack ? 'Evet' : 'Hayır'], ['Açıklama', selected.description || '—']].map(([label, value]) => <div key={String(label)} className="profile-field"><span>{String(label)}</span><strong>{String(value)}</strong></div>)}</>}
    </DialogContent></Dialog>
  </>;
}
