import { CarFront } from 'lucide-react';

const text = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '—';

export function OwnedVehicles({
  vehicles,
  loading = false,
}: {
  vehicles: Record<string, unknown>[];
  loading?: boolean;
}) {
  if (loading) return <div className="empty">Araçlar yükleniyor…</div>;
  if (!vehicles.length)
    return <div className="empty"><CarFront className="mx-auto mb-3" />Kayıtlı araç bulunamadı.</div>;
  return (
    <div className="record-grid owned-vehicle-grid layout-collection layout-grid">
      {vehicles.map((vehicle, index) => (
        <article className="record-card" key={`${text(vehicle.plate)}-${index}`}>
          <header>
            <span className="record-symbol"><CarFront size={23} /></span>
            <div><h3>{text(vehicle.plate)}</h3><p>{text(vehicle.model)}</p></div>
          </header>
          <dl>
            <div><dt>Plaka</dt><dd>{text(vehicle.plate)}</dd></div>
            <div><dt>Model</dt><dd>{text(vehicle.model)}</dd></div>
            <div><dt>Garaj</dt><dd>{text(vehicle.garage)}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}
