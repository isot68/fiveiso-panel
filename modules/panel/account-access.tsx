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
  async function run(path: string, body: unknown) {
    setBusy(true);
    try {
      await request(path, body);
      await onSaved();
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
      </div>
      {account.invitations.length > 0 && (
        <div className="account-invitations">
          <h2>
            <Mail size={18} /> Bekleyen davetler{' '}
            <span>{account.invitations.length}</span>
          </h2>
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
      )}
    </section>
  );
}
