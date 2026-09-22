import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

export type BlipSprite = { id: number; name: string; asset: string };
export type BlipColor = { code: string; id: number; name: string; hex: string };
export type BlipCatalog = { source: string; sprites: BlipSprite[]; colors: BlipColor[] };

const PAGE_SIZE = 50;

export function MapBlipPicker({ catalog, x, y, onClose, onSave, onPreview, initial, title = 'Blip ekle', submitLabel = 'Haritaya ekle' }: {
  catalog: BlipCatalog;
  x: number;
  y: number;
  onClose: () => void;
  onSave: (sprite: number, colorCode: string, label: string, size: number) => Promise<void>;
  onPreview: (sprite: number | null, colorCode: string, label: string, size: number) => void;
  initial?: { sprite: number; colorCode: string; label: string; size?: number };
  title?: string;
  submitLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [sprite, setSprite] = useState<BlipSprite | null>(() => initial ? catalog.sprites.find((item) => item.id === initial.sprite) || null : null);
  const [colorCode, setColorCode] = useState(initial?.colorCode || '0');
  const [label, setLabel] = useState(initial?.label || '');
  const [size, setSize] = useState(initial?.size ?? 1);
  const [busy, setBusy] = useState(false);

  const choices = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search ? catalog.sprites.filter((item) => item.name.toLowerCase().includes(search) || String(item.id).includes(search)) : catalog.sprites;
  }, [catalog.sprites, query]);

  const selectedColor = catalog.colors.find((color) => color.code === colorCode);

  return <dialog open className="map-blip-picker" aria-label={title}>
    <div className="map-blip-picker-head">
      <div>
        <strong>{title}</strong>
        <small>X {x.toFixed(1)} · Y {y.toFixed(1)}</small>
      </div>
      <button type="button" aria-label="Kapat" onClick={onClose}><X size={17} /></button>
    </div>

    <div className="relative mb-3">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" size={16} />
      <Input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} placeholder="Blip ara..." className="pl-9" />
    </div>

    <div className="map-blip-sprites" onScroll={(event) => {
      const element = event.currentTarget;
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - 100) setLimit((value) => Math.min(value + PAGE_SIZE, choices.length));
    }}>
      {choices.slice(0, limit).map((item) => <button key={item.id} type="button" className="map-blip-choice" aria-pressed={sprite?.id === item.id} title={`${item.name} · #${item.id}`} onClick={() => { setSprite(item); onPreview(item.id, colorCode, label, size); }}>
        {/* oxlint-disable-next-line next/no-img-element -- GIF preview must remain animated. */}
        <img src={item.asset} alt="" loading="lazy" />
        <span>#{item.id}</span>
        <small>{item.name.replace(/^radar_/, '')}</small>
      </button>)}

      {!choices.length && <p className="map-blip-no-results">Eşleşen blip yok.</p>}
    </div>

    <div className="map-blip-picker-count">{Math.min(limit, choices.length)} / {choices.length} blip · kaydırarak devam et</div>

    <label className="map-blip-picker-label" htmlFor="map-blip-label">Haritada görünecek isim</label>
    <Input id="map-blip-label" maxLength={60} value={label} onChange={(event) => { setLabel(event.target.value); onPreview(sprite?.id ?? null, colorCode, event.target.value, size); }} placeholder="Örn. Toplanma noktası" />

    <span className="map-blip-picker-label">Renk · {selectedColor?.code} {selectedColor?.name}</span>

    <fieldset className="map-blip-colors" aria-label="Blip renkleri">
      {catalog.colors.map((color) => <button key={color.code} type="button" className="map-blip-color" aria-pressed={colorCode === color.code} title={`${color.code} · ${color.name}`} aria-label={`${color.code} · ${color.name}`} onClick={() => { setColorCode(color.code); onPreview(sprite?.id ?? null, color.code, label, size); }}>
        <span style={{ backgroundColor: color.hex }} />
        <small>{color.code}</small>
      </button>)}
    </fieldset>

    <label className="map-blip-picker-label" htmlFor="map-blip-size">Boyut · {size.toFixed(1)}×</label>
    <input id="map-blip-size" className="map-blip-size" type="range" min="0.5" max="3" step="0.1" value={size} onChange={(event) => { const next = Number(event.target.value); setSize(next); onPreview(sprite?.id ?? null, colorCode, label, next); }} />
    <div className="map-blip-size-labels"><span>0.5×</span><span>3.0×</span></div>

    <div className="map-blip-picker-actions">
      <span>
        {sprite ? <>
          {/* oxlint-disable-next-line next/no-img-element -- GIF preview must remain animated. */}
          <img src={sprite.asset} alt="" /> #{sprite.id}
        </> : 'Blip seçilmedi'}
      </span>

      <Button type="button" disabled={!sprite || !label.trim() || busy} onClick={async () => {
        if (!sprite) return;
        setBusy(true);
        try {
          await onSave(sprite.id, colorCode, label.trim(), size);
        } catch {
          /* Parent shows the error. */
        } finally {
          setBusy(false);
        }
      }}>{busy ? 'Kaydediliyor…' : submitLabel}</Button>
    </div>
  </dialog>;
}
