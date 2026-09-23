'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- SVG map markers require SVG role attributes. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, MapPinPlus, Minus, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import { GameTools } from './game-tools';
import { ScreenViewer } from './screen-viewer';
import { MapBlipPicker, type BlipCatalog } from './map-blip-picker';
import { notify } from '@/components/ui/toast-center';
import './map-blip-picker.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Action, Server } from '@/lib/panel-types';
// Draw one stitched image to avoid SVG subpixel seams between map tiles.
const mapImage = new URL('../../map/minimap-stitched.webp', import.meta.url).href;
const mapBounds = { left: -4140, top: 8400, tileSize: 4500 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 32;
const BASE_SCALE = 600 / (mapBounds.tileSize * 3);
const PAN_OVERFLOW = 96;

function clampMapCenter(position: { x: number; y: number }, zoom: number) {
  const scale = BASE_SCALE * zoom;
  const halfWidth = (400 - PAN_OVERFLOW) / scale;
  const halfHeight = (300 - PAN_OVERFLOW) / scale;
  const right = mapBounds.left + mapBounds.tileSize * 2;
  const bottom = mapBounds.top - mapBounds.tileSize * 3;
  const minX = mapBounds.left + halfWidth;
  const maxX = right - halfWidth;
  const minY = bottom + halfHeight;
  const maxY = mapBounds.top - halfHeight;
  return {
    x: minX > maxX
      ? Math.max((mapBounds.left + right) / 2 - PAN_OVERFLOW / scale, Math.min((mapBounds.left + right) / 2 + PAN_OVERFLOW / scale, position.x))
      : Math.max(minX, Math.min(maxX, position.x)),
    y: minY > maxY
      ? Math.max((bottom + mapBounds.top) / 2 - PAN_OVERFLOW / scale, Math.min((bottom + mapBounds.top) / 2 + PAN_OVERFLOW / scale, position.y))
      : Math.max(minY, Math.min(maxY, position.y)),
  };
}

function blipColorMatrix(hex: string) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  return [...channels.map((channel) => [0.2126, 0.7152, 0.0722, 0, 0].map((weight) => weight * channel).join(' ')), '0 0 0 1 0'].join(' ');
}
function blipMenuLeft(clientX: number, picker: boolean) {
  const width = picker ? 380 : 180;
  const gap = picker ? 48 : 10;
  if (clientX + gap + width <= window.innerWidth - 8) return clientX + gap;
  if (clientX - gap - width >= 8) return clientX - gap - width;
  return Math.max(8, Math.min(clientX + 10, window.innerWidth - width - 8));
}
function playerMenuLeft(clientX: number, count: number) {
  const columns = Math.ceil(count / 6);
  const width = Math.min(window.innerWidth - 16, columns * 170 + (columns - 1) * 5);
  if (clientX + 10 + width <= window.innerWidth - 8) return clientX + 10;
  if (clientX - 10 - width >= 8) return clientX - 10 - width;
  return Math.max(8, window.innerWidth - width - 8);
}
function tooltipPosition(clientX: number, clientY: number) {
  return {
    left: Math.max(8, Math.min(clientX + 14, window.innerWidth - 248)),
    top: Math.max(8, Math.min(clientY + 14, window.innerHeight - 76)),
  };
}

