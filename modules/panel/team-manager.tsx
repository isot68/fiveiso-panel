import { TeamInvitations } from './team-invitations';
'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { notify } from '@/components/ui/toast-center';

type Role = { id: string; name: string; permissions: string[] };
type Member = { invited?: boolean; username: string; manager: boolean; permissions: string[]; roleId?: string | null; roleName?: string | null };
type Props = {
  request: (path: string, body?: unknown) => Promise<unknown>;
  onSaved: () => Promise<void>;
  options: Record<string, string>;
  users: Member[];
  roles: Role[];
  manager: boolean;
  currentUser: string;
};

function PermissionPicker({ options, value, onChange }: {
  options: Record<string, string>;
  value: string[];
  onChange: (permissions: string[]) => void;
}) {
  const keys = Object.keys(options);
  return <>
    <label className="flex items-center gap-2 font-medium">
      <Checkbox checked={keys.length > 0 && keys.every((key) => value.includes(key))}
        onCheckedChange={(checked) => onChange(checked ? [...keys] : [])} />
      Tüm yetkiler
      <span className="text-xs text-muted-foreground font-normal">({keys.filter((key) => value.includes(key)).length}/{keys.length})</span>
    </label>
    <div className="feature-grid">
      {Object.entries(options).map(([key, label]) => <label className="flex gap-2 items-center" key={key}>
        <Checkbox checked={value.includes(key)} onCheckedChange={(checked) => onChange(checked ? [...value, key] : value.filter((item) => item !== key))} />
        {label}
      </label>)}
    </div>
  </>;
}

