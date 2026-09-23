'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Flag,
  IdCard,
  Pencil,
  Phone,
  UserRound,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { notify } from '@/components/ui/toast-center';
import type { Server } from '@/lib/panel-types';

type Data = Record<string, unknown>;
type Field =
  | 'name'
  | 'gender'
  | 'birthdate'
  | 'nationality'
  | 'phone'
  | 'job'
  | 'gang';
const labels: Record<Field, string> = {
  name: 'Karakter adı',
  gender: 'Cinsiyet',
  birthdate: 'Doğum tarihi',
  nationality: 'Uyruk',
  phone: 'Telefon numarası',
  job: 'Meslek',
  gang: 'Çete / grup',
};
const shown = (v: unknown) =>
  v === undefined || v === null || v === '' ? 'none' : String(v);
const date = (v: unknown) => {
  if (!v) return 'none';
  const raw = String(v);
  const parsed = new Date(typeof v === 'number' ? v : raw);
  return Number.isNaN(parsed.getTime())
    ? raw
    : parsed.toLocaleDateString('tr-TR');
};
function IdentityIcon({ kind }: { kind: 'discord' | 'steam' | 'license' }) {
  if (kind === 'discord')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M19.7 5.2a18 18 0 0 0-4.3-1.3l-.5 1a16 16 0 0 0-5.8 0l-.5-1a18 18 0 0 0-4.3 1.3C1.6 9.2.9 13 1.2 16.8a18 18 0 0 0 5.3 2.7l1.1-1.8-1.6-.8.4-.3a13.5 13.5 0 0 0 11.2 0l.4.3-1.6.8 1.1 1.8a18 18 0 0 0 5.3-2.7c.4-4.4-.8-8.2-3.1-11.6ZM8.4 14.6c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7.2 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"
        />
      </svg>
    );
  if (kind === 'steam')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="currentColor" opacity=".2" />
        <circle
          cx="16"
          cy="8"
          r="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="16" cy="8" r="2" fill="currentColor" />
        <path
          d="m13 11-5 5-6-3m7 5a3 3 0 1 1-6-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 19 8 4h7q5 0 3.5 5-1 3-4 3l2 7h-4l-2-6H9l-1.5 6ZM10 7l-.8 3h3q2 0 2.4-1.5T13 7Z"
        fill="currentColor"
      />
      <path
        d="m20 15 .8 2.2H23l-1.8 1.4.7 2.2-1.9-1.3-1.9 1.3.7-2.2-1.8-1.4h2.2Z"
        fill="currentColor"
      />
    </svg>
  );
}
function CopyValue({
  label,
  value,
  icon,
  account = false,
}: {
  label: string;
  value: unknown;
  icon: ReactNode;
  account?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div className="identity-field">
      <span>{label}</span>
      <div className="identity-value">
        {icon}
        <strong title={shown(value)}>{shown(value)}</strong>
        <button
          type="button"
          aria-label={`${label} kopyala`}
          title={copied ? 'Kopyalandı' : 'Kopyala'}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shown(value));
              setCopied(true);
            } catch {
              notify(
                'Kopyalanamadı. Tarayıcı pano iznini kontrol edin.',
                'error',
              );
            }
          }}
        >
          {copied ? <Check /> : account ? <ChevronRight /> : <Copy />}
        </button>
      </div>
    </div>
  );
}
export function ProfileDetails({
  data,
  server,
  onlineId,
  canAction,
  request,
  onUpdated,
}: {
  data: Data;
  server: Server;
  onlineId?: string;
  canAction: (action: string) => boolean;
  request: <T = unknown>(path: string, body?: unknown) => Promise<T>;
  onUpdated?: () => void;
}) {
  const [editing, setEditing] = useState<Field | null>(null),
    [saving, setSaving] = useState(false),
    [overrides, setOverrides] = useState<Data>({});
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const info = { ...data, ...overrides };
  const action = (field: Field) =>
    field === 'job'
      ? onlineId
        ? 'setJob'
        : 'dbSetJob'
      : field === 'gang'
        ? onlineId
          ? 'setGang'
          : 'dbSetGang'
        : 'dbSetProfile';
  const canEdit = (field: Field) =>
    server.online &&
    canAction(action(field)) &&
    !!server.capabilities?.includes(action(field));
  const editButton = (field: Field) => (
    <button
      type="button"
      className="profile-edit"
      aria-label={`${labels[field]} düzenle`}
      title={
        canEdit(field)
          ? `${labels[field]} düzenle`
          : 'Düzenleme yetkisi veya ajan desteği gerekli'
      }
      disabled={!canEdit(field)}
      onClick={() => setEditing(field)}
    >
      <Pencil size={17} />
    </button>
  );
  const field = (
    label: string,
    value: unknown,
    icon: ReactNode,
    key?: Field,
  ) => (
    <div className="detail-field">
      <span>{label}</span>
      <div className="detail-value">
        {icon}
        <strong>{shown(value)}</strong>
        {key && editButton(key)}
      </div>
    </div>
  );
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) || '').trim();
    const params: Data = {};
    const type = action(editing);
    if (editing === 'job' || editing === 'gang') {
      params.name = get('value');
      params.grade = Number(get('grade'));
      if (!onlineId) params.expected = info[editing + 'Version'];
    } else {
      params.field = editing;
      params.expected =
        editing === 'name'
          ? `${info.firstname || ''}|${info.lastname || ''}`
          : String(info[editing] ?? '');
      params.value = get('value');
      if (editing === 'name') {
        params.firstname = get('firstname');
        params.lastname = get('lastname');
        params.value = `${params.firstname} ${params.lastname}`;
      }
    }
    setSaving(true);
    try {
      const queued = await request<{ id: string }>(
        `/servers/${encodeURIComponent(server.id)}/actions`,
        {
          type,
          target:
            (editing === 'job' || editing === 'gang') && onlineId
              ? onlineId
              : String(info.identifier || ''),
          value: 'Karakter bilgi kartı düzenlemesi',
          params,
        },
      );
      let complete = false;
      for (let i = 0; i < 240 && mounted.current; i++) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (!mounted.current) return;
        const result = await request<{ status: string; result?: string }>(
          `/commands/${encodeURIComponent(queued.id)}`,
        );
        if (result.status === 'completed') {
          complete = true;
          break;
        }
        if (['failed', 'cancelled', 'expired'].includes(result.status))
          throw Error(result.result || 'İşlem uygulanamadı.');
      }
      if (!complete)
        throw Error('İşlem zaman aşımına uğradı. Kayıtları kontrol edin.');
      if (editing === 'name')
        setOverrides((p) => ({
          ...p,
          firstname: params.firstname,
          lastname: params.lastname,
          name: params.value,
        }));
      else if (editing === 'job' || editing === 'gang')
        setOverrides((p) => ({
          ...p,
          [editing]: params.name,
          [editing + 'Label']: params.name,
          [editing === 'job' ? 'grade' : 'gangGrade']: params.grade,
          [editing + 'GradeLabel']: params.grade,
        }));
      else setOverrides((p) => ({ ...p, [editing]: params.value }));
      setEditing(null);
      notify('Karakter bilgisi güncellendi.', 'success');
      onUpdated?.();
    } catch (error) {
      if (mounted.current) notify((error as Error).message, 'error');
    } finally {
      if (mounted.current) setSaving(false);
    }
  }
  const name =
    [info.firstname, info.lastname].filter(Boolean).join(' ') || info.name;
  const gender =
    info.gender === 0 || info.gender === '0' || info.gender === 'm'
      ? 'Erkek'
      : info.gender === 1 || info.gender === '1' || info.gender === 'f'
        ? 'Kadın'
        : shown(info.gender);
  const playtime =
    typeof info.playtime === 'number'
      ? `${Math.floor(info.playtime / 60)} sa ${Math.floor(info.playtime % 60)} dk`
      : shown(info.playtime);
  return (
    <>
      <div className="profile-panels profile-reference">
        <article className="profile-card identity-card">
          <img
            className="profile-decoration identity-decoration"
            src="/assets/profile/identity.webp"
            alt=""
          />
          <h3>Kimlik ve lisans</h3>
          <CopyValue
            label="Hesap ID"
            value={info.playerName}
            icon={<IdCard />}
            account
          />
          <CopyValue
            label="Discord ID"
            value={String(info.discord || '').replace(/^discord:/, '')}
            icon={<IdentityIcon kind="discord" />}
          />
          <CopyValue
            label="Steam Hex"
            value={info.steamHex}
            icon={<IdentityIcon kind="steam" />}
          />
          <CopyValue
            label="Rockstar lisansı"
            value={info.license}
            icon={<IdentityIcon kind="license" />}
          />
        </article>
        <article className="profile-card character-info-card">
          <img
            className="profile-decoration character-decoration"
            src="/assets/profile/character.webp"
            alt=""
          />
          <header>
            <h3>Karakter bilgileri</h3>
            <small>Oluşturulma · {date(info.createdAt)}</small>
          </header>
          {field('Karakter ID', info.identifier, <IdCard />)}
          {field('Karakter adı', name, <BadgeCheck />, 'name')}
          {field('Cinsiyet', gender, <UserRound />, 'gender')}
          {field(
            'Doğum tarihi',
            date(info.birthdate),
            <CalendarDays />,
            'birthdate',
          )}
          {field('Uyruk', info.nationality, <Flag />, 'nationality')}
          {field('Telefon numarası', info.phone, <Phone />, 'phone')}
          <div className="profile-time-row">
            {field('Oynama süresi', playtime, <Clock3 />)}
            {field(
              'Oluşturulma tarihi',
              date(info.createdAt),
              <CalendarDays />,
            )}
          </div>
        </article>
        <article className="profile-card career-card">
          <img
            className="profile-decoration career-decoration"
            src="/assets/profile/career.webp"
            alt=""
          />
          <h3>Meslek ve grup</h3>
          {field(
            'Meslek',
            `${shown(info.jobLabel || info.job)} · ${shown(info.jobGradeLabel ?? info.grade)}`,
            <BriefcaseBusiness />,
            'job',
          )}
          {field(
            'Çete / grup',
            `${shown(info.gangLabel || info.gang)} · ${shown(info.gangGradeLabel ?? info.gangGrade)}`,
            <UsersRound />,
            'gang',
          )}
        </article>
      </div>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{editing ? labels[editing] : ''} düzenle</DialogTitle>
          <DialogDescription>
            Değişiklik sunucuya uygulanır ve işlem kaydına eklenir.
          </DialogDescription>
          {editing && (
            <form key={editing} className="grid gap-4" onSubmit={submit}>
              {editing === 'name' ? (
                <>
                  <label>
                    Ad
                    <Input
                      name="firstname"
                      defaultValue={String(info.firstname || '')}
                      maxLength={40}
                      required
                    />
                  </label>
                  <label>
                    Soyad
                    <Input
                      name="lastname"
                      defaultValue={String(info.lastname || '')}
                      maxLength={40}
                      required
                    />
                  </label>
                </>
              ) : (
                <label>
                  {labels[editing]}
                  {editing === 'gender' ? (
                    <select
                      className="profile-gender-select"
                      name="value"
                      defaultValue={gender === 'Kadın' ? '1' : '0'}
                    >
                      <option value="0">Erkek</option>
                      <option value="1">Kadın</option>
                    </select>
                  ) : (
                    <Input
                      name="value"
                      type={editing === 'birthdate' ? 'date' : 'text'}
                      defaultValue={String(info[editing] ?? '')}
                      maxLength={editing === 'phone' ? 30 : 60}
                      required
                    />
                  )}
                </label>
              )}
              {(editing === 'job' || editing === 'gang') && (
                <label>
                  Rütbe
                  <Input
                    type="number"
                    name="grade"
                    defaultValue={Number(
                      info[editing === 'job' ? 'grade' : 'gangGrade'] || 0,
                    )}
                    min={0}
                    max={100}
                    required
                  />
                </label>
              )}
              <Button type="submit" disabled={saving}>
                <Check size={16} />
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
export function ProfileMoney({ cash, bank }: { cash: unknown; bank: unknown }) {
  return (
    <article className="profile-card money-card">
      <h3>
        <Wallet /> Para bilgileri
      </h3>
      {[
        ['Nakit', cash],
        ['Banka', bank],
      ].map(([label, value]) => (
        <div className="detail-field" key={String(label)}>
          <span>{String(label)}</span>
          <div className="detail-value">
            <Wallet />
            <strong>
              {value === undefined
                ? 'none'
                : Number(value).toLocaleString('tr-TR')}
            </strong>
          </div>
        </div>
      ))}
    </article>
  );
}
