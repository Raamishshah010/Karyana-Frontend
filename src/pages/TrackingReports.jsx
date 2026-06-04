import { useState, useEffect, useRef, useMemo } from "react";
import { getAllSalesPersons, getTrackingHistoryBySalesId, getAllRetailers, getAllCities } from "../APIS";
import shopIcon from "../assets/karyana-icon.png";
import {
  MdSearch, MdClose, MdPerson, MdCalendarToday,
  MdFilterList, MdCheckCircle, MdMap, MdRoute,
  MdLocationOn, MdMyLocation, MdExpandMore,
} from "react-icons/md";

/* ─── Google Maps loader (singleton) ─── */
let googleMapsPromise = null;
const loadGoogleMaps = () => {
  if (googleMapsPromise) return googleMapsPromise;
  if (window.google?.maps) return (googleMapsPromise = Promise.resolve());
  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      const poll = setInterval(() => {
        if (window.google?.maps) { clearInterval(poll); resolve(); }
      }, 100);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyAuJYLmzmglhCpBYTn0BjbJhjWYg0fPEEA";
    s.async = true; s.defer = true;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  return googleMapsPromise;
};

const formatDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-GB"); } catch { return d; }
};

/* ─────────────────────────────────────────────────────────────
   ROUTE PREVIEW MODAL
───────────────────────────────────────────────────────────── */
const RoutePreviewModal = ({ open, onClose, coordinates, shops }) => {
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylinesRef   = useRef([]);
  const markersRef     = useRef([]);
  const shopMarkersRef = useRef([]);

  const sessions = useMemo(() => {
    const arr = Array.isArray(coordinates) ? coordinates : [];
    return arr
      .map(s => Array.isArray(s) ? s.filter(p => p && typeof p.lat !== "undefined" && typeof p.lng !== "undefined") : [])
      .filter(s => s.length > 0);
  }, [coordinates]);

  const defaultCenter = useMemo(() => {
    const first = sessions[0]?.[0];
    if (first) return { lat: parseFloat(first.lat), lng: parseFloat(first.lng) };
    return { lat: 33.6844, lng: 73.0479 };
  }, [sessions]);

  const clearOverlays = () => {
    polylinesRef.current.forEach(pl => pl?.setMap(null));
    polylinesRef.current = [];
    markersRef.current.forEach(m => m?.setMap(null));
    markersRef.current = [];
    shopMarkersRef.current.forEach(m => m?.setMap(null));
    shopMarkersRef.current = [];
  };

  const addShopMarkers = (map, shopsList) => {
    if (!window.google?.maps) return;
    shopsList.forEach(shop => {
      if (!shop.lat || !shop.lng) return;
      const marker = new window.google.maps.Marker({
        position: { lat: parseFloat(shop.lat), lng: parseFloat(shop.lng) },
        map,
        title: shop.shopName || shop.name,
        icon: {
          url: shopIcon,
          scaledSize: new window.google.maps.Size(30, 30),
          anchor: new window.google.maps.Point(15, 15),
        },
      });
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding:8px;font-family:sans-serif;">
            <h4 style="margin:0 0 4px 0;font-weight:bold;color:#FF5934;">${shop.shopName || shop.name}</h4>
            <p style="margin:0 0 2px 0;font-size:12px;"><b>Owner:</b> ${shop.name}</p>
            <p style="margin:0 0 2px 0;font-size:12px;"><b>Phone:</b> ${shop.phoneNumber || '—'}</p>
            <p style="margin:0;font-size:12px;"><b>Address:</b> ${shop.shopAddress1 || "N/A"}</p>
          </div>
        `,
      });
      marker.addListener("click", () => infoWindow.open(map, marker));
      shopMarkersRef.current.push(marker);
    });
  };

  const buildRoadPath = async (points) => {
    const norm = points
      .map(p => ({ lat: parseFloat(p.lat), lng: parseFloat(p.lng) }))
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (norm.length < 2 || !window.google?.maps) return norm;

    const ds = new window.google.maps.DirectionsService();
    const maxWaypoints = 23;
    const sampleEvery  = Math.max(1, Math.ceil(norm.length / (maxWaypoints + 2)));
    const sampled      = norm.filter((_, i) => i % sampleEvery === 0);
    if (sampled.length < 2) return norm;

    const routeAsync = (req) => new Promise((resolve, reject) => {
      ds.route(req, (res, status) => {
        if (status === window.google.maps.DirectionsStatus.OK || status === "OK") resolve(res);
        else reject(new Error(status || "Directions error"));
      });
    });

    const chunks = [];
    let startIndex = 0;
    while (startIndex < sampled.length - 1) {
      const endIndex   = Math.min(startIndex + maxWaypoints + 1, sampled.length - 1);
      const origin      = sampled[startIndex];
      const destination = sampled[endIndex];
      const waypoints   = sampled.slice(startIndex + 1, endIndex).map(p => ({ location: p, stopover: false }));
      chunks.push({ origin, destination, waypoints });
      startIndex = endIndex;
    }

    let path = [];
    try {
      for (const chunk of chunks) {
        const res = await routeAsync({
          origin: chunk.origin, destination: chunk.destination,
          waypoints: chunk.waypoints, travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        });
        const overview = res?.routes?.[0]?.overview_path || [];
        if (overview.length) path = path.concat(overview.map(ll => ({ lat: ll.lat(), lng: ll.lng() })));
      }
    } catch { return norm; }
    return path.length ? path : norm;
  };

  useEffect(() => {
    if (!open) return;
    const init = () => {
      if (!mapRef.current || !window.google) return;
      clearOverlays();
      const map = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter, zoom: sessions.length ? 14 : 12,
        mapTypeControl: true, streetViewControl: true,
        zoomControl: true, fullscreenControl: true,
      });
      mapInstanceRef.current = map;
      const render = async () => {
        const bounds = new window.google.maps.LatLngBounds();
        if (shops?.length) {
          addShopMarkers(map, shops);
          shops.forEach(s => {
            if (s.lat && s.lng) bounds.extend({ lat: parseFloat(s.lat), lng: parseFloat(s.lng) });
          });
        }
        for (let i = 0; i < sessions.length; i++) {
          const roadPath = await buildRoadPath(sessions[i]);
          if (!roadPath.length) continue;
          markersRef.current.push(new window.google.maps.Marker({
            position: roadPath[0], map,
            label: { text: "S", color: "#fff" },
            icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#2ECC71", fillOpacity: 1, strokeColor: "#1B5E20", strokeWeight: 2 },
          }));
          markersRef.current.push(new window.google.maps.Marker({
            position: roadPath[roadPath.length - 1], map,
            label: { text: "E", color: "#fff" },
            icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#E74C3C", fillOpacity: 1, strokeColor: "#7F1D1D", strokeWeight: 2 },
          }));
          const pl = new window.google.maps.Polyline({
            path: roadPath, geodesic: true,
            strokeColor: "#FF5934", strokeOpacity: 0.95, strokeWeight: 5,
          });
          pl.setMap(map);
          polylinesRef.current.push(pl);
          roadPath.forEach(pt => bounds.extend(pt));
        }
        if (!bounds.isEmpty()) map.fitBounds(bounds);
      };
      render();
    };
    loadGoogleMaps().then(init).catch(() => {});
    return () => clearOverlays();
  }, [open, sessions, defaultCenter, shops]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[860px] overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-5 flex-shrink-0">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <MdRoute size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Route Preview</p>
                <h2 className="text-white text-[16px] font-bold leading-tight">Route Playback</h2>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
              <MdClose size={16} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-6 px-6 py-3 bg-[#FAFAFA] border-b border-gray-100 flex-shrink-0 flex-wrap">
          {[
            { color:'bg-emerald-400', label:'Start point' },
            { color:'bg-red-400',     label:'End point' },
            { color:'bg-[#FF5934]',   label:'Route' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="text-[12px] font-semibold text-[#374151]">{label}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1.5 text-[12px] text-[#9CA3AF]">
            <MdLocationOn size={13} className="text-[#FF5934]" />
            {sessions.reduce((acc, s) => acc + s.length, 0)} location points
          </div>
        </div>
        <div className="flex-1 relative" style={{ minHeight: 420 }}>
          <div ref={mapRef} className="w-full h-full" style={{ minHeight: 420 }} />
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
const TrackingReports = () => {
  /* ── static data ── */
  const [salesPersons, setSalesPersons] = useState([]);
  const [cities,       setCities]       = useState([]);
  const [shops,        setShops]        = useState([]);

  /* ── filter state ── */
  const [selectedSP,   setSelectedSP]   = useState("all"); // "all" | sp._id
  const [selectedCity, setSelectedCity] = useState("all"); // "all" | city._id
  const [spSearch,     setSpSearch]     = useState("");
  const [spDropOpen,   setSpDropOpen]   = useState(false);
  const [cityDropOpen, setCityDropOpen] = useState(false);

  /* ── result state ── */
  // allHistory = { [spId]: [...days] }
  const [allHistory,  setAllHistory]  = useState({});
  const [loading,     setLoading]     = useState(false);
  const [generated,   setGenerated]   = useState(false);

  /* ── modal ── */
  const [modalOpen,          setModalOpen]          = useState(false);
  const [selectedCoords,     setSelectedCoords]     = useState([]);
  const [modalShops,         setModalShops]         = useState([]);

  /* ── close dropdowns on outside click ── */
  useEffect(() => {
    const h = (e) => {
      if (!e.target.closest(".tr-drop")) {
        setSpDropOpen(false);
        setCityDropOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* ── initial data load + auto-generate ── */
  useEffect(() => {
    const init = async () => {
      try {
        const [spRes, retRes, citRes] = await Promise.all([
          getAllSalesPersons(),
          getAllRetailers(),
          getAllCities(),
        ]);

        const spList  = spRes?.data?.data  || [];
        const retList = retRes?.data?.data || [];
        /* getAllCities returns { data: { data: [...] } } same as other list APIs */
        const citList = citRes?.data?.data || [];

        setSalesPersons(spList);
        setShops(retList);
        setCities(citList);

        /* ── auto-fetch all salespersons on load ── */
        if (spList.length) {
          await fetchAllHistory(spList);
        }
      } catch (err) {
        console.error("TrackingReports init error:", err);
      }
    };
    init();
  // eslint-disable-next-line
  }, []);

  /* ── fetch tracking history for a list of SPs ── */
  const fetchAllHistory = async (spList) => {
    setLoading(true);
    setGenerated(false);
    setAllHistory({});

    const results = await Promise.allSettled(
      spList.map(async sp => {
        try {
          const res = await getTrackingHistoryBySalesId(sp._id, 30);
          const days = res?.data?.data || [];
          return [sp._id, Array.isArray(days) ? days : []];
        } catch {
          return [sp._id, []];
        }
      })
    );

    const map = {};
    results.forEach(r => {
      if (r.status === "fulfilled" && Array.isArray(r.value)) {
        const [id, days] = r.value;
        if (days.length) map[id] = days;
      }
    });

    setAllHistory(map);
    setLoading(false);
    setGenerated(true);
  };

  /* ── "Generate Report" button ── */
  const handleGenerate = async () => {
    const list = selectedSP === "all"
      ? salesPersons
      : salesPersons.filter(s => s._id === selectedSP);
    await fetchAllHistory(list);
  };

  const handleReset = () => {
    setSelectedSP("all");
    setSelectedCity("all");
    setSpSearch("");
    setGenerated(false);
    setAllHistory({});
    /* re-fetch all */
    if (salesPersons.length) fetchAllHistory(salesPersons);
  };

  /* ── computed flat rows with city filter applied ── */
  const rows = useMemo(() => {
    const out = [];
    const spsToShow = selectedSP === "all"
      ? salesPersons
      : salesPersons.filter(s => s._id === selectedSP);

    spsToShow.forEach(sp => {
      const days = allHistory[sp._id] || [];
      days.forEach((day, i) => {
        /* city filter: if a city is selected, only show days whose
           shops include at least one shop in that city assigned to this SP */
        if (selectedCity !== "all") {
          const hasShopInCity = shops.some(sh => {
            const shCityId = typeof sh.city === "object" ? sh.city?._id : sh.city;
            const shSpId   = typeof sh.salesPersonID === "object" ? sh.salesPersonID?._id : sh.salesPersonID;
            return shCityId === selectedCity && shSpId === sp._id;
          });
          if (!hasShopInCity) return;
        }
        out.push({ sp, day, dayIndex: i });
      });
    });
    return out;
  }, [allHistory, salesPersons, selectedSP, selectedCity, shops]);

  /* ── open route modal ── */
  const openRoute = (sp, day) => {
    const coords = (day.sessions || day.allCoordinatesArray || []).map(s =>
      s.coordinates ? s.coordinates : s
    );
    /* shops for this SP, optionally filtered by city */
    let spShops = shops.filter(sh => {
      const shSpId = typeof sh.salesPersonID === "object" ? sh.salesPersonID?._id : sh.salesPersonID;
      return shSpId === sp._id;
    });
    if (selectedCity !== "all") {
      spShops = spShops.filter(sh => {
        const shCityId = typeof sh.city === "object" ? sh.city?._id : sh.city;
        return shCityId === selectedCity;
      });
    }
    setSelectedCoords(coords);
    setModalShops(spShops);
    setModalOpen(true);
  };

  /* ── dropdown helpers ── */
  const filteredSPs = salesPersons.filter(s =>
    (s.name || "").toLowerCase().includes(spSearch.toLowerCase()) ||
    (s.email || "").toLowerCase().includes(spSearch.toLowerCase())
  );
  const selectedSPObj   = selectedSP !== "all" ? salesPersons.find(s => s._id === selectedSP) : null;
  const selectedCityObj = selectedCity !== "all" ? cities.find(c => c._id === selectedCity) : null;
  const activeFilters   = [selectedSP !== "all", selectedCity !== "all"].filter(Boolean).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .tr-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .tr-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .tr-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .tr-no-scroll::-webkit-scrollbar { display: none; }
        .tr-no-scroll { scrollbar-width: none; }
        @keyframes trFadeIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }
        .tr-row-appear { animation: trFadeIn 0.22s ease both; }
        .tr-drop { position: relative; }
      `}</style>

      <div className="tr-page">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Tracking Reports</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              {loading
                ? "Loading route data…"
                : generated
                  ? `${rows.length} route${rows.length !== 1 ? "s" : ""} found${selectedCity !== "all" && selectedCityObj ? ` in ${selectedCityObj.name}` : ""}`
                  : "Select filters and generate report"}
            </p>
          </div>
        </div>

        {/* ── Filter Card ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-5 mb-5">
          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-4 flex items-center gap-2">
            <MdFilterList size={13} className="text-[#FF5934]" /> Filters
            {activeFilters > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#FF5934] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {activeFilters}
              </span>
            )}
          </p>

          <div className="flex flex-wrap gap-4 items-end">

            {/* ── Sales Person dropdown ── */}
            <div className="flex-1 min-w-[240px] tr-drop">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdPerson size={12} className="text-[#FF5934]" /> Sales Person
              </label>
              <div
                className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#FF5934] transition-all"
                onClick={() => { setSpDropOpen(p => !p); setCityDropOpen(false); }}
              >
                {selectedSPObj ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#FF5934] text-[10px] font-bold">{(selectedSPObj.name || "?")[0].toUpperCase()}</span>
                    </div>
                    <span className="text-[13px] text-[#111827] font-medium truncate">{selectedSPObj.name}</span>
                  </div>
                ) : (
                  <span className="text-[13px] text-[#111827] font-medium flex-1">All Salespersons</span>
                )}
                <MdExpandMore size={18} className={`text-[#9CA3AF] transition-transform flex-shrink-0 ${spDropOpen ? "rotate-180" : ""}`} />
              </div>

              {spDropOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden" style={{ top: "100%" }}>
                  <div className="p-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-1.5">
                      <MdSearch size={14} className="text-[#9CA3AF]" />
                      <input autoFocus value={spSearch} onChange={e => setSpSearch(e.target.value)}
                        placeholder="Search…"
                        className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full" />
                      {spSearch && <button onClick={() => setSpSearch("")} className="text-[#9CA3AF] hover:text-[#FF5934]"><MdClose size={13} /></button>}
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto tr-no-scroll">
                    {/* All option */}
                    <div onClick={() => { setSelectedSP("all"); setSpDropOpen(false); setSpSearch(""); }}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors ${selectedSP === "all" ? "bg-orange-50" : ""}`}>
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-gray-400">All</div>
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-[#374151]">All Salespersons</p>
                        <p className="text-[11px] text-[#9CA3AF]">Show everyone</p>
                      </div>
                      {selectedSP === "all" && <MdCheckCircle size={15} className="text-[#FF5934]" />}
                    </div>
                    {filteredSPs.map(sp => (
                      <div key={sp._id} onClick={() => { setSelectedSP(sp._id); setSpDropOpen(false); setSpSearch(""); }}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors ${selectedSP === sp._id ? "bg-orange-50" : ""}`}>
                        <div className="w-7 h-7 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#FF5934] text-[11px] font-bold">{(sp.name || "?")[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-[#111827] truncate">{sp.name}</p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">{sp.email}</p>
                        </div>
                        {selectedSP === sp._id && <MdCheckCircle size={15} className="text-[#FF5934]" />}
                      </div>
                    ))}
                    {filteredSPs.length === 0 && (
                      <div className="py-6 text-center text-[13px] text-[#9CA3AF]">No results</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── City / Location dropdown — from getAllCities ── */}
            <div className="flex-1 min-w-[220px] tr-drop">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdLocationOn size={12} className="text-[#FF5934]" /> Location / City
              </label>
              <div
                className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#FF5934] transition-all"
                onClick={() => { setCityDropOpen(p => !p); setSpDropOpen(false); }}
              >
                {selectedCityObj ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MdLocationOn size={14} className="text-blue-500 flex-shrink-0" />
                    <span className="text-[13px] text-[#111827] font-medium truncate">{selectedCityObj.name}</span>
                  </div>
                ) : (
                  <span className="text-[13px] text-[#111827] font-medium flex-1">All Locations</span>
                )}
                <MdExpandMore size={18} className={`text-[#9CA3AF] transition-transform flex-shrink-0 ${cityDropOpen ? "rotate-180" : ""}`} />
              </div>

              {cityDropOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden" style={{ top: "100%" }}>
                  <div className="max-h-56 overflow-y-auto tr-no-scroll">
                    {/* All locations */}
                    <div onClick={() => { setSelectedCity("all"); setCityDropOpen(false); }}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors border-b border-gray-50 ${selectedCity === "all" ? "bg-orange-50" : ""}`}>
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-gray-400">All</div>
                      <p className="text-[13px] font-medium text-[#374151] flex-1">All Locations</p>
                      {selectedCity === "all" && <MdCheckCircle size={15} className="text-[#FF5934]" />}
                    </div>
                    {cities.length ? cities.map(city => (
                      <div key={city._id} onClick={() => { setSelectedCity(city._id); setCityDropOpen(false); }}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0 ${selectedCity === city._id ? "bg-orange-50" : ""}`}>
                        <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <MdLocationOn size={13} className="text-blue-500" />
                        </div>
                        <p className="text-[13px] font-medium text-[#111827] truncate flex-1">{city.name}</p>
                        {selectedCity === city._id && <MdCheckCircle size={15} className="text-[#FF5934]" />}
                      </div>
                    )) : (
                      <div className="py-6 text-center text-[13px] text-[#9CA3AF]">No locations found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Buttons ── */}
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleReset}
                className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
                <MdClose size={15} /> Reset
              </button>
              <button onClick={handleGenerate} disabled={loading}
                className="h-10 px-5 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-orange-100 transition-all flex items-center gap-2">
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading…</>
                  : <><MdRoute size={16} /> Generate Report</>
                }
              </button>
            </div>
          </div>

          {/* Active chips */}
          {(selectedSPObj || selectedCityObj) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedSPObj && (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#FF5934]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#FF5934] text-[9px] font-bold">{(selectedSPObj.name || "?")[0].toUpperCase()}</span>
                  </div>
                  <span className="text-[12px] font-semibold text-[#FF5934]">{selectedSPObj.name}</span>
                  <button onClick={() => setSelectedSP("all")} className="text-[#FF5934]/50 hover:text-[#FF5934] ml-1"><MdClose size={13} /></button>
                </div>
              )}
              {selectedCityObj && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
                  <MdLocationOn size={12} className="text-blue-500" />
                  <span className="text-[12px] font-semibold text-blue-600">{selectedCityObj.name}</span>
                  <button onClick={() => setSelectedCity("all")} className="text-blue-400 hover:text-blue-600 ml-1"><MdClose size={13} /></button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-[#FF5934] border-t-transparent rounded-full animate-spin" />
              <p className="text-[13px] text-[#9CA3AF]">Fetching route data for all salespersons…</p>
            </div>
          ) : !generated ? (
            <div className="py-20 text-center flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                <MdMap size={24} className="text-gray-300" />
              </div>
              <p className="text-[#9CA3AF] text-sm font-medium">Click Generate Report to load route history</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                <MdMyLocation size={24} className="text-gray-300" />
              </div>
              <p className="text-[#9CA3AF] text-sm font-medium">No route data found</p>
              <p className="text-[#C4C9D4] text-xs">Try a different filter or date range</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-gray-100">
                    {['#', 'Sales Person', 'Day / Date', 'Location', 'Actions'].map(h => (
                      <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(({ sp, day, dayIndex }, i) => (
                    <tr key={`${sp._id}-${dayIndex}`} className="table-row tr-row-appear" style={{ animationDelay: `${i * 30}ms` }}>
                      {/* # */}
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-bold text-[#C4C9D4]">{i + 1}</span>
                      </td>

                      {/* Sales Person */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[#FF5934] text-[12px] font-bold">{(sp.name || "?")[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-[#111827]">{sp.name}</p>
                            <p className="text-[11px] text-[#9CA3AF]">{sp.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                            <MdCalendarToday size={14} className="text-[#FF5934]" />
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-[#111827]">{day.date || `Day ${dayIndex + 1}`}</p>
                            <p className="text-[11px] text-[#9CA3AF]">{formatDate(day.date)}</p>
                          </div>
                        </div>
                      </td>

                      {/* City */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MdLocationOn size={14} className="text-blue-400 flex-shrink-0" />
                          <span className="text-[13px] text-[#374151]">
                            {sp.city?.name || selectedCityObj?.name || 'All locations'}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3">
                        <button onClick={() => openRoute(sp, day)}
                          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-[12px] font-bold shadow-sm shadow-orange-100 transition-all">
                          <MdRoute size={14} /> Show Route
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer */}
              <div className="px-4 py-3 bg-[#FAFAFA] border-t border-gray-100 flex items-center justify-between">
                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                  {rows.length} route{rows.length !== 1 ? "s" : ""}
                  {selectedCity !== "all" && selectedCityObj ? ` · ${selectedCityObj.name}` : ""}
                </p>
                <p className="text-[11px] text-[#9CA3AF]">
                  {Object.keys(allHistory).length} salesperson{Object.keys(allHistory).length !== 1 ? "s" : ""} with data
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <RoutePreviewModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        coordinates={selectedCoords}
        shops={modalShops}
      />
    </>
  );
};

export default TrackingReports;