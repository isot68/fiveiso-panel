export const DB_FEATURES = {
  dbCharacters: 'accounts',
  dbBalances: 'economy',
  dbVehicles: 'vehicles',
  dbSetCharacter: 'accounts',
  dbSetProfile: 'accounts',
  dbSetBalance: 'accounts',
  dbSetGarage: 'vehicles',
  dbCharacterDetail: 'accounts',
  dbSetJob: 'accounts',
  dbSetGang: 'accounts',
  dbInventoryAdd: 'accounts',
  dbInventoryRemove: 'accounts',
};
export const DB_ACTIONS = Object.keys(DB_FEATURES);
export function validateDatabaseAction(a, s) {
  if (!DB_ACTIONS.includes(a.type)) return;
  if (!s.capabilities?.includes(a.type))
    throw Error(
      'Veritabanı adaptörü bu işlemi desteklemiyor veya güncel değil.',
    );
  const p = a.params;
  if (!p || typeof p !== 'object' || Array.isArray(p))
    throw Error('Geçersiz parametre.');
  const str = (v, max) =>
    typeof v === 'string' &&
    v.trim().length > 0 &&
    v.length <= max &&
    !/[\x00-\x1f]/.test(v);
  if (a.type === 'dbSetProfile') {
    if (
      !['name', 'gender', 'birthdate', 'nationality', 'phone'].includes(
        p.field,
      ) ||
      typeof p.expected !== 'string' ||
      p.expected.length > 320 ||
      !str(p.value, 100)
    )
      throw Error('Geçersiz karakter alanı.');
    if (p.field === 'name' && (!str(p.firstname, 40) || !str(p.lastname, 40)))
      throw Error('Ad ve soyad gerekli.');
    if (p.field === 'gender' && !['0', '1'].includes(p.value))
      throw Error('Geçersiz cinsiyet.');
    if (
      p.field === 'birthdate' &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(p.value) ||
        !Number.isFinite(Date.parse(p.value)) ||
        new Date(p.value).toISOString().slice(0, 10) !== p.value)
    )
      throw Error('Geçersiz doğum tarihi.');
    if (p.field === 'phone' && !/^[+\d ()-]{1,30}$/.test(p.value))
      throw Error('Geçersiz telefon.');
    if (p.field === 'nationality' && p.value.length > 60)
      throw Error('Uyruk çok uzun.');
  }
  if (
    a.type !== 'dbCharacters' &&
    a.type !== 'dbBalances' &&
    a.type !== 'dbVehicles'
  ) {
    if (!str(a.target, 100)) throw Error('Kayıt kimliği gerekli.');
    if (a.type !== 'dbCharacterDetail' && !str(a.value, 300))
      throw Error('İşlem kaydı açıklaması gerekli.');
    if (
      a.type === 'dbSetBalance' &&
      (!['bank', 'cash'].includes(p.account) ||
        !Number.isInteger(p.amount) ||
        p.amount < 0 ||
        p.amount > 100000000 ||
        !Number.isInteger(p.expected) ||
        p.expected < 0)
    )
      throw Error('Geçersiz bakiye.');
    if (
      a.type === 'dbSetCharacter' &&
      (!str(p.firstname, 40) || !str(p.lastname, 40) || !str(p.expected, 500))
    )
      throw Error('Ad, soyad veya önceki değer geçersiz.');
    if (
      a.type === 'dbSetGarage' &&
      (!str(p.garage, 50) ||
        typeof p.expected !== 'string' ||
        p.expected.length > 50)
    )
      throw Error('Geçersiz garaj.');
    if (
      ['dbSetJob', 'dbSetGang'].includes(a.type) &&
      (!str(p.name, 80) ||
        !/^[a-zA-Z0-9_.-]+$/.test(p.name) ||
        !Number.isInteger(p.grade) ||
        p.grade < 0 ||
        p.grade > 100 ||
        !str(p.expected, 500))
    )
      throw Error('Geçersiz meslek veya çete bilgisi.');
    if (
      ['dbInventoryAdd', 'dbInventoryRemove'].includes(a.type) &&
      (!str(p.name, 80) ||
        !/^[a-zA-Z0-9_.-]+$/.test(p.name) ||
        !Number.isInteger(p.amount) ||
        p.amount < 1 ||
        p.amount > 1000 ||
        typeof p.expected !== 'string' ||
        !/^[a-f0-9]{32}$/.test(p.expected))
    )
      throw Error('Geçersiz envanter işlemi.');
  } else if (
    typeof p.query !== 'string' ||
    p.query.length > 80 ||
    !Number.isInteger(p.page) ||
    p.page < 0 ||
    p.page > 10000
  )
    throw Error('Geçersiz arama.');
}
