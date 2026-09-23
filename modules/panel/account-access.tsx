import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { Check, Mail, X, Layers } from 'lucide-react';
import type { CustomerAccount } from '@/lib/panel-types';
import { notify } from '@/components/ui/toast-center';
import './account-access.css';
type Props = {
  account: CustomerAccount;
  request: (path: string, body?: unknown) => Promise<unknown>;
  onSaved: () => Promise<void>;
};
export function AccountAccess({ account, request, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [invitationsOpen, setInvitationsOpen] = useState(false);
  async function run(path: string, body: unknown) {
    setBusy(true);
    try {
      await request(path, body);
      await onSaved();
      if (path === '/account/invitations/respond') setInvitationsOpen(false);
      notify('İşlem tamamlandı.', 'success');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-access" aria-label="Paneller ve davetler">
      <div className="account-workspace">
        <label htmlFor="account-workspace">
          <Layers size={17} /> Çalışma alanı
        </label>
        <select
          id="account-workspace"
          value={account.workspaceId}
          disabled={busy}
          onChange={(e) =>
            void run('/account/workspace', { id: e.target.value })
          }
        >
          {account.workspaces.map((w) => (
            <option value={w.id} key={w.id}>
              {w.name}
              {w.personal ? ' · Kendi panelim' : ' · Davetli üye'}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="account-invitations-trigger"
          onClick={() => setInvitationsOpen(true)}
        >
          <Mail size={17} /> Davetler <span>{account.invitations.length}</span>
        </button>
      </div>
      <Dialog open={invitationsOpen} onOpenChange={setInvitationsOpen}>
        <DialogContent className="account-invitation-dialog sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogTitle>Davetler</DialogTitle>
          <DialogDescription>
            Panellere katılma isteklerini buradan onaylayabilir veya
            reddedebilirsin. Davetler yalnızca panelde gösterilir.
          </DialogDescription>
          <div className="account-invitations">
            {account.invitations.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Bekleyen davetin yok.
              </p>
            )}
            {account.invitations.map((invite) => (
              <article key={invite.id}>
                <div>
                  <strong>{invite.workspaceName}</strong>
                  <p>
                    {invite.invitedBy} seni paneline davet etti. Kabul ettiğinde
                    yetkisiz üye olarak katılacaksın.
                  </p>
                  <small>
                    Son tarih:{' '}
                    {new Date(invite.expires).toLocaleDateString('tr-TR')}
                  </small>
                </div>
                <div className="account-invite-actions">
                  <button
                    disabled={busy}
                    className="accept"
                    onClick={() =>
                      void run('/account/invitations/respond', {
                        id: invite.id,
                        action: 'accept',
                      })
                    }
                  >
                    <Check size={15} /> Onayla
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run('/account/invitations/respond', {
                        id: invite.id,
                        action: 'reject',
                      })
                    }
                  >
                    <X size={15} /> Reddet
                  </button>
                </div>
              </article>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
