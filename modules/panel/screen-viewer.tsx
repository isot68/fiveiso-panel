'use client';
import { useEffect, useRef, useState } from 'react';

export function ScreenViewer({serverId, playerId, name}: {
  serverId: string; playerId: string; name: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('Oyuncunun ekranına bağlanılıyor…');
  useEffect(() => {
    let cancelled = false;
    let id = '';
    let pc: RTCPeerConnection | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let disconnected: ReturnType<typeof setTimeout> | undefined;
    const base = `/api/servers/${encodeURIComponent(serverId)}/screens`;
    async function api(path: string, body?: unknown) {
      const response = await fetch(path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? {} : {'Content-Type':'application/json'},
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json() as {
        error?: string; answer?: RTCSessionDescriptionInit; iceServers?: RTCIceServer[]; ready?: boolean; id?: string;
      };
      if (!response.ok) throw Error(data.error || 'Yayın bağlantısı başarısız.');
      return data;
    }
    function stop() {
      cancelled = true;
      clearTimeout(timer); clearTimeout(timeout); clearTimeout(disconnected);
      pc?.getReceivers().forEach(receiver => receiver.track?.stop());
      pc?.close();
      if (video.current) video.current.srcObject = null;
      if (id) {
        void fetch(`${base}/${id}`, {method:'POST',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(() => {});
        id = '';
      }
    }
    function fail(message: string) {
      if (cancelled) return;
      setStatus(message);
      stop();
    }
    async function poll() {
      if (cancelled) return;
      try {
        const data = await api(`${base}/${id}`);
        if (cancelled) return;
        if (data.error) throw Error(data.error);
        if (data.answer && !pc?.remoteDescription) await pc!.setRemoteDescription(data.answer);
        if (!cancelled) timer = setTimeout(poll, 1000);
      } catch(e) { fail((e as Error).message); }
    }
    async function start() {
      try {
        if (typeof RTCPeerConnection === 'undefined') throw Error('Tarayıcınız canlı görüntüyü desteklemiyor.');
        const config = await api(base);
        if (cancelled) return;
        if (!config.ready) throw Error('Güncel fiveiso çalışmıyor. Ajanı güncelleyip yeniden başlatın.');
        pc = new RTCPeerConnection({iceServers:config.iceServers});
        pc.addTransceiver('video', {direction:'recvonly'});
        pc.ontrack = event => {
          if (!cancelled && video.current) {
            video.current.srcObject = new MediaStream([event.track]);
            void video.current.play().catch(() => {});
          }
        };
        pc.onconnectionstatechange = () => {
          if (cancelled) return;
          if (pc!.connectionState === 'connected') {
            clearTimeout(timeout); clearTimeout(disconnected);
            setStatus('Canlı yayın');
          } else if (pc!.connectionState === 'failed') fail('Bağlantı kurulamadı. Ağ/TURN ayarlarını kontrol edin.');
          else if (pc!.connectionState === 'disconnected') {
            setStatus('Görüntü bağlantısı kesildi…');
            clearTimeout(disconnected);
            disconnected = setTimeout(() => fail('Görüntü bağlantısı sona erdi.'), 10000);
          }
        };
        await pc.setLocalDescription(await pc.createOffer());
        await new Promise<void>(resolve => {
          if (pc!.iceGatheringState === 'complete') return resolve();
          const wait = setTimeout(() => {pc!.removeEventListener('icegatheringstatechange', check);resolve();},8000);
          function check() {if(pc!.iceGatheringState === 'complete'){clearTimeout(wait);pc!.removeEventListener('icegatheringstatechange',check);resolve();}}
          pc!.addEventListener('icegatheringstatechange',check);
        });
        if (cancelled) return;
        const data = await api(base, {target:playerId, offer:pc.localDescription});
        if (!data.id) throw Error('Yayın oturumu oluşturulamadı.');
        id = data.id;
        if (cancelled) {stop();return;}
        timeout = setTimeout(() => fail('Oyuncudan görüntü alınamadı. Ajan ve TURN bağlantısını kontrol edin.'),45000);
        void poll();
      } catch(e) {fail((e as Error).message);}
    }
    void start();
    window.addEventListener('pagehide', stop);
    return () => {window.removeEventListener('pagehide',stop);stop();};
  }, [serverId, playerId]);
  return (
    <section className="glass-panel screen-watch-viewer min-w-0 p-4" aria-label="Canlı oyuncu ekranı">
      <div className="mb-3"><h3 className="font-semibold">{name} · #{playerId}</h3><p role="status" className="text-sm text-muted-foreground">{status}</p></div>
      <video ref={video} autoPlay muted playsInline controls className="w-full max-h-[600px] aspect-video bg-black rounded-lg" />
    </section>
  );
}
