import { randomUUID } from 'node:crypto';
import {
  tenantFor,
  primaryTenant,
  permissionRecord,
  cleanPermissions,
  activeTenant,
} from './tenancy.mjs';
const fail = (message, status = 400) =>
  Object.assign(Error(message), { status });
const DAY = 86400_000;
export function workspaceData(db, user) {
  const primary = primaryTenant(db, user.username);
  const workspaces = db
    .prepare(
      `SELECT t.id,t.name FROM tenants t JOIN panel_memberships m ON m.tenant_id=t.id WHERE m.username=?`,
    )
    .all(user.username);
  return {
    workspaceId: tenantFor(db, user).id,
    workspaces: [
      { id: primary.id, name: primary.name, personal: true },
      ...workspaces
        .filter((w) => w.id !== primary.id)
        .map((w) => ({ ...w, personal: false })),
    ],
    invitations: db
      .prepare(
        `SELECT i.id,t.name AS workspaceName,i.created_by AS invitedBy,i.expires FROM panel_invitations i JOIN tenants t ON t.id=i.tenant_id JOIN user_emails e ON e.email=i.email WHERE e.username=? AND e.verified>0 AND i.status='pending' AND i.expires>?`,
      )
      .all(user.username, Date.now()),
  };
}
export function teamMembers(db, user) {
  const tenant = tenantFor(db, user);
  return db
    .prepare(`SELECT u.username,u.role,0 AS invited FROM users u JOIN user_tenants ut ON ut.username=u.username WHERE ut.tenant_id=? AND u.role!='owner'
    UNION SELECT u.username,u.role,1 AS invited FROM users u JOIN panel_memberships m ON m.username=u.username WHERE m.tenant_id=? AND u.username NOT IN (SELECT username FROM user_tenants WHERE tenant_id=?)`)
    .all(tenant.id, tenant.id, tenant.id)
    .map((u) => ({
      username: u.username,
      invited: !!u.invited,
      ...permissionRecord(db, { ...u, workspaceId: tenant.id }),
    }));
}
export function createPanelInvitations(db, { audit }) {
  function manager(user) {
    const tenant = tenantFor(db, user);
    if (
      user.role === 'owner' ||
      !activeTenant(tenant) ||
      !permissionRecord(db, user).manager ||
      !JSON.parse(tenant.features).includes('team')
    )
      throw fail('Bu işlem için etkin panel sahibi yetkisi gerekli.', 403);
    return tenant;
  }
  return {
    list(user) {
      const tenant = manager(user);
      return db
        .prepare(
          `SELECT id,email,status,created,expires,accepted_by AS acceptedBy FROM panel_invitations WHERE tenant_id=? ORDER BY created DESC LIMIT 100`,
        )
        .all(tenant.id)
        .map((i) => ({
          ...i,
          status:
            ['pending', 'sending'].includes(i.status) && i.expires <= Date.now()
              ? 'expired'
              : i.status,
        }));
    },
    send(user, b) {
      const tenant = manager(user);
      const email =
        typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
      if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))
        throw fail('Geçerli bir e-posta adresi gir.');
      const recipient = db
        .prepare(
          'SELECT u.username,u.role FROM users u JOIN user_emails e ON e.username=u.username WHERE e.email=?',
        )
        .get(email);
      if (
        recipient &&
        (recipient.role === 'owner' ||
          recipient.username === user.username ||
          primaryTenant(db, recipient.username)?.id === tenant.id ||
          db
            .prepare(
              'SELECT 1 FROM panel_memberships WHERE username=? AND tenant_id=?',
            )
            .get(recipient.username, tenant.id))
      )
        throw fail('Bu hesap zaten panel üyesi veya davet edilemez.', 409);
      if (
        db
          .prepare(
            'SELECT COUNT(*) AS n FROM panel_invitations WHERE tenant_id=? AND created>?',
          )
          .get(tenant.id, Date.now() - 3600_000).n >= 20
      )
        throw fail('Saatlik davet sınırına ulaşıldı.', 429);
      db.prepare(
        "UPDATE panel_invitations SET status='expired' WHERE status IN ('pending','sending') AND expires<=?",
      ).run(Date.now());
      if (
        db
          .prepare(
            "SELECT id FROM panel_invitations WHERE tenant_id=? AND email=? AND status IN ('sending','pending')",
          )
          .get(tenant.id, email)
      )
        throw fail('Bu adres için bekleyen bir davet var.', 409);
      const id = randomUUID();
      db.prepare(
        'INSERT INTO panel_invitations(id,tenant_id,email,created_by,status,created,expires) VALUES(?,?,?,?,?,?,?)',
      ).run(
        id,
        tenant.id,
        email,
        user.username,
        'pending',
        Date.now(),
        Date.now() + 7 * DAY,
      );
      audit(
        user.username,
        'tenant:' + tenant.id,
        'Panel daveti oluşturuldu: ' + email,
      );
      return { id };
    },
    respond(user, b) {
      if (!['accept', 'reject'].includes(b.action))
        throw fail('Davet işlemi geçersiz.');
      const invitation = db
        .prepare(
          `SELECT i.* FROM panel_invitations i JOIN user_emails e ON e.email=i.email WHERE i.id=? AND e.username=? AND e.verified>0 AND i.status='pending' AND i.expires>?`,
        )
        .get(b.id, user.username, Date.now());
      if (!invitation || user.role === 'owner')
        throw fail('Davet bulunamadı veya süresi dolmuş.', 404);
      if (
        b.action === 'accept' &&
        !activeTenant(
          db
            .prepare('SELECT * FROM tenants WHERE id=?')
            .get(invitation.tenant_id),
        )
      )
        throw fail('Davet eden panel şu anda etkin değil.', 409);
      if (
        b.action === 'accept' &&
        db
          .prepare(
            'SELECT 1 FROM panel_memberships WHERE username=? AND tenant_id=?',
          )
          .get(user.username, invitation.tenant_id)
      )
        throw fail('Bu panelde zaten üyeliğin var.', 409);
      if (
        b.action === 'accept' &&
        primaryTenant(db, user.username)?.id === invitation.tenant_id
      )
        throw fail('Bu panelde zaten hesabın var.', 409);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (b.action === 'accept') {
          db.prepare(
            'INSERT INTO panel_memberships(username,tenant_id,permissions) VALUES(?,?,?)',
          ).run(user.username, invitation.tenant_id, '[]');
          db.prepare(
            'INSERT INTO selected_workspaces VALUES(?,?) ON CONFLICT(username) DO UPDATE SET tenant_id=excluded.tenant_id',
          ).run(user.username, invitation.tenant_id);
        }
        db.prepare(
          'UPDATE panel_invitations SET status=?,accepted_by=? WHERE id=?',
        ).run(
          b.action === 'accept' ? 'accepted' : 'rejected',
          b.action === 'accept' ? user.username : null,
          b.id,
        );
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      audit(
        user.username,
        'tenant:' + invitation.tenant_id,
        b.action === 'accept'
          ? 'Panel daveti kabul edildi'
          : 'Panel daveti reddedildi',
      );
      return { ok: true };
    },
    revoke(user, b) {
      const tenant = manager(user);
      const invite = db
        .prepare('SELECT * FROM panel_invitations WHERE id=? AND tenant_id=?')
        .get(b.id, tenant.id);
      if (!invite) throw fail('Davet bulunamadı.', 404);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (invite.accepted_by) {
          db.prepare(
            'DELETE FROM panel_memberships WHERE username=? AND tenant_id=?',
          ).run(invite.accepted_by, tenant.id);
          db.prepare(
            'DELETE FROM selected_workspaces WHERE username=? AND tenant_id=?',
          ).run(invite.accepted_by, tenant.id);
          // Revoke all accepted invitations for this membership; old entries cannot revoke a later re-invitation.
          db.prepare(
            "UPDATE panel_invitations SET status='revoked',accepted_by=NULL WHERE tenant_id=? AND accepted_by=?",
          ).run(tenant.id, invite.accepted_by);
        }
        db.prepare(
          "UPDATE panel_invitations SET status='revoked',accepted_by=NULL WHERE id=?",
        ).run(b.id);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      audit(
        user.username,
        'tenant:' + tenant.id,
        'Davet / üye erişimi kaldırıldı: ' + invite.email,
      );
      return { ok: true };
    },
    removeMember(user, b) {
      const tenant = manager(user);
      if (
        !db
          .prepare(
            'SELECT 1 FROM panel_memberships WHERE username=? AND tenant_id=?',
          )
          .get(b.username, tenant.id)
      )
        throw fail('Davetli üye bulunamadı.', 404);
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(
          'DELETE FROM panel_memberships WHERE username=? AND tenant_id=?',
        ).run(b.username, tenant.id);
        db.prepare(
          'DELETE FROM selected_workspaces WHERE username=? AND tenant_id=?',
        ).run(b.username, tenant.id);
        db.prepare(
          "UPDATE panel_invitations SET status='revoked',accepted_by=NULL WHERE tenant_id=? AND accepted_by=?",
        ).run(tenant.id, b.username);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      audit(
        user.username,
        'tenant:' + tenant.id,
        'Davetli üye panelden çıkarıldı: ' + b.username,
      );
      return { ok: true };
    },
    switchWorkspace(user, b) {
      if (user.role === 'owner') throw fail('Müşteri hesabı gerekli.',403);
      if (!workspaceData(db, user).workspaces.some((w) => w.id === b.id))
        throw fail('Bu panele erişimin yok.', 403);
      db.prepare(
        'INSERT INTO selected_workspaces VALUES(?,?) ON CONFLICT(username) DO UPDATE SET tenant_id=excluded.tenant_id',
      ).run(user.username, b.id);
      return { ok: true };
    },
    updateMember(user, b) {
      if (typeof b.username !== 'string') throw fail('Kullanıcı adı gerekli.');
      const tenant = tenantFor(db, user);
      if (
        !db
          .prepare(
            'SELECT 1 FROM panel_memberships WHERE username=? AND tenant_id=?',
          )
          .get(b.username, tenant.id)
      )
        return false;
      manager(user);
      if (b.password)
        throw fail('Davetli üyenin parolasını değiştiremezsin.', 403);
      const role = b.roleId
        ? db
            .prepare('SELECT id FROM team_roles WHERE id=? AND tenant_id=?')
            .get(b.roleId, tenant.id)
        : null;
      if (b.roleId && !role) throw fail('Rol bulunamadı.', 404);
      const permissions = cleanPermissions(tenant, b.permissions);
      db.prepare(
        'UPDATE panel_memberships SET permissions=?,role_id=? WHERE username=? AND tenant_id=?',
      ).run(
        JSON.stringify(permissions),
        role?.id || null,
        b.username,
        tenant.id,
      );
      audit(
        user.username,
        'tenant:' + tenant.id,
        'Davetli üye yetkileri güncellendi: ' + b.username,
      );
      return true;
    },
  };
}
