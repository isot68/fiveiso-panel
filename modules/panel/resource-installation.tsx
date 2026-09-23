import { useEffect, useState } from 'react';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/toast-center';
type License = { state: 'unconfigured' | 'pending' | 'bound' | 'revoked'; ip: string | null };
const labels = { unconfigured: 'Kurulum paketi oluşturulmadı', pending: 'İlk sunucu bağlantısı bekleniyor', bound: 'Sunucuya bağlı', revoked: 'Lisans silinmiş veya sunucu ataması değişmiş' };
export function ResourceInstallation({ serverId }: { serverId: string }) {
  const [license, setLicense] = useState<License | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const base = `/api/servers/${encodeURIComponent(serverId)}`;
  useEffect(() => {
    let cancelled = false;
    setLicense(null); setError('');
    const refresh = async () => {
      try {
        const response = await fetch(base + '/license');
        const data = await response.json() as License & { error?: string };
        if (!response.ok) throw Error(data.error || 'Lisans bilgisi alınamadı.');
        if (!cancelled) { setLicense(data); setError(''); }
      } catch (e) { if (!cancelled) setError((e as Error).message); }
    };
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [base]);
  async function change(action: 'create' | 'revoke') {
    if (action === 'revoke' && !window.confirm('Lisans silinecek ve kurulu FiveISO paketi duracak. Taşımak için yeni lisans oluşturup yeni paketi kurmanız gerekir. Devam edilsin mi?')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(base + '/license', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const data = await response.json() as License & { error?: string };
      if (!response.ok) throw Error(data.error || 'İşlem tamamlanamadı.');
      setLicense(data);
      notify(action === 'create' ? 'Kurulum paketin hazır.' : 'Lisans silindi; eski paket artık kullanılamaz.', 'success');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function download() {
    if (!license) return;
    setBusy(true); setError('');
    try {
      const action = ['unconfigured','revoked'].includes(license.state) ? 'create' : 'update';
      const response = await fetch(base + '/license', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
      const result = await response.json() as License & {error?:string};
      if (!response.ok) throw Error(result.error || 'Paket hazırlanamadı.');
      setLicense(result);
      const link = document.createElement('a');
      link.href = base + '/package'; link.download = 'fiveiso-install.zip';
      document.body.appendChild(link); link.click(); link.remove();
      notify('Güncel FiveISO paketinin indirilmesi başlatıldı.', 'success');
    } catch(e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }
  return <div className="grid gap-4">
    <div className="flex items-center gap-3"><ShieldCheck className="text-primary" size={23} /><strong>Sunucuya özel FiveISO kurulumu</strong></div>
    <p className="text-sm text-muted-foreground">{license ? labels[license.state] : 'Lisans bilgileri alınıyor…'}{license?.ip && <> · Bağlı IP: <b>{license.ip}</b></>}</p>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {license && <div className="flex flex-wrap gap-3">
      <Button type="button" disabled={busy} onClick={()=>void download()}><Download size={16}/>{busy ? 'Paket hazırlanıyor…' : 'FiveISO indir'}</Button>
      {['pending','bound'].includes(license.state) && <Button type="button" variant="outline" disabled={busy} onClick={()=>void change('revoke')}><Trash2 size={16}/>Lisansı sil</Button>}
    </div>}
    <p className="text-sm text-muted-foreground">İndir düğmesi güncel sürümü sunucuna özel hazırlar. Güncelleme mevcut lisansını ve sunucu bağlantısını korur. Yapılandırma dosyalarını düzenleyebilirsin.</p>
    <ol className="setup-list text-sm">
      <li>Paketi indir ve sunucunda resources klasörü dışında aç.</li>
      <li>İşletim sistemine uygun kurulum betiğini server.cfg ve resources yollarıyla çalıştır. Komutlar paketteki KURULUM.txt dosyasında.</li>
      <li>FiveM’i yeniden başlat veya konsoldan <code>ensure fiveiso</code> çalıştır. Kimlik, adres ve anahtar pakette hazırdır.</li>
    </ol>
    <p className="text-sm text-muted-foreground">İlk bağlantıda lisans bu sunucuya ve çıkış IP’sine bağlanır. Taşımak için lisansı silip yeni paket oluştur. Kurulum mevcut dosyaları yedekler ve gerekli başlangıç/yetki satırlarını otomatik ekler.</p>
    {license?.state === 'unconfigured' && <p className="text-sm text-amber-200">Paket oluşturulduğunda önceki bağlantı anahtarı yenilenir; mevcut kurulum varsa yeni paketi kurmalısın.</p>}
  </div>;
}
