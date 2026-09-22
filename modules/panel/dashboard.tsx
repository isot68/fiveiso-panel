'use client';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Boxes,
  ChevronRight,
  Clock3,
  Globe2,
  Megaphone,
  Network,
  Shield,
  Terminal,
  Play,
  RotateCw,
  Square,
  Users,
} from 'lucide-react';
import type { PanelState, Server } from '@/lib/panel-types';
import { Progress } from '@/components/ui/progress';
import { PlayerChart } from './charts';
type Props = {
  data: PanelState;
  server?: Server;
  live: boolean;
  mayAct: boolean;
  onSelect: (id: string) => void;
  onNavigate: (page: string) => void;
  onAnnounce: () => void;
  onExport: () => void;
  canAction: (action: string) => boolean;
  onServerAction: (type: 'serverStart' | 'serverStop' | 'serverRestart') => void;
};
export function Dashboard({
  data,
  server,
  live,
  mayAct,
  onSelect,
  onNavigate,
  onAnnounce,
  onExport,
  canAction,
  onServerAction,
}: Props) {
  const players = server?.online ? server.players : [];
  const capacity = server?.maxPlayers || 0;
  const percent = capacity ? Math.round((players.length / capacity) * 100) : 0;
  const resources = server?.resources || [];
  const running = resources.filter((r) => r.state === 'started').length;
  const ping = players.length
    ? Math.round(players.reduce((n, p) => n + p.ping, 0) / players.length)
    : null;
  const active = data.servers.filter((s) => s.online).length;
  return (
    <div className="command-dashboard">
      <div className="command-grid">
        <div className="command-main">
          <div className="telemetry-grid">
            <section className="glass-panel occupancy-panel">
              <div className="panel-caption">
                <span>
                  <Users size={17} /> OYUNCU KAPASİTESİ
                </span>
                <span className="soft-tag">{live ? 'CANLI' : 'ÖRNEK'}</span>
              </div>
              <div className="occupancy-content">
                <div
                  className="occupancy-ring"
                  role="img"
                  aria-label={`${players.length} oyuncu, ${capacity} kapasite, yüzde ${percent} dolu`}
                >
                  <svg viewBox="0 0 180 180">
                    <circle className="ring-guide" cx="90" cy="90" r="82" />
                    <circle className="ring-track" cx="90" cy="90" r="68" />
                    <circle
                      className="ring-value"
                      cx="90"
                      cy="90"
                      r="68"
                      pathLength="100"
                      strokeDasharray={`${Math.min(100, percent)} 100`}
                    />
                  </svg>
                  <div>
                    <strong>{players.length}</strong>
                    <span>çevrimiçi oyuncu</span>
                  </div>
                </div>
                <div className="capacity-summary">
                  <span className="big-percentage">%{percent}</span>
                  <p>sunucu doluluğu</p>
                  <div className="capacity-facts">
                    <span>
                      Toplam kapasite <b>{capacity}</b>
                    </span>
                    <span>
                      Boş kontenjan{' '}
                      <b>{Math.max(0, capacity - players.length)}</b>
                    </span>
                  </div>
                  <span
                    className={`status-pill ${server?.online ? 'online' : 'offline'}`}
                  >
                    {server?.online ? 'Bağlantı aktif' : 'Ajan bekleniyor'}
                  </span>
                </div>
              </div>
              <div className="panel-bottom">
                <span>
                  <Globe2 size={13} />
                  {server?.region || 'Sunucu seçilmedi'}
                </span>
                <span>{server?.framework || '—'}</span>
              </div>
            </section>
            <section className="glass-panel network-panel">
              <div className="panel-caption">
                <span>
                  <Network size={17} /> MERKEZ DURUMU
                </span>
                <span className="connection-dot connected" />
              </div>
              <div className="network-number">
                {active}
                <span>/ {data.servers.length}</span>
              </div>
              <p className="text-muted-foreground text-sm">
                sunucu bağlantısı aktif
              </p>
              <div className="network-meter">
                {data.servers.map((s) => (
                  <span key={s.id} className={s.online ? 'lit' : ''} />
                ))}
              </div>
              <div className="network-metrics">
                <div>
                  <Activity size={16} />
                  <span>Makine CPU</span>
                  <b>
                    {server?.online && server.metrics
                      ? '%' + server.metrics.cpuPercent.toFixed(1)
                      : '—'}
                  </b>
                </div>
                <div>
                  <Boxes size={16} />
                  <span>Makine RAM</span>
                  <b>
                    {server?.online && server.metrics
                      ? '%' + server.metrics.ramPercent.toFixed(1)
                      : '—'}
                  </b>
                </div>
                <div>
                  <Activity size={16} />
                  <span>Ortalama ping</span>
                  <b>{ping === null ? '—' : `${ping} ms`}</b>
                </div>
                <div>
                  <Clock3 size={16} />
                  <span>Ajan çalışma süresi</span>
                  <b>
                    {server?.online
                      ? `${Math.floor(server.uptime / 3600)} sa`
                      : '—'}
                  </b>
                </div>
              </div>
            </section>
          </div>
          <div className="action-band">
            {canAction('serverStart') && <button
              className="dashboard-action cyan"
              disabled={!server?.supervisorOnline || server?.processRunning}
              onClick={() => onServerAction('serverStart')}
            >
              <span className="action-symbol"><Play size={25} /></span>
              <span><strong>Sunucuyu başlat</strong></span>
              <ArrowUpRight size={17} />
            </button>}
            {canAction('serverRestart') && <button
              className="dashboard-action violet"
              disabled={!server?.supervisorOnline || !server?.processRunning}
              onClick={() => onServerAction('serverRestart')}
            >
              <span className="action-symbol"><RotateCw size={25} /></span>
              <span><strong>Sunucuyu yeniden başlat</strong></span>
              <ArrowUpRight size={17} />
            </button>}
            {canAction('serverStop') && <button
              className="dashboard-action amber"
              disabled={!server?.supervisorOnline || !server?.processRunning}
              onClick={() => onServerAction('serverStop')}
            >
              <span className="action-symbol"><Square size={25} /></span>
              <span><strong>Sunucuyu durdur</strong></span>
              <ArrowUpRight size={17} />
            </button>}
            {mayAct && <button
              className="dashboard-action cyan"
              disabled={!server?.online}
              onClick={onAnnounce}
            >
              <span className="action-symbol">
                <Megaphone size={25} />
              </span>
              <span>
                <strong>Duyuru yayınla</strong>
              </span>
              <ArrowUpRight size={17} />
            </button>}
            <button
              className="dashboard-action violet"
              onClick={() => onNavigate('resources')}
            >
              <span className="action-symbol">
                <Boxes size={25} />
              </span>
              <span>
                <strong>Kaynak yönetimi</strong>
              </span>
              <ArrowUpRight size={17} />
            </button>
            <button
              className="dashboard-action amber"
              onClick={() => onNavigate('console')}
            >
              <span className="action-symbol">
                <Terminal size={25} />
              </span>
              <span>
                <strong>İşlem konsolu</strong>
              </span>
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="lower-telemetry">
            <section className="glass-panel chart-panel">
              <div className="section-heading">
                <div>
                  <h2>Oyuncu trafiği</h2>
                </div>
                <span className="chart-key">
                  <i /> Oyuncular
                </span>
              </div>
              {server?.history.length ? (
                <PlayerChart data={server.history} />
              ) : (
                <div className="empty">İlk ölçüm bekleniyor.</div>
              )}
            </section>
            <section className="glass-panel resource-summary">
              <div className="section-heading">
                <h2>Kaynak durumu</h2>
                <Boxes size={17} className="text-violet-300" />
              </div>
              <div className="resource-totals">
                <strong>
                  {running}
                  <small> / {resources.length}</small>
                </strong>
                <p>aktif kaynak</p>
                <Progress
                  value={
                    resources.length ? (running / resources.length) * 100 : 0
                  }
                />
              </div>
              <div className="resource-preview">
                {resources.slice(0, 4).map((r) => (
                  <div key={r.name}>
                    <span
                      className={
                        r.state === 'started'
                          ? 'connection-dot connected'
                          : 'connection-dot'
                      }
                    />
                    <span>{r.name}</span>
                    <small>{r.state === 'started' ? 'Aktif' : 'Durdu'}</small>
                  </div>
                ))}
              </div>
              <button
                className="panel-link"
                onClick={() => onNavigate('resources')}
              >
                Kaynakları incele <ChevronRight size={15} />
              </button>
            </section>
          </div>
          <section className="glass-panel recent-operations">
            <div className="section-heading">
              <div>
                <h2>Son işlemler</h2>
              </div>
              <button className="export-button" onClick={onExport}>
                <ArrowDownToLine size={15} />
                <span>Dışa aktar</span>
              </button>
            </div>
            {data.audit.slice(0, 3).map((a) => (
              <div className="activity-row" key={a.id}>
                <span className="activity-icon">
                  <Activity size={15} />
                </span>
                <span className="flex-1">
                  {a.action}
                  <small>
                    {a.actor} ·{' '}
                    {data.servers.find((s) => s.id === a.serverId)?.name}
                  </small>
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.time).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Istanbul',
                  })}
                </span>
              </div>
            ))}
            {!data.audit.length && (
              <div className="empty">Henüz işlem yok.</div>
            )}
          </section>
        </div>
        <aside className="glass-panel roster-panel">
          <div className="section-heading">
            <div>
              <h2>Çevrimiçi oyuncular</h2>
            </div>
            <span className="roster-count">{players.length}</span>
          </div>
          <div className="roster-subheading">
            <span>OYUNCU</span>
            <span>PING</span>
          </div>
          <div className="roster-list">
            {players.slice(0, 10).map((p, i) => (
              <button
                className="roster-player"
                key={p.id}
                onClick={() => onNavigate('players')}
              >
                <span className={`player-avatar tone-${i % 4}`}>
                  {p.name
                    .split(' ')
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')}
                </span>
                <span className="player-identity">
                  <strong>{p.name}</strong>
                  <small>Oyuncu #{p.id}</small>
                </span>
                <span className={`ping-value ${p.ping > 70 ? 'high' : ''}`}>
                  {p.ping}
                  <i>ms</i>
                </span>
              </button>
            ))}
            {!players.length && <div className="empty">Aktif oyuncu yok.</div>}
          </div>
          <button className="panel-link" onClick={() => onNavigate('players')}>
            Tüm oyuncuları yönet <ArrowUpRight size={15} />
          </button>
          <div className="moderation-note">
            <Shield size={20} />
            <span>
              Moderasyon merkezi<small>Uzaklaştırma ve yasak işlemleri</small>
            </span>
            <button
              aria-label="Yasaklamaları aç"
              onClick={() => onNavigate('bans')}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
