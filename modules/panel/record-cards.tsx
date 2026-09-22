'use client';
import { RankCards } from './rank-cards';
import { ItemCatalog, type ItemFilter } from './item-catalog';
import { useEffect, useRef, useState } from 'react';
import {
  Package,
  Car,
  BriefcaseBusiness,
  Users,
  Fingerprint,
  Wallet,
} from 'lucide-react';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import type { PanelLayout } from './layout-toggle';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
const display = (v: unknown): string => typeof v === 'string' ? v : typeof v === 'number' ? v.toLocaleString('tr-TR') : '—';
const icons = {
  items: Package,
  vehicles: Car,
  jobs: BriefcaseBusiness,
  factions: Users,
  accounts: Fingerprint,
  economy: Wallet,
};
export function RecordCards({
  module,
  rows,
  columns,
  labels,
  allRows,
  itemFilter = 'all',
  serverId,
  layout,
  onEditJob,
  onDeleteJob,
}: {
  module: string;
  rows: Record<string, unknown>[];
  allRows?: Record<string, unknown>[];
  itemFilter?: ItemFilter;
  serverId: string;
  layout: PanelLayout;
  columns: string[];
  labels: Record<string, string>;
  onEditJob?: (name: string, rows: Record<string, unknown>[]) => void;
  onDeleteJob?: (name: string) => void;
}) {
  const [selected, setSelected] = useState<Record<string, unknown> | null>(
    null,
  );
  const [limit, setLimit] = useState(60);
  const loadMore = useRef<HTMLDivElement>(null);
  const Icon = icons[module as keyof typeof icons] || Package;
  const title = (r: Record<string, unknown>) =>
    display(r.label || r.name || r.plate || r.id || 'Kayıt');
  if (module === 'jobs' || module === 'factions') return <RankCards key={module} module={module} rows={rows} allRows={allRows || rows} layout={layout} onEditJob={onEditJob} onDeleteJob={onDeleteJob}/>;
  if (module === 'items') return <ItemCatalog items={rows} filter={itemFilter} serverId={serverId} layout={layout}/>;
  const listKey = rows.map((row) => String(row.id ?? row.name ?? row.plate ?? '')).join('|');
  useEffect(() => setLimit(60), [module, listKey]);
  useEffect(() => {
    const target = loadMore.current;
    if (!target || limit >= rows.length) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setLimit((count) => Math.min(count + 60, rows.length));
    }, { rootMargin: '300px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [limit, rows.length, listKey]);
  return (
    <>
      <div className={`record-grid layout-collection layout-${layout}`}>
        {rows.slice(0, limit).map((r, i) => (
          <article
            className="record-card clickable-card"
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(r)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelected(r);
              }
            }}
          >
            <header>
              <span className="record-symbol">
                <Icon size={23} />
              </span>
              <div>
                <h3>{title(r)}</h3>
                <p>
                  {display(r.name || r.model || r.identifier || 'Sunucu kaydı')}
                </p>
              </div>
            </header>
            <dl>
              {columns
                .filter((c) => c !== 'label' && c !== 'name')
                .slice(0, 4)
                .map((c) => (
                  <div key={c}>
                    <dt>{labels[c] || c}</dt>
                    <dd>{display(r[c] ?? '—')}</dd>
                  </div>
                ))}
            </dl>
          </article>
        ))}
      </div>
      <div ref={loadMore} className="py-4 text-center text-sm text-muted-foreground" role="status">
        {Math.min(limit, rows.length)} / {rows.length} kayıt{limit < rows.length ? ' · Aşağı kaydırdıkça yüklenir' : rows.length ? ' · Listenin sonu' : ''}
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {selected ? title(selected) : 'Kayıt detayı'}
          </DialogTitle>
          <DialogDescription>
            Sunucudan alınan güncel kayıt bilgileri.
          </DialogDescription>
          {selected &&
            columns.map((c) => (
              <div className="profile-field" key={c}>
                <span>{labels[c] || c}</span>
                <strong>{display(selected[c] ?? '—')}</strong>
              </div>
            ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
