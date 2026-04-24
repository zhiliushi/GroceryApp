import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useMapConfig, useManualStores } from '@/api/queries/useMapConfig';
import { useOverpassStores } from '@/api/queries/useOverpassStores';
import { useFoodbanks } from '@/api/queries/useFoodbanks';
import { useAddStore, useUpdateStore, useDeleteStore, useUpdateMapConfig } from '@/api/mutations/useStoreMutations';
import { useAuthStore } from '@/stores/authStore';
import type { ManualStore } from '@/types/api';

// --- Custom marker icons (colored circle SVGs) ---
function makeIcon(color: string, size = 28) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="white" stroke-width="2"/></svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const ICON_BLUE = makeIcon('#3B82F6');
const ICON_ORANGE = makeIcon('#F97316');
const ICON_GREEN = makeIcon('#22C55E');

// --- Opening hours parser (best-effort) ---
function isOpenNow(hoursStr: string | undefined): 'open' | 'closed' | 'unknown' {
  if (!hoursStr || hoursStr === '24/7') return hoursStr === '24/7' ? 'open' : 'unknown';
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const now = new Date();
  const dayAbbr = days[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Simple parse: "Mo-Fr 08:00-22:00; Sa 08:00-20:00"
  for (const part of hoursStr.split(';')) {
    const trimmed = part.trim();
    const match = trimmed.match(/^([A-Za-z, -]+)\s+(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/);
    if (!match) continue;
    const [, dayRange, h1, m1, h2, m2] = match;
    const open = parseInt(h1) * 60 + parseInt(m1);
    const close = parseInt(h2) * 60 + parseInt(m2);

    // Check if today is in the day range
    if (dayRange.includes(dayAbbr) || dayRange.includes('-')) {
      // Simple range check like "Mo-Fr"
      const rangeParts = dayRange.split('-');
      if (rangeParts.length === 2) {
        const startIdx = days.indexOf(rangeParts[0].trim());
        const endIdx = days.indexOf(rangeParts[1].trim());
        const todayIdx = days.indexOf(dayAbbr);
        if (startIdx >= 0 && endIdx >= 0 && todayIdx >= startIdx && todayIdx <= endIdx) {
          return currentMinutes >= open && currentMinutes < close ? 'open' : 'closed';
        }
      }
      if (dayRange.includes(dayAbbr)) {
        return currentMinutes >= open && currentMinutes < close ? 'open' : 'closed';
      }
    }
  }
  return 'unknown';
}

// --- Map events listener (fetch OSM stores on move) ---
function MapEventHandler({ onBoundsChange }: { onBoundsChange: (b: { south: number; west: number; north: number; east: number }) => void }) {
  useMapEvents({
    moveend: (e) => {
      const bounds = e.target.getBounds();
      onBoundsChange({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      });
    },
  });
  return null;
}

// --- Set map center from config ---
function MapCenterSetter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      map.setView([lat, lng], zoom);
      initialized.current = true;
    }
  }, [map, lat, lng, zoom]);
  return null;
}

// --- Click handler for placing store ---
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

// --- Store form ---
interface StoreFormData {
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: string;
  opening_hours: string;
  notes: string;
}

const EMPTY_FORM: StoreFormData = { name: '', address: '', lat: 0, lng: 0, type: 'supermarket', opening_hours: '', notes: '' };

