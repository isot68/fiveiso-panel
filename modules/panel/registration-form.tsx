import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from 'lucide-react';
export function RegistrationForm({ onBack }: { onBack: () => void }) {
  const [enabled,setEnabled]=useState<boolean | null>(null);
  const [challenge,setChallenge]=useState('');
  const [email,setEmail]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [done,setDone]=useState(false);
  useEffect(()=>{fetch('/api/registration/config').then(r=>r.json()).then(data=>setEnabled((data as {enabled:boolean}).enabled)).catch(()=>setEnabled(false));},[]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setError('');const values=new FormData(event.currentTarget);
    if(!challenge && values.get('password')!==values.get('confirm')){setError('Parolalar eşleşmiyor.');return;}
    setBusy(true);
    try {
      const body=challenge?{id:challenge,code:values.get('code')}:{username:values.get('username'),email:values.get('email'),password:values.get('password')};
      const response=await fetch('/api/registration/'+(challenge?'verify':'request'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await response.json() as {id?:string;error?:string};
      if(!response.ok)throw Error(data.error||'Kayıt tamamlanamadı.');
      if(challenge)setDone(true);
      else {setChallenge(data.id!);setEmail(String(values.get('email')));}
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(done)return <><ShieldCheck size={35} className="text-primary"/><h1>Kayıt başarılı.</h1><p>E-posta adresin doğrulandı. Hesabınla giriş yapabilirsin. Sunucu ve paket erişimini FiveISO yöneticisi tanımlar.</p><button type="button" className="login-submit" onClick={onBack}>Giriş yap <ArrowRight size={18}/></button></>;
  return <><span className="login-eyebrow">FIVEISO HESABI</span><h1>{challenge?'E-postanı doğrula.':'Hesabını oluştur.'}</h1><p>{challenge?`${email} adresine gönderilen 6 haneli kodu gir. Kod 10 dakika geçerli.`:'Doğrulama kodunu e-posta adresine göndereceğiz.'}</p>
    {enabled===false&&<p className="login-error" role="status">E-posta ile kayıt henüz etkinleştirilmedi. Lütfen daha sonra tekrar dene.</p>}
    <form onSubmit={submit}>
      {challenge?<><label htmlFor="register-code">Doğrulama kodu</label><div className="login-input"><ShieldCheck size={18}/><input id="register-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required disabled={busy}/></div></>:<>
        <label htmlFor="register-username">Kullanıcı adı</label><div className="login-input"><input id="register-username" name="username" autoComplete="username" minLength={3} maxLength={40} pattern="[a-zA-Z0-9_.-]{3,40}" required disabled={busy}/></div>
        <label htmlFor="register-email">E-posta</label><div className="login-input"><Mail size={18}/><input id="register-email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy}/></div>
        <label htmlFor="register-password">Parola</label><div className="login-input"><input id="register-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} placeholder="En az 12 karakter" required disabled={busy}/></div>
        <label htmlFor="register-confirm">Parola tekrar</label><div className="login-input"><input id="register-confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={256} required disabled={busy}/></div>
      </>}
      {error&&<p className="login-error" role="alert">{error}</p>}
      <button type="submit" className="login-submit" disabled={busy||!enabled}>{busy?'İşleniyor…':challenge?'Kodu doğrula ve kayıt ol':'Doğrulama kodu gönder'}<ArrowRight size={18}/></button>
    </form>
    {challenge&&<button className="registration-back" type="button" disabled={busy} onClick={()=>{setChallenge('');setError('');}}>E-posta adresini değiştir / yeni kod iste</button>}
    <button className="registration-back" type="button" disabled={busy} onClick={onBack}><ArrowLeft size={15}/> Girişe dön</button>
  </>;
}
