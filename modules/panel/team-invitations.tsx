import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { notify } from '@/components/ui/toast-center';
type Invitation = {
  id: string;
  email: string;
  status: string;
  expires: number;
  acceptedBy: string | null;
};
const statuses: Record<string, string> = {
  sending: 'Gönderiliyor',
  pending: 'Onay bekliyor',
  accepted: 'Kabul edildi',
  rejected: 'Reddedildi',
  revoked: 'Kaldırıldı',
  expired: 'Süresi doldu',
  failed: 'Gönderilemedi',
};
export function TeamInvitations({
  request,
  onSaved,
}: {
  request: (path: string, body?: unknown) => Promise<unknown>;
  onSaved: () => Promise<void>;
}) {
  const [items, setItems] = useState<Invitation[]>([]),
    [email, setEmail] = useState(''),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    try {
      setItems((await request('/team/invitations')) as Invitation[]);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, []);
  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-semibold">E-posta ile panel daveti</h3>
        <p className="text-sm text-muted-foreground">
          Davet 7 gün geçerlidir. Kabul eden üye sıfır yetkiyle katılır;
          yetkilerini aşağıdan belirleyebilirsin.
        </p>
      </div>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await request('/team/invitations', { email });
            setEmail('');
            await load();
            notify('Davet e-postası gönderildi.', 'success');
          } catch (e) {
            notify((e as Error).message, 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Input
          type="email"
          aria-label="Davet edilecek e-posta"
          placeholder="E-posta adresi"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={254}
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={busy}>
          {busy ? 'Gönderiliyor…' : 'Davet gönder'}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">Davet geçmişi</span>
        <Button variant="ghost" disabled={busy} onClick={() => void load()}>
          Yenile
        </Button>
      </div>
      {!items.length && !error && (
        <p className="text-sm text-muted-foreground">
          Henüz bir davet gönderilmedi.
        </p>
      )}
      {items.map((i) => (
        <div
          key={i.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 p-3"
        >
          <div className="min-w-0">
            <strong className="text-sm break-all">{i.email}</strong>
            <p className="text-xs text-muted-foreground mt-1">
              {statuses[i.status] || i.status}
              {i.acceptedBy ? ' · ' + i.acceptedBy : ''}
            </p>
          </div>
          {['sending', 'pending', 'accepted'].includes(i.status) && (
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await request('/team/invitations/revoke', { id: i.id });
                  await load();
                  await onSaved();
                  notify('Davet ve panel erişimi kaldırıldı.', 'success');
                } catch (e) {
                  notify((e as Error).message, 'error');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {i.status === 'accepted' ? 'Erişimi kaldır' : 'Daveti iptal et'}
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}