function StoreForm({
  initial,
  onSave,
  onCancel,
  isPending,
  isPlacing,
}: {
  initial: StoreFormData;
  onSave: (data: StoreFormData) => void;
  onCancel: () => void;
  isPending: boolean;
  isPlacing: boolean;
}) {
  const [form, setForm] = useState(initial);

  // Update lat/lng when user clicks map
  useEffect(() => {
    if (initial.lat !== form.lat || initial.lng !== form.lng) {
      setForm((f) => ({ ...f, lat: initial.lat, lng: initial.lng }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.lat, initial.lng]);

  return (
    <div className="bg-ga-bg-card border border-ga-accent/30 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ga-text-secondary block mb-1">Name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
        </div>
        <div>
          <label className="text-xs text-ga-text-secondary block mb-1">Address</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
        </div>
        <div>
          <label className="text-xs text-ga-text-secondary block mb-1">
            Lat/Lng {isPlacing && <span className="text-ga-accent">(click map to set)</span>}
          </label>
          <div className="flex gap-2">
            <input type="number" step="any" value={form.lat || ''} onChange={(e) => setForm({ ...form, lat: parseFloat(e.target.value) || 0 })}
              placeholder="Lat" className="w-1/2 bg-ga-bg-hover border border-ga-border rounded px-2 py-2 text-xs text-ga-text-primary font-mono" />
            <input type="number" step="any" value={form.lng || ''} onChange={(e) => setForm({ ...form, lng: parseFloat(e.target.value) || 0 })}
              placeholder="Lng" className="w-1/2 bg-ga-bg-hover border border-ga-border rounded px-2 py-2 text-xs text-ga-text-primary font-mono" />
          </div>
        </div>
        <div>
          <label className="text-xs text-ga-text-secondary block mb-1">Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary">
            <option value="supermarket">Supermarket</option>
            <option value="convenience">Convenience Store</option>
            <option value="hypermarket">Hypermarket</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-ga-text-secondary block mb-1">Opening Hours</label>
          <input value={form.opening_hours} onChange={(e) => setForm({ ...form, opening_hours: e.target.value })}
            placeholder="e.g. Mo-Fr 08:00-22:00" className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
        </div>
        <div>
          <label className="text-xs text-ga-text-secondary block mb-1">Notes</label>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(form)} disabled={!form.name.trim() || !form.lat || isPending}
          className="bg-ga-accent hover:bg-ga-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
          {isPending ? 'Saving...' : 'Save Store'}
        </button>
        <button onClick={onCancel}
          className="border border-ga-border text-ga-text-secondary hover:text-ga-text-primary text-sm rounded-lg px-4 py-2 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function MapPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingStore, setEditingStore] = useState<ManualStore | null>(null);
  const [placingPin, setPlacingPin] = useState(false);
  const [formLatLng, setFormLatLng] = useState<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
  const [showLegend, setShowLegend] = useState(true);

  const isAdmin = useAuthStore((s) => s.isAdmin);
  const { data: mapConfig } = useMapConfig();
  const { data: manualStores = [] } = useManualStores();
  const { data: foodbanksData } = useFoodbanks();
  const { stores: osmStores, loading: osmLoading, fetchStores: fetchOsmStores } = useOverpassStores();

  const addMutation = useAddStore();
  const updateMutation = useUpdateStore();
  const deleteMutation = useDeleteStore();
  const mapConfigMutation = useUpdateMapConfig();

  const mapRef = useRef<L.Map | null>(null);

  const center = useMemo(() => ({
    lat: mapConfig?.center_lat ?? 3.139,
    lng: mapConfig?.center_lng ?? 101.687,
    zoom: mapConfig?.default_zoom ?? 13,
  }), [mapConfig]);

  const foodbanks = useMemo(() =>
    (foodbanksData?.foodbanks || []).filter((fb) => fb.latitude && fb.longitude && fb.is_active),
    [foodbanksData],
  );

  const handleBoundsChange = useCallback((bounds: { south: number; west: number; north: number; east: number }) => {
    fetchOsmStores(bounds);
  }, [fetchOsmStores]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (placingPin) {
      setFormLatLng({ lat, lng });
    }
  }, [placingPin]);

  const handleAddStore = useCallback(async (data: StoreFormData) => {
    try {
      await addMutation.mutateAsync(data);
      setShowForm(false);
      setPlacingPin(false);
    } catch { /* toast shown by mutation */ }
  }, [addMutation]);

  const handleUpdateStore = useCallback(async (data: StoreFormData) => {
    if (!editingStore) return;
    try {
      await updateMutation.mutateAsync({ id: editingStore.id, ...data });
      setEditingStore(null);
    } catch { /* toast shown by mutation */ }
  }, [editingStore, updateMutation]);

  const handleDeleteStore = useCallback(async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch { /* toast shown by mutation */ }
  }, [deleteMutation]);

  const handleSetCenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const z = map.getZoom();
    mapConfigMutation.mutate({ center_lat: c.lat, center_lng: c.lng, default_zoom: z });
  }, [mapConfigMutation]);

  // Initial bounds fetch
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!initialFetchDone.current && mapConfig) {
      initialFetchDone.current = true;
      // Approximate bounds from center + zoom
      const span = 0.05 * Math.pow(2, 13 - center.zoom);
      fetchOsmStores({
        south: center.lat - span, west: center.lng - span,
        north: center.lat + span, east: center.lng + span,
      });
    }
  }, [mapConfig, center, fetchOsmStores]);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-ga-text-primary">🗺️ Map</h1>
          <p className="text-xs text-ga-text-secondary">
            Supermarkets, stores & foodbanks nearby
            {osmLoading && <span className="ml-2 text-ga-accent animate-pulse">Loading stores...</span>}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={handleSetCenter} disabled={mapConfigMutation.isPending}
              className="text-xs border border-ga-border text-ga-text-secondary hover:text-ga-text-primary rounded px-3 py-1.5 transition-colors">
              📍 Set as Default Center
            </button>
            <button onClick={() => { setShowForm(true); setPlacingPin(true); setEditingStore(null); setFormLatLng({ lat: 0, lng: 0 }); }}
              className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
              + Add Store
            </button>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-ga-border" style={{ height: '55vh', minHeight: 350 }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={center.zoom}
          className="h-full w-full"
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapCenterSetter lat={center.lat} lng={center.lng} zoom={center.zoom} />
          <MapEventHandler onBoundsChange={handleBoundsChange} />
          {(showForm || editingStore) && <MapClickHandler onMapClick={handleMapClick} />}

          {/* OSM supermarkets (blue) */}
          {osmStores.map((store) => {
            const status = isOpenNow(store.tags?.opening_hours);
            return (
              <Marker key={`osm-${store.id}`} position={[store.lat, store.lon]} icon={ICON_BLUE}>
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <strong>{store.tags?.name || 'Supermarket'}</strong>
                    {store.tags?.brand && <div className="text-xs text-gray-500">{store.tags.brand}</div>}
                    {store.tags?.['addr:street'] && <div className="text-xs">{store.tags['addr:street']}</div>}
                    {store.tags?.opening_hours && (
                      <div className="text-xs mt-1">
                        <span className={status === 'open' ? 'text-green-600 font-medium' : status === 'closed' ? 'text-red-500' : 'text-gray-500'}>
                          {status === 'open' ? 'Open now' : status === 'closed' ? 'Closed' : ''}
                        </span>
                        <div className="text-gray-400">{store.tags.opening_hours}</div>
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-1">Source: OpenStreetMap</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Manual stores (orange) */}
          {manualStores.map((store) => (
            <Marker key={`manual-${store.id}`} position={[store.lat, store.lng]} icon={ICON_ORANGE}>
              <Popup>
                <div className="text-sm min-w-[180px]">
                  <strong>{store.name}</strong>
                  {store.address && <div className="text-xs">{store.address}</div>}
                  {store.opening_hours && <div className="text-xs text-gray-500">{store.opening_hours}</div>}
                  {store.notes && <div className="text-xs text-gray-400 italic mt-1">{store.notes}</div>}
                  {isAdmin && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => { setEditingStore(store); setFormLatLng({ lat: store.lat, lng: store.lng }); setShowForm(false); }}
                        className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleDeleteStore(store.id)}
                        className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Foodbanks (green) */}
          {foodbanks.map((fb) => (
            <Marker key={`fb-${fb.id}`} position={[fb.latitude!, fb.longitude!]} icon={ICON_GREEN}>
              <Popup>
                <div className="text-sm min-w-[180px]">
                  <strong>{fb.name}</strong>
                  {fb.location_address && <div className="text-xs">{fb.location_address}</div>}
                  {fb.description && <div className="text-xs text-gray-400 mt-1">{fb.description}</div>}
                  {fb.location_link && (
                    <a href={fb.location_link} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 block">View on Google Maps</a>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-ga-text-secondary flex-wrap">
        <button onClick={() => setShowLegend(!showLegend)} className="hover:text-ga-text-primary">
          {showLegend ? '▼' : '▶'} Legend
        </button>
        {showLegend && (
          <>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Supermarkets ({osmStores.length})</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> My Stores ({manualStores.length})</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Foodbanks ({foodbanks.length})</span>
          </>
        )}
      </div>

      {/* Placing pin instruction */}
      {placingPin && (
        <div className="mt-3 bg-ga-accent/10 border border-ga-accent/30 rounded-lg px-4 py-2 text-sm text-ga-accent">
          Click on the map to place the store pin, then fill in the details below.
        </div>
      )}

      {/* Add store form */}
      {showForm && (
        <div className="mt-4">
          <StoreForm
            initial={{ ...EMPTY_FORM, lat: formLatLng.lat, lng: formLatLng.lng }}
            onSave={handleAddStore}
            onCancel={() => { setShowForm(false); setPlacingPin(false); }}
            isPending={addMutation.isPending}
            isPlacing={placingPin}
          />
        </div>
      )}

      {/* Edit store form */}
      {editingStore && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ga-text-primary mb-2">Edit: {editingStore.name}</h3>
          <StoreForm
            initial={{
              name: editingStore.name,
              address: editingStore.address,
              lat: formLatLng.lat || editingStore.lat,
              lng: formLatLng.lng || editingStore.lng,
              type: editingStore.type,
              opening_hours: editingStore.opening_hours,
              notes: editingStore.notes,
            }}
            onSave={handleUpdateStore}
            onCancel={() => setEditingStore(null)}
            isPending={updateMutation.isPending}
            isPlacing={false}
          />
        </div>
      )}

      {/* Admin store list */}
      {isAdmin && manualStores.length > 0 && !showForm && !editingStore && (
        <div className="mt-4 bg-ga-bg-card border border-ga-border rounded-lg">
          <div className="px-4 py-3 border-b border-ga-border">
            <h3 className="text-sm font-semibold text-ga-text-primary">My Stores ({manualStores.length})</h3>
          </div>
          <div className="divide-y divide-ga-border/30">
            {manualStores.map((store) => (
              <div key={store.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-3 h-3 rounded-full bg-orange-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ga-text-primary font-medium truncate">{store.name}</div>
                  {store.address && <div className="text-xs text-ga-text-secondary truncate">{store.address}</div>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => { setEditingStore(store); setFormLatLng({ lat: store.lat, lng: store.lng }); }}
                    className="text-xs text-ga-accent hover:underline">Edit</button>
                  <button onClick={() => handleDeleteStore(store.id)}
                    className="text-xs text-red-400 hover:text-red-600">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
