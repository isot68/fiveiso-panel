import { useState } from 'react';
import { Package } from 'lucide-react';
import './player-inventory.css';

type Item = Record<string, unknown>;
function imageFor(item: Item, serverId: string) {
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata as Item : {};
  for (const candidate of [metadata.image, item.image, item.name]) {
    if (typeof candidate !== 'string') continue;
    const name = candidate.split('/').pop()?.toLowerCase() || '';
    const file = name.endsWith('.png') ? name : name + '.png';
    if (file) return `/api/servers/${encodeURIComponent(serverId)}/inventory-images/${encodeURIComponent(file)}`;
  }
}

function ItemSlot({ item, slot, serverId }: { item?: Item; slot?: number; serverId: string }) {
  const src = item && imageFor(item, serverId);
  const [failedImage, setFailedImage] = useState<string>();
  const label = item ? String(item.label || item.name || 'Bilinmeyen item') : 'Boş slot';
  return (
    <article
      className={'inventory-slot' + (item ? ' occupied' : '')}
      aria-label={`${slot ? `Slot ${slot}: ` : ''}${label}`}
      title={item ? `${label}\n${String(item.name || '')}\nAdet: ${String(item.count ?? item.amount ?? 1)}` : label}
    >
      {slot !== undefined && <span className="inventory-slot-number">{slot}</span>}
      {item && <>
        <span className="inventory-slot-count">{String(item.count ?? item.amount ?? 1)}×</span>
        {src && failedImage !== src ? (
          <img src={src} alt={label} loading="lazy" draggable={false} onError={() => setFailedImage(src)} />
        ) : <Package className="inventory-slot-placeholder" aria-label="Görsel bulunamadı" />}
        <span className="inventory-slot-label">{label}</span>
      </>}
    </article>
  );
}

export function PlayerInventory({ items, serverId, note = 'Son bildirilen envanter · Salt okunur' }: { items: Item[]; serverId: string; note?: string }) {
  const hasSlots = items.length > 0 && items.every((item) => Number.isInteger(Number(item.slot)) && Number(item.slot) > 0 && Number(item.slot) <= 200)
    && new Set(items.map((item) => Number(item.slot))).size === items.length;
  const slotCount = hasSlots ? Math.ceil(Math.max(...items.map((item) => Number(item.slot))) / 5) * 5 : items.length;
  const bySlot = new Map(items.map((item) => [Number(item.slot), item]));
  return (
    <div className="inventory-view">
      <div className="inventory-heading"><strong>Oyuncu envanteri</strong><span>{items.length} item kaydı</span></div>
      {!items.length ? <p className="empty">Bu oyuncu için envanter kaydı bildirilmedi.</p> : <>
        <div className="inventory-slots">
          {Array.from({ length: slotCount }, (_, index) => (
            <ItemSlot key={index} slot={hasSlots ? index + 1 : undefined} item={hasSlots ? bySlot.get(index + 1) : items[index]} serverId={serverId} />
          ))}
        </div>
        <p className="inventory-note">{note}{!hasSlots && ' · Sunucu slot bilgisi göndermediği için itemler liste sırasıyla gösteriliyor.'}</p>
      </>}
    </div>
  );
}