type Location = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  bucket?: number;
};
type MapBlip = { id: string; sprite: number; colorCode: string; label: string; x: number; y: number; size?: number };
type MapContext = { x: number; y: number; clientX: number; clientY: number; picker: boolean };
type BlipContext = { id: string; clientX: number; clientY: number; mode: 'menu' | 'edit' };
type PlayerContext = { ids: string[]; clientX: number; clientY: number };
type MapTooltip = { label: string; detail?: string; clientX: number; clientY: number };
export function LocationMap({
  locations,
  server,
  serverId,
  canWatch = false,
  live,
  canAction,
  allowed,
  onAction,
  onModerate,
  request,
}: {
  locations: Record<string, unknown>[];
  server?: Server;
  serverId?: string;
  canWatch?: boolean;
  live: boolean;
  canAction: (action: string) => boolean;
  allowed: (feature: string) => boolean;
  onAction: (action: Action) => Promise<unknown>;
  onModerate: (action: Action) => void;
  request: <T = unknown>(path: string, body?: unknown) => Promise<T>;
}) {
  const points = useMemo(() => locations.filter((p) =>
    [p.x, p.y, p.z].every((x) => typeof x === 'number' && Number.isFinite(x)),
  ) as Location[], [locations]);
  const [zoom, setZoom] = useState(1);
  const [watching, setWatching] = useState<{id: string; name: string} | null>(null);
  const [catalog, setCatalog] = useState<BlipCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [blips, setBlips] = useState<MapBlip[]>([]);
  const [blipPreview, setBlipPreview] = useState<MapBlip | null>(null);
  const [context, setContext] = useState<MapContext | null>(null);
  const [blipContext, setBlipContext] = useState<BlipContext | null>(null);
  const [playerContext, setPlayerContext] = useState<PlayerContext | null>(null);
  const [tooltip, setTooltip] = useState<MapTooltip | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const spritesById = useMemo(() => new Map(catalog?.sprites.map((entry) => [entry.id, entry]) || []), [catalog]);
  const colorsByCode = useMemo(() => new Map(catalog?.colors.map((entry) => [entry.code, entry]) || []), [catalog]);
  const requestRef = useRef(request);
  useEffect(() => { requestRef.current = request; });
  useEffect(() => {
    let active = true;
    fetch('/assets/blips/catalog.json?v=webp').then((response) => {
      if (!response.ok) throw Error('Blip kataloğu yüklenemedi.');
      return response.json() as Promise<BlipCatalog>;
    }).then((data) => { if (active) setCatalog(data); }).catch((error) => {
      if (active) setCatalogError((error as Error).message);
    });
    return () => { active = false; };
  }, [catalogRetry]);
  useEffect(() => {
    if (!serverId || !live) return;
    let active = true;
    const load = async () => {
      try {
        const result = await requestRef.current<{ blips: MapBlip[] }>(`/servers/${encodeURIComponent(serverId)}/map-blips`);
        if (active) setBlips(result.blips);
      } catch (error) { if (active) notify((error as Error).message, 'error'); }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => { active = false; clearInterval(timer); };
  }, [serverId, live]);
  useEffect(() => {
    if (!context && !blipContext && !playerContext) return;

    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setContext(null);
      setBlipContext(null);
      setPlayerContext(null);
      setBlipPreview(null);
      setTooltip(null);
    };

    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [context, blipContext, playerContext]);
  useEffect(() => {
    if (!watching || (canWatch && points.some((point) => point.id === watching.id))) return;
    const timer = window.setTimeout(() => setWatching(null), 0);
    return () => window.clearTimeout(timer);
  }, [canWatch, points, watching]);
  const [selected, setSelected] = useState<string>('');
  const [position, setPosition] = useState({ x: 360, y: 1650 });
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; centerX: number; centerY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const focus = points.find((p) => p.id === selected);
  const center = clampMapCenter(focus || position, zoom);
  const scale = BASE_SCALE * zoom;
  const changeZoom = (nextZoom: number) => {
    setPosition(clampMapCenter(center, nextZoom));
    setSelected('');
    setZoom(nextZoom);
  };
  const toMapPoint = (clientX: number, clientY: number) => {
    const matrix = svgRef.current?.getScreenCTM();
    return matrix ? new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse()) : null;
  };
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (drag.current) return;
      const point = toMapPoint(event.clientX, event.clientY);
      if (!point) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1);
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.002)));
      if (nextZoom === zoom) return;
      const nextScale = BASE_SCALE * nextZoom;
      setPosition(clampMapCenter({
        x: center.x + (point.x - 400) * (1 / scale - 1 / nextScale),
        y: center.y - (point.y - 300) * (1 / scale - 1 / nextScale),
      }, nextZoom));
      setSelected('');
      setZoom(nextZoom);
    };
    const contextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (!serverId || !live) return;
      setPlayerContext(null);
      setTooltip(null);

      const target = event.target as Element | null;
      const blipElement = target?.closest('[data-map-blip-id]');
      const blipId = blipElement?.getAttribute('data-map-blip-id');

      if (blipId && blips.some((blip) => blip.id === blipId)) {
        setContext(null);
        setBlipPreview(null);
        setBlipContext({ id: blipId, clientX: event.clientX, clientY: event.clientY, mode: 'menu' });
        return;
      }

      const point = toMapPoint(event.clientX, event.clientY);
      if (!point) return;

      const x = center.x + (point.x - 400) / scale;
      const y = center.y - (point.y - 300) / scale;

      if (x < mapBounds.left || x > mapBounds.left + mapBounds.tileSize * 2 || y > mapBounds.top || y < mapBounds.top - mapBounds.tileSize * 3) return;

      setBlipContext(null);
      setBlipPreview(null);
      setContext({ x, y, clientX: event.clientX, clientY: event.clientY, picker: false });
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    svg.addEventListener('contextmenu', contextMenu);
    return () => { svg.removeEventListener('wheel', wheel); svg.removeEventListener('contextmenu', contextMenu); };
  }, [zoom, center.x, center.y, scale, serverId, live, blips]);
  const project = (p: { x: number; y: number }) => ({
    x: 400 + (p.x - center.x) * scale,
    y: 300 - (p.y - center.y) * scale,
  });
  function moveTooltip(clientX: number, clientY: number) {
    if (!tooltipRef.current) return;
    const next = tooltipPosition(clientX, clientY);
    tooltipRef.current.style.left = `${next.left}px`;
    tooltipRef.current.style.top = `${next.top}px`;
  }
  function clickPlayer(player: Location, clientX: number, clientY: number) {
    setTooltip(null);
    const target = project(player);
    const nearby = points.filter((candidate) => {
      const point = project(candidate);
      return Math.hypot(point.x - target.x, point.y - target.y) <= 24;
    }).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    if (nearby.length === 1) { openPlayer(player); return; }
    setContext(null);
    setBlipContext(null);
    setPlayerContext({ ids: nearby.map((entry) => entry.id), clientX, clientY });
  }
  function openPlayer(player: Location) {
    setContext(null);
    setBlipContext(null);
    setPlayerContext(null);
    setTooltip(null);
    setSelected(player.id);
    setWatching({ id: player.id, name: player.name });
  }
  async function addBlip(sprite: number, colorCode: string, label: string, size: number) {
    if (!serverId || !context) return;

    try {
      const added = await request<{ id: string }>(`/servers/${encodeURIComponent(serverId)}/map-blips`, { op: 'add', sprite, colorCode, label, size, x: context.x, y: context.y });

      setBlips((current) => [...current, { id: added.id, sprite, colorCode, label, size, x: context.x, y: context.y }]);
      setContext(null);
      setBlipPreview(null);
      notify('Blip haritaya eklendi.', 'success');
    } catch (error) {
      notify((error as Error).message, 'error');
      throw error;
    }
  }
  async function editBlip(id: string, sprite: number, colorCode: string, label: string, size: number) {
    if (!serverId) return;

    try {
      await request(`/servers/${encodeURIComponent(serverId)}/map-blips`, { op: 'update', id, sprite, colorCode, label, size });

      setBlips((current) => current.map((entry) => entry.id === id ? { ...entry, sprite, colorCode, label, size } : entry));
      setBlipContext(null);
      setBlipPreview(null);
      notify('Blip güncellendi.', 'success');
    } catch (error) {
      notify((error as Error).message, 'error');
      throw error;
    }
  }
  async function removeBlip(id: string) {
    if (!serverId) return;

    try {
      await request(`/servers/${encodeURIComponent(serverId)}/map-blips`, { op: 'delete', id });

      setBlips((current) => current.filter((entry) => entry.id !== id));
      setBlipContext(null);
      setBlipPreview(null);
      notify('Blip kaldırıldı.', 'success');
    } catch (error) {
      notify((error as Error).message, 'error');
    }
  }
  const contextBlip = blipContext ? blips.find((entry) => entry.id === blipContext.id) : null;
  const visiblePreview = context?.picker && blipPreview?.id === '__preview__'
    ? blipPreview
    : blipContext?.mode === 'edit' && blipPreview?.id === blipContext.id ? blipPreview : null;
  const displayedBlips = visiblePreview
    ? [...blips.filter((entry) => entry.id !== visiblePreview.id), visiblePreview]
    : blips;
  const nearbyPlayers = playerContext?.ids.map((id) => points.find((point) => point.id === id)).filter((point): point is Location => Boolean(point)) || [];
  return (
    <section className="glass-panel mb-5">
      <div className="section-heading">
        <div>
          <h2>Canlı koordinat haritası</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="map-zoom-button"
            aria-label="Uzaklaştır"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => changeZoom(Math.max(MIN_ZOOM, zoom / 1.5))}
          >
            <Minus size={22} strokeWidth={2.7} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="map-zoom-button"
            aria-label="Yakınlaştır"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => changeZoom(Math.min(MAX_ZOOM, zoom * 1.5))}
          >
            <Plus size={22} strokeWidth={2.7} />
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setZoom(1);
              setSelected('');
              setPosition({ x: 360, y: 1650 });
            }}
          >
            Sıfırla
          </Button>
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 800 600"
        className="w-full max-h-[650px] bg-[#0b1625a8]"
        style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
        onPointerDown={(event) => {
          if (event.button !== 0 || drag.current) return;
          const point = toMapPoint(event.clientX, event.clientY);
          if (!point) return;
          suppressClick.current = false;
          drag.current = { id: event.pointerId, x: point.x, y: point.y, centerX: center.x, centerY: center.y, moved: false };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId) return;
          const point = toMapPoint(event.clientX, event.clientY);
          if (!point) return;
          const dx = point.x - start.x;
          const dy = point.y - start.y;
          if (!start.moved && Math.hypot(dx, dy) < 3) return;
          start.moved = true;
          suppressClick.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          setSelected('');
          setPosition(clampMapCenter({ x: start.centerX - dx / scale, y: start.centerY + dy / scale }, zoom));
        }}
        onPointerUp={(event) => {
          if (drag.current?.id !== event.pointerId) return;
          drag.current = null;
          setDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
        onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
        onPointerLeave={() => { if (!drag.current?.moved) drag.current = null; }}
        role="group"
        aria-label="Oyuncuların dünya koordinatları"
      >
        <image
          href={mapImage}
          x={400 + (mapBounds.left - center.x) * scale}
          y={300 - (mapBounds.top - center.y) * scale}
          width={mapBounds.tileSize * 2 * scale}
          height={mapBounds.tileSize * 3 * scale}
          preserveAspectRatio="none"
        />
        <defs>
          {displayedBlips.map((blip) => {
            const color = colorsByCode.get(blip.colorCode);
            return <filter key={blip.id} id={`map-blip-tint-${blip.id}`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={blipColorMatrix(color?.hex || '#ffffff')} />
            </filter>;
          })}
        </defs>
        {displayedBlips.map((blip) => {
          const sprite = spritesById.get(blip.sprite);
          if (!sprite) return null;
          const point = project(blip);
          const iconSize = 24 * (blip.size ?? 1);
          if (point.x < -iconSize || point.x > 800 + iconSize || point.y < -iconSize || point.y > 600 + iconSize) return null;
          return <g
            key={blip.id}
            data-map-blip-id={blip.id === '__preview__' ? undefined : blip.id}
            role="button"
            tabIndex={blip.id === '__preview__' ? -1 : 0}
            aria-label={`${blip.label}, blip ${blip.sprite}`}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerEnter={(event) => {
              if (blip.id !== '__preview__') setTooltip({ label: blip.label, detail: `${sprite.name} · Blip #${blip.sprite}`, clientX: event.clientX, clientY: event.clientY });
            }}
            onPointerMove={(event) => moveTooltip(event.clientX, event.clientY)}
            onPointerLeave={() => setTooltip(null)}
            style={{ cursor: blip.id === '__preview__' ? 'default' : 'pointer', pointerEvents: blip.id === '__preview__' ? 'none' : undefined }}
          >
            <circle cx={point.x} cy={point.y} r={Math.max(17, iconSize / 2 + 5)} fill="transparent" pointerEvents="all" />
            <image href={sprite.asset} x={point.x - iconSize / 2} y={point.y - iconSize / 2} width={iconSize} height={iconSize} filter={`url(#map-blip-tint-${blip.id})`} pointerEvents="none" />
          </g>;
        })}
        {points.map((p) => {
          const c = project(p);
          if (c.x < 10 || c.x > 790 || c.y < 10 || c.y > 590) return null;
          return (
            <g
              key={p.id}
              role="button"
              tabIndex={0}
              aria-label={`#${p.id} ${p.name}`}
              onPointerDown={(event) => {
                event.stopPropagation();
                suppressClick.current = false;
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (suppressClick.current) return;
                clickPlayer(p, event.clientX, event.clientY);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  const marker = e.currentTarget.getBoundingClientRect();
                  clickPlayer(p, marker.right, marker.top);
                }
              }}
              onPointerEnter={(event) => setTooltip({ label: `#${p.id} ${p.name}`, clientX: event.clientX, clientY: event.clientY })}
              onPointerMove={(event) => moveTooltip(event.clientX, event.clientY)}
              onPointerLeave={() => setTooltip(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={c.x} cy={c.y} r={18} fill="transparent" pointerEvents="all" />
              <circle
                cx={c.x}
                cy={c.y}
                r={selected === p.id ? 10 : 6}
                fill="#ffffff"
                stroke="#000000"
                strokeWidth={1}
              />
              <text
                x={c.x}
                y={c.y}
                fill="#000000"
                fontSize={Math.min(selected === p.id ? 11 : 8, (selected === p.id ? 26 : 15) / String(p.id).length)}
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="central"
                pointerEvents="none"
                style={{ userSelect: 'none' }}
              >
                {p.id}
              </text>
            </g>
          );
        })}
      </svg>
      {tooltip && !context && !blipContext && !playerContext && createPortal(<div
        ref={tooltipRef}
        className="map-marker-tooltip"
        role="tooltip"
        style={tooltipPosition(tooltip.clientX, tooltip.clientY)}
      ><strong>{tooltip.label}</strong>{tooltip.detail && <span>{tooltip.detail}</span>}</div>, document.body)}
      {playerContext && nearbyPlayers.length > 0 && createPortal(<div className="map-blip-overlay">
        <button type="button" className="map-blip-backdrop" aria-label="Oyuncu listesini kapat" onClick={() => setPlayerContext(null)} />
        <div className="map-blip-anchor" style={{ left: playerMenuLeft(playerContext.clientX, nearbyPlayers.length), top: Math.max(8, Math.min(playerContext.clientY + 10, window.innerHeight - 300)) }}>
          <div className="map-player-menu" aria-label="Aynı konumdaki oyuncular" style={{ width: Math.min(window.innerWidth - 16, Math.ceil(nearbyPlayers.length / 6) * 170 + (Math.ceil(nearbyPlayers.length / 6) - 1) * 5) }}>
            <div className="map-player-grid">
              {nearbyPlayers.map((player) => <button key={player.id} type="button" onClick={() => openPlayer(player)} title={`${player.name} · #${player.id}`}>
                <span className="map-player-id">#{player.id}</span><span className="map-player-name">{player.name}</span>
              </button>)}
            </div>
          </div>
        </div>
      </div>, document.body)}
      {context && createPortal(<div className="map-blip-overlay">
        <button type="button" className="map-blip-backdrop" aria-label="Blip menüsünü kapat" onClick={() => { setContext(null); setBlipPreview(null); }} />
        <div className="map-blip-anchor" style={{ left: blipMenuLeft(context.clientX, context.picker), top: Math.max(8, Math.min(context.clientY + 10, window.innerHeight - (context.picker ? 700 : 60))) }}>
          {context.picker ? catalog ? <MapBlipPicker catalog={catalog} x={context.x} y={context.y} onClose={() => { setContext(null); setBlipPreview(null); }} onSave={addBlip} onPreview={(sprite, colorCode, label, size) => setBlipPreview(sprite === null ? null : { id: '__preview__', sprite, colorCode, label, size, x: context.x, y: context.y })} /> : catalogError ? <button type="button" className="map-blip-menu" onClick={() => { setCatalogError(null); setCatalogRetry((value) => value + 1); }}>{catalogError} Tekrar dene</button> : <div className="map-blip-menu">Blip kataloğu yükleniyor…</div>
            : <button type="button" className="map-blip-menu" onClick={() => setContext({ ...context, picker: true })}><MapPinPlus size={18} /><span>Blip ekle</span></button>}
        </div>
      </div>, document.body)}
      {focus && <div className="p-4 text-sm text-muted-foreground">
        {serverId && canWatch && <Button className="mb-3 mr-3" onClick={() => setWatching({ id: focus.id, name: focus.name })}>Canlı ekranı izle</Button>}
        <span>{focus.name} · X {focus.x.toFixed(2)} / Y {focus.y.toFixed(2)} / Z {focus.z.toFixed(2)} · Bucket {focus.bucket || 0}</span>
      </div>}
      {blipContext && contextBlip && createPortal(<div className="map-blip-overlay">
      <button type="button" className="map-blip-backdrop" aria-label="Blip menüsünü kapat" onClick={() => { setBlipContext(null); setBlipPreview(null); }} />

      <div
        className="map-blip-anchor"
        style={{
          left: blipMenuLeft(blipContext.clientX, blipContext.mode === 'edit'),
          top: Math.max(8, Math.min(blipContext.clientY + 10, window.innerHeight - (blipContext.mode === 'edit' ? 700 : 110))),
        }}
      >
        {blipContext.mode === 'edit' && !catalog ? (
          catalogError ? <button type="button" className="map-blip-menu" onClick={() => { setCatalogError(null); setCatalogRetry((value) => value + 1); }}>{catalogError} Tekrar dene</button> : <div className="map-blip-menu">Blip kataloğu yükleniyor…</div>
        ) : blipContext.mode === 'edit' && catalog ? (
          <MapBlipPicker
            key={contextBlip.id}
            catalog={catalog}
            x={contextBlip.x}
            y={contextBlip.y}
            title="Blip düzenle"
            submitLabel="Değişiklikleri kaydet"
            initial={{
              sprite: contextBlip.sprite,
              colorCode: contextBlip.colorCode,
              label: contextBlip.label,
              size: contextBlip.size ?? 1,
            }}
            onClose={() => { setBlipContext(null); setBlipPreview(null); }}
            onSave={(sprite, colorCode, label, size) => editBlip(contextBlip.id, sprite, colorCode, label, size)}
            onPreview={(sprite, colorCode, label, size) => setBlipPreview(sprite === null ? null : { ...contextBlip, sprite, colorCode, label, size })}
          />
        ) : (
          <div className="map-blip-context-menu">
            <button type="button" onClick={() => setBlipContext((current) => current ? { ...current, mode: 'edit' } : null)}>
              <Pencil size={17} />
              <span>Düzenle</span>
            </button>

            <button type="button" className="danger" onClick={() => void removeBlip(contextBlip.id)}>
              <Trash2 size={17} />
              <span>Sil</span>
            </button>
          </div>
        )}
      </div>
    </div>, document.body)}
      <Dialog open={watching !== null} onOpenChange={(open) => { if (!open) setWatching(null); }}>
        <DialogContent className="screen-watch-dialog w-[calc(100vw-2rem)] sm:max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{watching?.name} · Canlı oyuncu ekranı</DialogTitle>
            <DialogDescription>Sessiz canlı yayın. Pencereyi kapattığınızda izleme durur.</DialogDescription>
          </DialogHeader>
          {watching && serverId && canWatch ? (
            <div className="screen-watch-layout">
              <ScreenViewer key={`${serverId}:${watching.id}`} serverId={serverId} playerId={watching.id} name={watching.name} />
              <aside className="screen-action-sidebar" aria-label="İzlenen oyuncunun işlemleri">
                <h3>Oyuncu işlemleri</h3>
                <GameTools
                  key={`${serverId}:${watching.id}:actions`}
                  module="all"
                  compact
                  focusTarget={watching.id}
                  server={server}
                  live={live}
                  canAction={canAction}
                  allowed={allowed}
                  onAction={onAction}
                />
                {(canAction('kick') && allowed('players') || canAction('ban') && allowed('bans')) && <>
                  <h4 className="action-group-label">Moderasyon</h4>
                  <div className="action-tiles">
                    {canAction('kick') && allowed('players') && <Button
                      className="action-tile orange"
                      disabled={!server?.online}
                      onClick={() => onModerate({ type: 'kick', target: watching.id })}
                    ><ArrowUpRight />Uzaklaştır</Button>}
                    {canAction('ban') && allowed('bans') && <Button
                      className="action-tile red"
                      disabled={!server?.online}
                      onClick={() => onModerate({ type: 'ban', target: watching.id })}
                    ><Shield />Yasakla</Button>}
                  </div>
                </>}
              </aside>
            </div>
          ) : (
            <p role="alert">{!canWatch ? 'Canlı ekran için aktif panel lisansı ve canlı konumlar erişimi gereklidir.' : 'Sunucu bağlantısı bulunamadı.'}</p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
