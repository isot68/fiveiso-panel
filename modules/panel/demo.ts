import type { PanelState } from '@/lib/panel-types';
const names = [
  'Arda Yılmaz',
  'Deniz Kaya',
  'Efe Demir',
  'Selin Aydın',
  'Mert Aslan',
  'Ali Çelik',
  'Duru Yıldız',
  'Bora Aksoy',
];
export const demoState: PanelState = {
  servers: ['Los Santos Roleplay', 'Istanbul Freeroam', 'Development'].map(
    (name, i) => ({
      id: `demo-${i}`,
      name,
      region: i === 1 ? 'İstanbul, TR' : 'Frankfurt, DE',
      framework: i === 1 ? 'Standalone' : 'QBCore',
      online: i !== 2,
      lastSeen: 0,
      maxPlayers: i === 0 ? 128 : 64,
      uptime: 176420,
      players:
        i === 2
          ? []
          : Array.from({ length: i === 0 ? 86 : 24 }, (_, j) => ({
              id: String(j + 1),
              name: names[j % 8] + (j > 7 ? ` ${j}` : ''),
              ping: 22 + ((j * 7) % 65),
            })),
      resources: [
        'qb-core',
        'oxmysql',
        'ox_inventory',
        'pma-voice',
        'qb-policejob',
        'qb-ambulancejob',
        'fiveiso-agent',
        'qb-housing',
      ].map((name, j) => ({
        name,
        state: j === 7 ? 'stopped' : 'started',
        version: j === 0 ? '1.3.0' : '1.0.0',
      })),
      history: Array.from({ length: 24 }, (_, j) => ({
        time: `${String(j).padStart(2, '0')}:00`,
        players:
          i === 2
            ? 0
            : Math.round((i === 0 ? 60 : 15) + Math.sin(j / 3) * 18 + j * 0.65),
      })),
    }),
  ),
  audit: [
    {
      id: '1',
      time: '2026-09-09T18:32:00Z',
      actor: 'Admin',
      serverId: 'demo-0',
      action: 'ox_inventory yeniden başlatıldı',
      status: 'completed',
    },
    {
      id: '2',
      time: '2026-09-09T18:28:00Z',
      actor: 'Sistem',
      serverId: 'demo-0',
      action: 'Ajan bağlantısı kuruldu',
      status: 'completed',
    },
    {
      id: '3',
      time: '2026-09-09T18:21:00Z',
      actor: 'Moderatör',
      serverId: 'demo-1',
      action: 'Oyuncu sunucudan uzaklaştırıldı',
      status: 'completed',
    },
  ],
  bans: [],
  users: [
    { username: 'Yönetici', manager: true, permissions: [] },
    { username: 'Ekip', manager: false, permissions: ['players', 'kick'] },
    { username: 'Gözlemci', manager: false, permissions: ['overview'] },
  ],
};
// Representative data belongs only to the explicit demo workspace.
for (const server of demoState.servers) {
  const jobNames = ['police', 'ambulance', 'mechanic', 'unemployed'];
  server.accounts = server.players.map((p, i) => ({
    id: p.id,
    name: p.name,
    identifier: 'DEMO' + String(i + 1).padStart(5, '0'),
    job: jobNames[i % 4],
    grade: i % 4,
    gang: i % 7 === 0 ? 'ballas' : 'none',
  }));
  server.economy = server.players.map((p, i) => ({
    id: p.id,
    name: p.name,
    cash: 450 + i * 120,
    bank: 18000 + i * 2100,
  }));
  server.items = server.players.flatMap((p) => [
    { id: p.id, name: 'phone', label: 'Telefon', amount: 1 },
    { id: p.id, name: 'water', label: 'Su', amount: 3 },
  ]);
  server.jobs = jobNames.flatMap((name, i) =>
    Array.from({ length: 3 }, (_, grade) => ({
      name,
      label: ['LSPD', 'EMS', 'Mekanik', 'Sivil'][i],
      grade,
      rank: ['Başlangıç', 'Kıdemli', 'Yönetici'][grade],
      salary: 100 + grade * 75,
    })),
  );
  server.factions = ['ballas', 'vagos', 'families'].flatMap((name) =>
    Array.from({ length: 3 }, (_, grade) => ({
      name,
      label: name[0].toUpperCase() + name.slice(1),
      grade,
      rank: ['Üye', 'Kıdemli', 'Lider'][grade],
    })),
  );
  server.vehicles = server.players
    .slice(0, 12)
    .map((p, i) => ({
      id: String(i + 1),
      model: ['sultan', 'baller', 'buffalo', 'blista'][i % 4],
      plate: 'NX ' + String(i + 1).padStart(4, '0'),
      owner: p.id,
    }));
  server.locations = server.players
    .slice(0, 20)
    .map((p, i) => ({
      id: p.id,
      name: p.name,
      x: 180 + i * 82,
      y: -1200 + i * 67,
      z: 32,
      bucket: 0,
    }));
}
