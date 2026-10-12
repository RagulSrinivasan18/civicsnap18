import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    __civicMapsReady?: () => void;
    google?: any;
  }
}

let loader: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.google?.maps?.Map) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const env = import.meta.env as Record<string, string | undefined>;
    const key = env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "";
    if (!key) return reject(new Error("Map key missing"));
    window.__civicMapsReady = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__civicMapsReady&channel=${channel}`;
    s.async = true;
    s.onerror = () => reject(new Error("Map failed to load"));
    document.head.appendChild(s);
  });
  return loader;
}

const DEFAULT_CENTER = { lat: 13.0827, lng: 80.2707 };

export type MapPoint = { id: string; lat: number; lng: number; title: string; onClick?: () => void };

export function GoogleMap({
  points = [],
  picked,
  onPick,
  className = "h-80",
}: {
  points?: MapPoint[];
  picked?: { lat: number; lng: number } | null;
  onPick?: (p: { lat: number; lng: number }) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const pickMarker = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    loadMaps()
      .then(() => {
        if (!el.current) return;
        const g = window.google;
        map.current = new g.maps.Map(el.current, {
          center: picked ?? (points[0] ? { lat: points[0].lat, lng: points[0].lng } : DEFAULT_CENTER),
          zoom: 12,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        });
        if (onPickRef.current) {
          map.current.addListener("click", (e: any) =>
            onPickRef.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() }),
          );
        }
        setReady(true);
      })
      .catch((e) => setErr(e?.message ?? "Map unavailable"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const g = window.google;
    markers.current.forEach((m) => m.setMap(null));
    markers.current = points.map((p) => {
      const m = new g.maps.Marker({ position: { lat: p.lat, lng: p.lng }, map: map.current, title: p.title });
      if (p.onClick) m.addListener("click", p.onClick);
      return m;
    });
    if (points.length > 1) {
      const b = new g.maps.LatLngBounds();
      points.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
      map.current.fitBounds(b);
    } else if (points.length === 1) map.current.setCenter({ lat: points[0].lat, lng: points[0].lng });
  }, [ready, points]);

  useEffect(() => {
    if (!ready) return;
    const g = window.google;
    if (!picked) {
      pickMarker.current?.setMap(null);
      pickMarker.current = null;
      return;
    }
    if (!pickMarker.current) pickMarker.current = new g.maps.Marker({ map: map.current });
    pickMarker.current.setPosition(picked);
  }, [ready, picked]);

  if (err)
    return (
      <div className={`${className} grid place-items-center rounded-xl border bg-muted text-sm text-muted-foreground`}>
        Map unavailable right now.
      </div>
    );
  return <div ref={el} className={`${className} w-full rounded-xl border bg-muted`} />;
}
