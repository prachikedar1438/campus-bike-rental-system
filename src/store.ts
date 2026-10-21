import { useState } from 'react'

export type BikeKind = 'city' | 'ebike'
export type Status = 'Booked' | 'Active' | 'Returned'
export interface Station { id: string; name: string; x: number; y: number; lat: number; lng: number; city: number; ebike: number; code: string }
export interface Rental {
  id: string; stationId: string; bike: BikeKind; hours: number; amount: number; pickupCode: string
  status: Status; booked: string; pickedUp?: string; returnStationId?: string; returned?: string
}
export interface Data { stations: Station[]; rentals: Rental[] }

export const PRICE: Record<BikeKind, number> = { city: 30, ebike: 50 }
export const HOURS = [1, 2, 4, 8]
export const BIKE_LABEL: Record<BikeKind, string> = { city: 'City Bike', ebike: 'E-Bike' }
const KEY = 'cbr-demo-v1'

// DEMO COORDINATES: approximate placeholders, NOT verified campus locations. Replace with real ones.
// x/y position the stations on the schematic SVG map. code = demo return code for that station.
const SEED: Station[] = [
  { id: 'a-wing', name: 'A Wing', x: 70, y: 60, lat: 18.5010, lng: 73.8010, city: 6, ebike: 3, code: 'RET-AW' },
  { id: 'b-wing', name: 'B Wing', x: 200, y: 45, lat: 18.5015, lng: 73.8030, city: 5, ebike: 2, code: 'RET-BW' },
  { id: 'c-wing', name: 'C Wing', x: 330, y: 70, lat: 18.5008, lng: 73.8052, city: 4, ebike: 2, code: 'RET-CW' },
  { id: 'library', name: 'Library Entrance', x: 160, y: 160, lat: 18.4994, lng: 73.8025, city: 7, ebike: 4, code: 'RET-LIB' },
  { id: 'hostel', name: 'Hostel', x: 305, y: 210, lat: 18.4975, lng: 73.8048, city: 8, ebike: 3, code: 'RET-HOS' },
]

export function load(): Data {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) } catch { /* ignore corrupt data */ }
  return { stations: SEED, rentals: [] }
}
function save(d: Data) { try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* storage full/blocked */ } }

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (n: number) => (n * Math.PI) / 180
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
function rnd(n: number, chars: string) {
  const a = new Uint32Array(n); crypto.getRandomValues(a)
  return Array.from(a, v => chars[v % chars.length]).join('')
}

type Res<T = {}> = ({ ok: true } & T) | { ok: false; error: string }

export function useStore() {
  const [d, setD] = useState<Data>(load)
  const commit = (n: Data) => { save(n); setD(n) }

  const book = (stationId: string, bike: BikeKind, hours: number): Res<{ rental: Rental }> => {
    const st = d.stations.find(s => s.id === stationId)
    if (!st) return { ok: false, error: 'Unknown station.' }
    if (!HOURS.includes(hours)) return { ok: false, error: 'Invalid duration.' }
    if (st[bike] < 1) return { ok: false, error: `No ${BIKE_LABEL[bike]}s left at ${st.name}.` }
    const rental: Rental = {
      id: 'CBR-' + rnd(8, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), stationId, bike, hours,
      amount: PRICE[bike] * hours, pickupCode: rnd(6, '0123456789'), status: 'Booked', booked: new Date().toISOString(),
    }
    commit({ stations: d.stations.map(s => (s.id === stationId ? { ...s, [bike]: s[bike] - 1 } : s)), rentals: [rental, ...d.rentals] })
    return { ok: true, rental }
  }
  const pickup = (id: string, code: string): Res => {
    const r = d.rentals.find(x => x.id === id)
    if (!r) return { ok: false, error: 'Rental not found.' }
    if (r.status !== 'Booked') return { ok: false, error: `Rental is already ${r.status.toLowerCase()}.` }
    if (code.trim() !== r.pickupCode) return { ok: false, error: 'Incorrect pickup code.' }
    commit({ ...d, rentals: d.rentals.map(x => (x.id === id ? { ...x, status: 'Active', pickedUp: new Date().toISOString() } : x)) })
    return { ok: true }
  }
  const giveBack = (id: string, stationId: string, code: string): Res<{ station: Station }> => {
    const r = d.rentals.find(x => x.id === id)
    const st = d.stations.find(s => s.id === stationId)
    if (!r) return { ok: false, error: 'Choose a rental to return.' }
    if (!st) return { ok: false, error: 'Choose the drop-off station.' }
    if (r.status === 'Returned') return { ok: false, error: 'This rental was already returned.' }
    if (r.status !== 'Active') return { ok: false, error: 'Activate the rental with the pickup code first.' }
    if (code.trim().toUpperCase() !== st.code) return { ok: false, error: `Invalid return code for ${st.name}.` }
    commit({
      stations: d.stations.map(s => (s.id === stationId ? { ...s, [r.bike]: s[r.bike] + 1 } : s)),
      rentals: d.rentals.map(x => (x.id === id ? { ...x, status: 'Returned', returnStationId: stationId, returned: new Date().toISOString() } : x)),
    })
    return { ok: true, station: st }
  }
  const adjust = (stationId: string, bike: BikeKind, delta: number) =>
    commit({ ...d, stations: d.stations.map(s => (s.id === stationId ? { ...s, [bike]: Math.max(0, s[bike] + delta) } : s)) })
  const reset = () => commit({ stations: SEED, rentals: [] })
  return { d, book, pickup, giveBack, adjust, reset }
}
