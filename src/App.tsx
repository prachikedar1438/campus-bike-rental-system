import { useEffect, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { Bike, Zap, MapPin, Ticket, History as HistoryIcon, Settings, LocateFixed, X, CheckCircle2, AlertTriangle, Loader2, Plus, Minus, QrCode, Info } from 'lucide-react'
import { useStore, haversineKm, PRICE, HOURS, BIKE_LABEL, type BikeKind, type Rental, type Station, type Status } from './store'

type Tab = 'explore' | 'ticket' | 'history' | 'manage'
const NAV: { id: Tab; label: string; icon: typeof Bike }[] = [
  { id: 'explore', label: 'Explore', icon: MapPin }, { id: 'ticket', label: 'Ticket', icon: Ticket },
  { id: 'history', label: 'History', icon: HistoryIcon }, { id: 'manage', label: 'Manage', icon: Settings },
]
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—')
const badge: Record<Status, string> = { Booked: 'bg-amber-100 text-amber-800', Active: 'bg-green-100 text-green-800', Returned: 'bg-slate-200 text-slate-700' }
const btn = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 disabled:opacity-50'
const primary = `${btn} bg-green-700 text-white hover:bg-green-800`
const ghost = `${btn} border border-green-700 text-green-800 hover:bg-green-50`
const card = 'rounded-2xl bg-white p-4 shadow-sm ring-1 ring-green-100'
const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600'

function StatusBadge({ s }: { s: Status }) { return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge[s]}`}>{s}</span> }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100"><X size={20} /></button></div>
        {children}
      </div>
    </div>
  )
}
function Alert({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }) {
  const c = { error: 'bg-red-50 text-red-800', success: 'bg-green-50 text-green-800', info: 'bg-sky-50 text-sky-800' }[kind]
  const I = kind === 'error' ? AlertTriangle : kind === 'success' ? CheckCircle2 : Info
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`flex gap-2 rounded-lg p-3 text-sm ${c}`}><I size={18} className="mt-0.5 shrink-0" /><div>{children}</div></div>
}
function Qr({ text }: { text: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => { QRCode.toDataURL(text, { width: 200, margin: 1 }).then(setSrc).catch(() => setSrc('')) }, [text])
  return src ? <img src={src} alt={`QR code for ${text}`} className="h-40 w-40" /> : <div className="flex h-40 w-40 items-center justify-center"><Loader2 className="animate-spin text-green-700" /></div>
}

function CampusMap({ stations, selected, nearest, onSelect }: { stations: Station[]; selected: string | null; nearest: string | null; onSelect: (id: string) => void }) {
  return (
    <div className={card}>
      <svg viewBox="0 0 400 260" className="w-full rounded-xl bg-green-100" role="group" aria-label="Schematic campus map">
        <path d="M20 130 H380 M200 10 V250 M70 60 V130 M330 70 V210" stroke="#fff" strokeWidth="10" strokeLinecap="round" fill="none" />
        <rect x="30" y="20" width="80" height="30" rx="6" fill="#bbf7d0" /><rect x="260" y="150" width="60" height="30" rx="6" fill="#bbf7d0" /><rect x="20" y="170" width="90" height="60" rx="8" fill="#86efac" opacity=".6" />
        {stations.map(s => {
          const sel = s.id === selected, near = s.id === nearest
          return (
            <g key={s.id} tabIndex={0} role="button" aria-label={`${s.name}, ${s.city + s.ebike} bikes available`} className="cursor-pointer outline-none"
              onClick={() => onSelect(s.id)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect(s.id)}>
              <circle cx={s.x} cy={s.y} r={sel ? 17 : 13} fill={sel ? '#166534' : '#16a34a'} stroke={near ? '#f59e0b' : '#fff'} strokeWidth={near ? 4 : 3} />
              <text x={s.x} y={s.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{s.city + s.ebike}</text>
              <text x={s.x} y={s.y + 30} textAnchor="middle" fontSize="10" fontWeight="600" fill="#14532d">{s.name}</text>
            </g>
          )
        })}
      </svg>
      <p className="mt-2 text-xs text-slate-500">Schematic demo map. Station positions and coordinates are approximate placeholders, not verified campus locations.</p>
    </div>
  )
}

function BookDialog({ station, onClose, onBook }: { station: Station; onClose: () => void; onBook: (bike: BikeKind, hours: number) => string | null }) {
  const [bike, setBike] = useState<BikeKind>('city'); const [hours, setHours] = useState(1)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const total = PRICE[bike] * hours
  const pay = () => { setBusy(true); setErr(''); setTimeout(() => { const e = onBook(bike, hours); if (e) { setErr(e); setBusy(false) } }, 900) }
  return (
    <Modal title={`Book at ${station.name}`} onClose={onClose}>
      <div className="space-y-4">
        <fieldset><legend className="mb-1 text-sm font-semibold">Bicycle type</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['city', 'ebike'] as BikeKind[]).map(k => (
              <label key={k} className={`cursor-pointer rounded-lg border p-3 text-sm ${bike === k ? 'border-green-700 bg-green-50' : 'border-slate-300'} ${station[k] < 1 ? 'opacity-50' : ''}`}>
                <input type="radio" name="bike" className="sr-only" checked={bike === k} disabled={station[k] < 1} onChange={() => setBike(k)} />
                <span className="flex items-center gap-1 font-semibold">{k === 'city' ? <Bike size={16} /> : <Zap size={16} />}{BIKE_LABEL[k]}</span>
                <span className="text-slate-600">₹{PRICE[k]}/hr · {station[k]} left</span>
              </label>
            ))}
          </div></fieldset>
        <fieldset><legend className="mb-1 text-sm font-semibold">Duration</legend>
          <div className="grid grid-cols-4 gap-2">
            {HOURS.map(h => <button key={h} type="button" aria-pressed={hours === h} onClick={() => setHours(h)} className={`rounded-lg border py-2 text-sm font-semibold ${hours === h ? 'border-green-700 bg-green-700 text-white' : 'border-slate-300'}`}>{h}h</button>)}
          </div></fieldset>
        <div className="rounded-lg bg-green-50 p-3 text-sm">
          <div className="flex justify-between"><span>Pickup</span><b>{station.name}</b></div>
          <div className="flex justify-between"><span>{BIKE_LABEL[bike]} × {hours}h</span><span>₹{PRICE[bike]} × {hours}</span></div>
          <div className="mt-1 flex justify-between border-t border-green-200 pt-1 text-base"><span>Total</span><b>₹{total}</b></div>
        </div>
        <Alert kind="info"><b>Demo payment.</b> No card is charged and no real payment happens. Nothing is sent to any server.</Alert>
        {err && <Alert kind="error">{err}</Alert>}
        <button className={`${primary} w-full`} onClick={pay} disabled={busy || station[bike] < 1}>{busy ? <><Loader2 className="animate-spin" size={16} />Processing demo payment…</> : `Confirm & simulate payment · ₹${total}`}</button>
      </div>
    </Modal>
  )
}

function Explore({ stations, onBook }: { stations: Station[]; onBook: (st: string, b: BikeKind, h: number) => string | null }) {
  const [sel, setSel] = useState<string | null>(null); const [booking, setBooking] = useState<Station | null>(null)
  const [near, setNear] = useState<{ id: string; km: number } | null>(null); const [geoErr, setGeoErr] = useState(''); const [loc, setLoc] = useState(false)
  const find = () => {
    setGeoErr(''); setNear(null)
    if (!('geolocation' in navigator)) return setGeoErr('Your browser does not support geolocation.')
    setLoc(true)
    navigator.geolocation.getCurrentPosition(p => {
      const me = { lat: p.coords.latitude, lng: p.coords.longitude }
      const best = stations.map(s => ({ id: s.id, km: haversineKm(me, s) })).sort((a, b) => a.km - b.km)[0]
      setNear(best); setSel(best.id); setLoc(false)
    }, e => {
      setLoc(false)
      setGeoErr(e.code === 1 ? 'Location permission was denied. Click the lock icon in your browser address bar, set Location to Allow, then press Find Nearest again.'
        : e.code === 3 ? 'Finding your location timed out. Check your connection or GPS and retry.' : 'Your location is unavailable right now. Enable device location services and retry.')
    }, { timeout: 10000, maximumAge: 60000 })
  }
  const nearSt = stations.find(s => s.id === near?.id)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-2xl font-bold text-green-900">Explore stations</h1><p className="text-sm text-slate-600">Pick a station on the map or from the list.</p></div>
        <button className={primary} onClick={find} disabled={loc}>{loc ? <Loader2 className="animate-spin" size={16} /> : <LocateFixed size={16} />}Find Nearest</button>
      </div>
      {nearSt && near && <Alert kind="success">Nearest station: <b>{nearSt.name}</b>, about {near.km < 1 ? `${Math.round(near.km * 1000)} m` : `${near.km.toFixed(2)} km`} away (straight-line, measured against demo coordinates). Your location stays in your browser.</Alert>}
      {geoErr && <Alert kind="error">{geoErr}</Alert>}
      <div className="grid gap-4 lg:grid-cols-2">
        <CampusMap stations={stations} selected={sel} nearest={near?.id ?? null} onSelect={setSel} />
        <div className="space-y-3">
          {stations.map(s => {
            const total = s.city + s.ebike
            return (
              <div key={s.id} onClick={() => setSel(s.id)} className={`${card} cursor-pointer ${sel === s.id ? 'ring-2 ring-green-700' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div><h3 className="font-bold">{s.name}</h3>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-800"><Bike size={12} />{s.city} city</span>
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800"><Zap size={12} />{s.ebike} e-bike</span>
                      {near?.id === s.id && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Nearest</span>}
                    </div></div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${total ? 'bg-green-700 text-white' : 'bg-red-100 text-red-700'}`}>{total ? `${total} available` : 'Empty'}</span>
                </div>
                <button className={`${sel === s.id ? primary : ghost} mt-3 w-full`} disabled={!total} onClick={e => { e.stopPropagation(); setSel(s.id); setBooking(s) }}>{total ? 'Select & book' : 'No bikes available'}</button>
              </div>
            )
          })}
        </div>
      </div>
      {booking && <BookDialog station={stations.find(s => s.id === booking.id)!} onClose={() => setBooking(null)} onBook={(b, h) => { const e = onBook(booking.id, b, h); if (!e) setBooking(null); return e }} />}
    </div>
  )
}

function TicketCard({ r, st, onPickup, goReturn }: { r: Rental; st: Station | undefined; onPickup: (id: string, c: string) => string | null; goReturn: () => void }) {
  const [code, setCode] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState(false)
  return (
    <div className={`${card} space-y-3`}>
      <div className="flex items-center justify-between"><h3 className="font-mono font-bold">{r.id}</h3><StatusBadge s={r.status} /></div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="text-center"><Qr text={r.id} /><p className="max-w-[10rem] text-[11px] text-slate-500">QR is generated for display only. This demo has no QR scanner; use the pickup code.</p></div>
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Pickup station</dt><dd className="font-semibold">{st?.name}</dd>
          <dt className="text-slate-500">Bike</dt><dd className="font-semibold">{BIKE_LABEL[r.bike]}</dd>
          <dt className="text-slate-500">Duration</dt><dd className="font-semibold">{r.hours} h</dd>
          <dt className="text-slate-500">Price (demo)</dt><dd className="font-semibold">₹{r.amount}</dd>
          <dt className="text-slate-500">Booked</dt><dd className="font-semibold">{fmt(r.booked)}</dd>
          <dt className="text-slate-500">Pickup code</dt><dd className="font-mono text-lg font-bold tracking-widest text-green-800">{r.pickupCode}</dd>
        </dl>
      </div>
      {r.status === 'Booked' && (
        <form className="space-y-2" onSubmit={e => { e.preventDefault(); const m = onPickup(r.id, code); m ? setErr(m) : setOk(true) }}>
          <label className="text-sm font-semibold" htmlFor={`c-${r.id}`}>Enter pickup code to activate</label>
          <div className="flex gap-2"><input id={`c-${r.id}`} className={input} inputMode="numeric" maxLength={6} value={code} onChange={e => { setCode(e.target.value); setErr('') }} placeholder="6-digit code" />
            <button className={primary} type="submit">Activate</button></div>
          {err && <Alert kind="error">{err}</Alert>}
        </form>
      )}
      {(ok || r.status === 'Active') && r.status === 'Active' && <><Alert kind="success">Rental active since {fmt(r.pickedUp)}. Enjoy your ride!</Alert><button className={primary} onClick={goReturn}>Return Your Bike</button></>}
    </div>
  )
}

function Manage({ d, giveBack, adjust, reset }: { d: ReturnType<typeof useStore>['d']; giveBack: ReturnType<typeof useStore>['giveBack']; adjust: ReturnType<typeof useStore>['adjust']; reset: () => void }) {
  const active = d.rentals.filter(r => r.status === 'Active')
  const [rid, setRid] = useState(''); const [sid, setSid] = useState(''); const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ k: 'error' | 'success'; t: string } | null>(null)
  const [pin, setPin] = useState(''); const [admin, setAdmin] = useState(false); const [pinErr, setPinErr] = useState(false)
  const [filter, setFilter] = useState<'All' | Status>('All')
  const rId = rid || active[0]?.id || ''
  const submit = () => {
    if (!window.confirm('Confirm returning this bike at the selected station?')) return
    const r = giveBack(rId, sid, code)
    if (r.ok) { setMsg({ k: 'success', t: `Returned at ${r.station.name}. Inventory updated. Thanks for riding!` }); setCode(''); setRid('') } else setMsg({ k: 'error', t: r.error })
  }
  const name = (id?: string) => d.stations.find(s => s.id === id)?.name ?? '—'
  const rows = d.rentals.filter(r => filter === 'All' || r.status === filter)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-green-900">Manage</h1>
      <section className={`${card} space-y-3`}>
        <h2 className="text-lg font-bold">Return your bike</h2>
        {active.length === 0 ? <p className="text-sm text-slate-600">No active rental. Book a bike and activate it with its pickup code first.</p> : (
          <>
            {active.length > 1 && <select className={input} value={rId} onChange={e => setRid(e.target.value)} aria-label="Rental">{active.map(r => <option key={r.id} value={r.id}>{r.id} · {BIKE_LABEL[r.bike]}</option>)}</select>}
            <label className="block text-sm font-semibold">Drop-off station
              <select className={`${input} mt-1`} value={sid} onChange={e => { setSid(e.target.value); setMsg(null) }}><option value="">Select station…</option>{d.stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="block text-sm font-semibold">Station return code
              <input className={`${input} mt-1`} value={code} onChange={e => { setCode(e.target.value); setMsg(null) }} placeholder="e.g. RET-LIB" /></label>
            <p className="text-xs text-slate-500">Demo return codes: {d.stations.map(s => `${s.name} = ${s.code}`).join(' · ')}. (Shown only because this is a client-side demo.)</p>
            <button className={primary} onClick={submit}>Confirm return</button>
          </>
        )}
        {msg && <Alert kind={msg.k}>{msg.t}</Alert>}
      </section>
      <section className={`${card} space-y-3`}>
        <h2 className="text-lg font-bold">Demo management dashboard</h2>
        <Alert kind="info"><b>Demo admin access only.</b> This PIN check runs in your browser and provides no real security. A production app must enforce authentication and authorization on a backend.</Alert>
        {!admin ? (
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); pin === '1234' ? setAdmin(true) : setPinErr(true) }}>
            <input className={input} type="password" value={pin} onChange={e => { setPin(e.target.value); setPinErr(false) }} placeholder="Demo PIN (1234)" aria-label="Demo admin PIN" />
            <button className={primary}>Unlock</button>
          </form>
        ) : (
          <div className="space-y-4">
            {pinErr && null}
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              {[['Active', d.rentals.filter(r => r.status === 'Active').length], ['Booked', d.rentals.filter(r => r.status === 'Booked').length], ['Completed', d.rentals.filter(r => r.status === 'Returned').length]].map(([l, n]) => <div key={l} className="rounded-lg bg-green-50 p-2"><div className="text-xl font-bold text-green-800">{n}</div>{l}</div>)}
            </div>
            <div className="space-y-2">
              {d.stations.map(s => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                  <b>{s.name}</b>
                  {(['city', 'ebike'] as BikeKind[]).map(k => (
                    <span key={k} className="flex items-center gap-1">{BIKE_LABEL[k]}
                      <button aria-label={`Remove ${BIKE_LABEL[k]} at ${s.name}`} className="rounded border p-1 hover:bg-slate-100" onClick={() => adjust(s.id, k, -1)}><Minus size={14} /></button>
                      <b className="w-6 text-center">{s[k]}</b>
                      <button aria-label={`Add ${BIKE_LABEL[k]} at ${s.name}`} className="rounded border p-1 hover:bg-slate-100" onClick={() => adjust(s.id, k, 1)}><Plus size={14} /></button></span>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <select className={`${input} !w-auto`} value={filter} onChange={e => setFilter(e.target.value as 'All' | Status)} aria-label="Filter rentals">{['All', 'Booked', 'Active', 'Returned'].map(s => <option key={s}>{s}</option>)}</select>
              <div className="flex gap-2"><button className={ghost} onClick={() => setAdmin(false)}>Lock</button>
                <button className={`${btn} bg-red-600 text-white hover:bg-red-700`} onClick={() => window.confirm('Erase all demo rentals and reset inventory?') && reset()}>Reset demo data</button></div>
            </div>
            {rows.length === 0 ? <p className="text-sm text-slate-600">No rentals match.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="p-1">ID</th><th>Pickup</th><th>Return</th><th>Bike</th><th>₹</th><th>Status</th></tr></thead>
                <tbody>{rows.map(r => <tr key={r.id} className="border-t"><td className="p-1 font-mono">{r.id}</td><td>{name(r.stationId)}</td><td>{name(r.returnStationId)}</td><td>{BIKE_LABEL[r.bike]}</td><td>{r.amount}</td><td><StatusBadge s={r.status} /></td></tr>)}</tbody></table></div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default function App() {
  const store = useStore(); const { d } = store
  const [tab, setTab] = useState<Tab>('explore'); const [toast, setToast] = useState('')
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t) } }, [toast])
  const onBook = (sid: string, b: BikeKind, h: number) => { const r = store.book(sid, b, h); if (!r.ok) return r.error; setToast(`Booked ${r.rental.id} (demo payment). Your ticket is ready.`); setTab('ticket'); return null }
  const ticketRentals = d.rentals.filter(r => r.status !== 'Returned')
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 flex-col bg-green-900 p-4 text-white md:flex">
        <div className="mb-6 flex items-center gap-2 text-lg font-bold"><Bike /> Campus Bike Rental</div>
        <nav className="space-y-1" aria-label="Main">{NAV.map(n => <button key={n.id} onClick={() => setTab(n.id)} aria-current={tab === n.id} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${tab === n.id ? 'bg-green-700' : 'hover:bg-green-800'}`}><n.icon size={18} />{n.label}</button>)}</nav>
        <p className="mt-auto rounded-lg bg-green-800 p-2 text-xs">Demo app. Data is stored only in this browser. Payments are simulated.</p>
      </aside>
      <div className="flex-1 pb-20 md:pb-0">
        <header className="flex items-center gap-2 bg-green-800 px-4 py-3 font-bold text-white md:hidden"><Bike size={20} />Campus Bike Rental <span className="ml-auto rounded bg-amber-300 px-1.5 text-xs text-green-950">DEMO</span></header>
        <main className="mx-auto max-w-5xl p-4 md:p-6">
          {tab === 'explore' && <Explore stations={d.stations} onBook={onBook} />}
          {tab === 'ticket' && (
            <div className="space-y-4"><h1 className="text-2xl font-bold text-green-900">My ticket</h1>
              {ticketRentals.length === 0 ? <div className={`${card} py-10 text-center`}><QrCode className="mx-auto mb-2 text-green-700" size={36} /><p className="font-semibold">No active tickets</p><p className="mb-3 text-sm text-slate-600">Book a bike to get your ticket and pickup code.</p><button className={primary} onClick={() => setTab('explore')}>Find a station</button></div>
                : ticketRentals.map(r => <TicketCard key={r.id} r={r} st={d.stations.find(s => s.id === r.stationId)} onPickup={(id, c) => { const x = store.pickup(id, c); if (x.ok) { setToast('Rental activated.'); return null } return x.error }} goReturn={() => setTab('manage')} />)}
            </div>
          )}
          {tab === 'history' && (
            <div className="space-y-4"><h1 className="text-2xl font-bold text-green-900">Rental history</h1>
              {d.rentals.length === 0 ? <div className={`${card} py-10 text-center text-sm text-slate-600`}>No rentals yet. Your completed and ongoing rides will appear here.</div>
                : d.rentals.map(r => (
                  <div key={r.id} className={`${card} text-sm`}>
                    <div className="mb-2 flex items-center justify-between"><b className="font-mono">{r.id}</b><StatusBadge s={r.status} /></div>
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                      <span>Pickup: <b>{d.stations.find(s => s.id === r.stationId)?.name}</b></span><span>Return: <b>{d.stations.find(s => s.id === r.returnStationId)?.name ?? '—'}</b></span>
                      <span>{BIKE_LABEL[r.bike]} · {r.hours}h · ₹{r.amount}</span><span>Booked: {fmt(r.booked)}</span><span>Picked up: {fmt(r.pickedUp)}</span><span>Returned: {fmt(r.returned)}</span>
                    </div></div>))}
            </div>
          )}
          {tab === 'manage' && <Manage d={d} giveBack={store.giveBack} adjust={store.adjust} reset={store.reset} />}
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-white md:hidden" aria-label="Main">
        {NAV.map(n => <button key={n.id} onClick={() => setTab(n.id)} aria-current={tab === n.id} className={`flex flex-col items-center gap-0.5 py-2 text-xs font-semibold ${tab === n.id ? 'text-green-800' : 'text-slate-500'}`}><n.icon size={20} />{n.label}</button>)}
      </nav>
      {toast && <div role="status" className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg bg-green-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}
    </div>
  )
}
