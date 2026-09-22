export type Player = {
  id: string;
  name: string;
  ping: number;
  license?: string;
  steamHex?: string;
  discord?: string;
};
export type Resource = { name: string; state: string; version?: string };
export type Server = {
  metrics?: {
    cpuPercent: number;
    ramPercent: number;
    totalMemory: number;
    usedMemory: number;
    cores: number;
  };
  capabilities?: string[];
  targets?: { id: string; name: string }[];
  accounts?: Record<string, unknown>[];
  items?: Record<string, unknown>[];
  jobs?: Record<string, unknown>[];
  factions?: Record<string, unknown>[];
  vehicles?: Record<string, unknown>[];
  locations?: Record<string, unknown>[];
  economy?: Record<string, unknown>[];
  itemCatalog?: Record<string, unknown>[];
  id: string;
  name: string;
  region: string;
  framework: string;
  online: boolean;
  supervisorOnline?: boolean;
  processRunning?: boolean;
  lastSeen: number;
  players: Player[];
  resources: Resource[];
  maxPlayers: number;
  uptime: number;
  joinLocked?: boolean;
  history: { time: string; players: number }[];
};
export type Audit = {
  id: string;
  time: string;
  actor: string;
  serverId: string;
  action: string;
  status: string;
};
export type Ban = {
  id: string;
  serverId: string;
  license: string;
  reason: string;
  created: string;
};
export type PanelState = {
  features?: string[];
  permissions?: string[];
  manager?: boolean;
  permissionOptions?: Record<string, string>;
  roles?: { id: string; name: string; permissions: string[] }[];
  servers: Server[];
  audit: Audit[];
  bans: Ban[];
  users: { username: string; manager: boolean; permissions: string[]; roleId?: string | null; roleName?: string | null }[];
};
export type Action = {
  type: string;
  target?: string;
  value?: string;
  params?: Record<string, unknown>;
};
