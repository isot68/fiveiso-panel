import { workspaceData } from './panel-invitations.mjs';
import { tenantFor, activeTenant, permissionRecord, visibleFeatures } from './tenancy.mjs';

export function accountSummary(db, user) {
  if (user.role === 'owner') return null;
  const tenant = tenantFor(db, user);
  const serverCount = db
    .prepare('SELECT COUNT(*) AS count FROM server_tenants WHERE tenant_id=?')
    .get(tenant.id).count;
  // Registration grants only the account overview and settings. Package access
  // comes from the tenant, independently of an individual staff member's role.
  const hasPackage =
    serverCount > 0 ||
    JSON.parse(tenant.features).some(
      (key) => !['overview', 'settings'].includes(key),
    );
  const status = !tenant.enabled
    ? 'suspended'
    : !activeTenant(tenant)
      ? 'expired'
      : hasPackage
        ? 'active'
        : 'unconfigured';
  return {
    ...workspaceData(db, user),
    hasAccess: visibleFeatures(db, user).length > 0,
    username: user.username,
    role: user.role,
    manager: permissionRecord(db, user).manager,
    hasPackage,
    status,
    serverCount: visibleFeatures(db, user).length ? serverCount : 0,
    expires: tenant.expires,
    emailVerified: Boolean(
      db
        .prepare('SELECT verified FROM user_emails WHERE username=?')
        .get(user.username)?.verified,
    ),
    discordLinked: Boolean(
      db
        .prepare('SELECT username FROM discord_accounts WHERE username=?')
        .get(user.username),
    ),
  };
}
