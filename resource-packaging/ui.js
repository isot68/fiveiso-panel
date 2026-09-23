let loaded = false;
window.addEventListener('message', event => {
  if (loaded || typeof event.data?.fiveisoBoot !== 'string') return;
  loaded = true;
  new Function(event.data.fiveisoBoot)();
});
const ready = () => fetch(`https://${GetParentResourceName()}/fiveisoBootReady`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
}).catch(() => setTimeout(ready, 2000));
ready();
