'use client';
import { useState } from 'react';
import { Folder, Search, Play, Pause, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Action, Server } from '@/lib/panel-types';
import { LayoutToggle, type PanelLayout } from './layout-toggle';
export function ResourceWorkspace({
  server,
  canAction,
  onAction,
}: {
  server?: Server;
  canAction: (action: string) => boolean;
  onAction: (a: Action) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [layout, setLayout] = useState<PanelLayout>('grid');
  const resources = server?.resources || [];
  const rows = resources.filter(
    (r) =>
      r.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'all' || (filter === 'running') === (r.state === 'started')),
  );
  return (
    <section className="resource-workspace">
      <div className="directory-toolbar">
        <div className="search-box">
          <Search size={17} />
          <Input
            aria-label="Kaynak ara"
            placeholder="Kaynak adı ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {resources.length} kaynak
        </span>
        <LayoutToggle value={layout} onChange={setLayout} />
      </div>
      <div className="filter-chips mb-6">
        {[
          ['all', 'Tümü'],
          ['running', 'Çalışan'],
          ['stopped', 'Durdurulan'],
        ].map(([v, label]) => (
          <Button
            key={v}
            variant="ghost"
            aria-pressed={filter === v}
            onClick={() => setFilter(v)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className={`resource-grid layout-collection layout-${layout}`}>
        {rows.map((r) => (
          <article
            className={
              'resource-card ' + (r.state === 'started' ? 'running' : 'stopped')
            }
            key={r.name}
          >
            <Folder size={65} strokeWidth={1.2} />
            <h3>{r.name}</h3>
            <p>
              {r.version || 'Sürüm bildirilmedi'} ·{' '}
              {r.state === 'started' ? 'Çalışıyor' : r.state}
            </p>
            <div className="resource-controls">
              {(r.state === 'started' ? ['stop', 'restart'] : ['start']).filter(canAction).map(
                (type) => {
                  const Icon =
                    type === 'stop'
                      ? Pause
                      : type === 'restart'
                        ? RotateCw
                        : Play;
                  return (
                    <Button
                      key={type}
                      variant="ghost"
                      size="icon"
                      disabled={
                        !server?.online || r.name === 'fiveiso'
                      }
                      aria-label={
                        r.name +
                        ' ' +
                        (type === 'stop'
                          ? 'durdur'
                          : type === 'restart'
                            ? 'yeniden başlat'
                            : 'başlat')
                      }
                      title={
                        type === 'stop'
                          ? 'Durdur'
                          : type === 'restart'
                            ? 'Yeniden başlat'
                            : 'Başlat'
                      }
                      onClick={() => onAction({ type, target: r.name })}
                    >
                      <Icon size={17} />
                    </Button>
                  );
                },
              )}
            </div>
          </article>
        ))}
      </div>
      {!rows.length && <div className="empty">Kaynak bulunamadı.</div>}
    </section>
  );
}