export function TeamManager({ request, onSaved, options, users, roles, manager, currentUser }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState('');
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [inviteRoleId, setInviteRoleId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [busy, setBusy] = useState(false);
  const editing = users.some((member) => member.username === username);
  const invitedMember = users.find(member => member.username === username)?.invited;

  function selectMember(member?: Member) {
    setUsername(member?.username || '');
    setPassword('');
    setPermissions(member?.permissions || []);
    setRoleId(member?.roleId || null);
  }
  function selectRole(role?: Role) {
    setEditingRoleId(role?.id || null);
    setRoleName(role?.name || '');
    setRolePermissions(role?.permissions || []);
  }

  return <div className="p-5 border-b space-y-7">
    {manager && <TeamInvitations request={request} onSaved={onSaved} />}
    {manager && <section className="space-y-4">
      <div>
        <h3 className="font-semibold">Roller</h3>
        <p className="text-sm text-muted-foreground">Rolün yetkileri değiştiğinde bu rolü taşıyan üyelerin erişimi de güncellenir.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={editingRoleId === null ? 'default' : 'outline'} onClick={() => selectRole()}>Yeni rol</Button>
        {roles.map((role) => <Button type="button" variant={editingRoleId === role.id ? 'default' : 'outline'} key={role.id} onClick={() => selectRole(role)}>{role.name}</Button>)}
      </div>
      <form className="grid gap-4" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true);
        try {
          const result = await request('/team/roles', { id: editingRoleId, name: roleName, permissions: rolePermissions }) as { id: string };
          setEditingRoleId(result.id);
          notify('Rol kaydedildi.', 'success');
          await onSaved();
        } catch (error) { notify((error as Error).message, 'error'); }
        finally { setBusy(false); }
      }}>
        <Input aria-label="Rol adı" placeholder="Rol adı" value={roleName} onChange={(event) => setRoleName(event.target.value)} required minLength={2} maxLength={50} />
        <PermissionPicker options={options} value={rolePermissions} onChange={setRolePermissions} />
        <div><Button type="submit" disabled={busy}>{busy ? 'Kaydediliyor…' : editingRoleId ? 'Rolü güncelle' : 'Rol oluştur'}</Button></div>
      </form>
    </section>}

    {manager && roles.length > 0 && <section className="space-y-4 border-t border-white/10 pt-6">
      <div>
        <h3 className="font-semibold">Discord ile kayıt daveti</h3>
        <p className="text-sm text-muted-foreground">Tek kullanımlık bağlantı 7 gün geçerlidir. Kaydolan üyeye seçtiğin rol atanır.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => <Button type="button" variant={inviteRoleId === role.id ? 'default' : 'outline'} key={role.id} onClick={() => { setInviteRoleId(role.id); setInviteLink(''); }}>{role.name}</Button>)}
      </div>
      <Button type="button" disabled={!inviteRoleId || busy} onClick={async () => {
        setBusy(true);
        try {
          const result = await request('/team/discord-invites', { roleId: inviteRoleId }) as { invite: string };
          const link = new URL(window.location.hostname === 'panel.fiveiso.com' ? '/' : '/panel', window.location.origin);
          link.searchParams.set('invite', result.invite);
          setInviteLink(link.href);
          notify('Discord daveti oluşturuldu.', 'success');
        } catch (error) { notify((error as Error).message, 'error'); }
        finally { setBusy(false); }
      }}>Davet bağlantısı oluştur</Button>
      {inviteLink && <div className="flex flex-wrap gap-2 items-center">
        <Input aria-label="Discord davet bağlantısı" value={inviteLink} readOnly className="min-w-0 flex-1" />
        <Button type="button" variant="outline" onClick={async () => { await navigator.clipboard.writeText(inviteLink); notify('Bağlantı kopyalandı.', 'success'); }}>Kopyala</Button>
      </div>}
    </section>}

    <section className="space-y-4 border-t border-white/10 pt-6">
      <h3 className="font-semibold">Panel üyeleri</h3>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={!editing ? 'default' : 'outline'} onClick={() => selectMember()}>Yeni hesap</Button>
        {users.filter((member) => !member.manager && member.username !== currentUser).map((member) => (
          <Button type="button" variant={username === member.username ? 'default' : 'outline'} key={member.username} onClick={() => selectMember(member)}>{member.username}</Button>
        ))}
      </div>
      <form className="grid gap-4" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true);
        try {
          await request('/team/users', { username, password, permissions, roleId });
          notify('Panel üyesi kaydedildi.', 'success');
          await onSaved();
        } catch (error) { notify((error as Error).message, 'error'); }
        finally { setBusy(false); }
      }}>
        <div className="grid md:grid-cols-2 gap-3">
          <Input value={username} onChange={(event) => setUsername(event.target.value)} readOnly={editing} aria-label="Kullanıcı adı" placeholder="Kullanıcı adı" required pattern="[a-zA-Z0-9_.-]{3,40}" />
          {!invitedMember && <Input value={password} onChange={(event) => setPassword(event.target.value)} aria-label="Yeni parola" placeholder={editing ? 'Yeni parola (değişmeyecekse boş)' : 'Parola (en az 12 karakter)'} type="password" minLength={12} required={!editing} autoComplete="new-password" />}
        </div>
        {manager && roles.length > 0 && <div className="space-y-2">
          <span className="text-sm font-medium">Üye rolü</span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={roleId === null ? 'default' : 'outline'} onClick={() => setRoleId(null)}>Özel yetkiler</Button>
            {roles.map((role) => <Button type="button" variant={roleId === role.id ? 'default' : 'outline'} key={role.id} onClick={() => setRoleId(role.id)}>{role.name}</Button>)}
          </div>
        </div>}
        {roleId ? <p className="text-sm text-muted-foreground">{roles.find((role) => role.id === roleId)?.name} rolünün yetkileri uygulanacak.</p>
          : <PermissionPicker options={options} value={permissions} onChange={setPermissions} />}
        <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Üyeyi kaydet'}</Button>{invitedMember && manager && <Button type="button" variant="destructive" disabled={busy} onClick={async()=>{setBusy(true);try{await request('/team/members/remove',{username});selectMember();await onSaved();notify('Üyenin panel erişimi kaldırıldı.','success');}catch(e){notify((e as Error).message,'error');}finally{setBusy(false);}}}>Panelden çıkar</Button>}</div>
      </form>
    </section>
  </div>;
}
