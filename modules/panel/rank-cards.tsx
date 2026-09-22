import { useState } from 'react';
import { Users, BriefcaseBusiness, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import type { PanelLayout } from './layout-toggle';
type Row = Record<string, unknown>;
export function RankCards({ module, rows, allRows, layout, onEditJob, onDeleteJob }: { module: string; rows: Row[]; allRows: Row[]; layout: PanelLayout; onEditJob?: (name: string, rows: Row[]) => void; onDeleteJob?: (name: string) => void }) {
  const [name, setName] = useState<string | null>(null);
  const faction = module === 'factions';
  const Icon = faction ? Users : BriefcaseBusiness;
  const names = [...new Set(rows.map((r) => String(r.name)))];
  const ranks = (key: string) => allRows.filter((r) => String(r.name) === key).sort((a, b) => Number(a.grade) - Number(b.grade));
  const selected = name ? ranks(name) : [];
  return <>
    <div className={`record-grid layout-collection layout-${layout}`}>{names.map((key) => {
      const grades = ranks(key), label = String(grades[0]?.label || key);
      return <article key={key} className="rank-summary-card record-card clickable-card" role="button" tabIndex={0} onClick={() => setName(key)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setName(key); } }}>
        <header><span className="record-symbol"><Icon size={23} /></span><div><h3>{label}</h3><p>{key}</p></div></header>
        <dl><div><dt>Rütbe sayısı</dt><dd>{grades.length}</dd></div></dl>
      </article>;
    })}</div>
    <Dialog open={name !== null} onOpenChange={(open) => { if (!open) setName(null); }}>
      <DialogContent className="sm:max-w-xl"><DialogTitle>{String(selected[0]?.label || name)} · Rütbeler</DialogTitle>
        <DialogDescription>{name} {faction ? 'grubunun tüm rütbeleri ve unvanları.' : 'mesleğinin tüm rütbeleri ve maaşları.'}</DialogDescription>
        <div className="max-h-[60vh] overflow-auto"><Table><TableHeader><TableRow><TableHead>Rütbe</TableHead><TableHead>Unvan</TableHead>{!faction && <TableHead>Maaş</TableHead>}</TableRow></TableHeader>
          <TableBody>{selected.map((r, i) => <TableRow key={i}><TableCell>{String(r.grade ?? '—')}</TableCell><TableCell>{String(r.rank ?? '—')}</TableCell>{!faction && <TableCell>{String(r.salary ?? '—')}</TableCell>}</TableRow>)}</TableBody>
        </Table></div>
        {!faction && (onEditJob || onDeleteJob) && <div className="flex justify-end gap-2 pt-2">
          {onDeleteJob && name !== 'unemployed' && <Button variant="destructive" onClick={() => { if (name) { onDeleteJob(name); setName(null); } }}><Trash2 size={15} /> Sil</Button>}
          {onEditJob && <Button onClick={() => { if (name) { onEditJob(name, selected); setName(null); } }}><Pencil size={15} /> Düzenle</Button>}
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
