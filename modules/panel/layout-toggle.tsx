import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type PanelLayout = 'grid' | 'list';

export function LayoutToggle({ value, onChange }: { value: PanelLayout; onChange: (value: PanelLayout) => void }) {
  return (
    <div className="layout-toggle" role="group" aria-label="Görünüm biçimi">
      <Button type="button" variant="outline" size="icon" aria-label="Kart görünümü" aria-pressed={value === 'grid'} onClick={() => onChange('grid')}>
        <LayoutGrid size={20} strokeWidth={2.25} />
      </Button>
      <Button type="button" variant="outline" size="icon" aria-label="Liste görünümü" aria-pressed={value === 'list'} onClick={() => onChange('list')}>
        <List size={20} strokeWidth={2.25} />
      </Button>
    </div>
  );
}
