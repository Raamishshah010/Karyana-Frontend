import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GrFormPrevious } from 'react-icons/gr';
import { getTrackingHistoryBySalesId, getSalesPersonBySalesId, getAllRetailers } from '../APIS';
import { Loader } from '../components/common/loader';
import shopIcon from '../assets/karyana-icon.png';

// Simple modal with Google Maps polyline for a day's route
const RoutePreviewModal = ({ open, onClose, coordinates, shops }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylinesRef = useRef([]);
  const markersRef = useRef([]);
  const shopMarkersRef = useRef([]);

  // Normalize to sessions (arrays of points)
  const sessions = useMemo(() => {
    const arr = Array.isArray(coordinates) ? coordinates : [];
    return arr
      .map(s => Array.isArray(s) ? s.filter(p => p && (typeof p.lat !== 'undefined') && (typeof p.lng !== 'undefined')) : [])
      .filter(s => s.length > 0);
  }, [coordinates]);

  const defaultCenter = useMemo(() => {
    const first = sessions[0]?.[0];
    if (first) return { lat: parseFloat(first.lat), lng: parseFloat(first.lng) };
    return { lat: 33.6844, lng: 73.0479 };
  }, [sessions]);

  const clearOverlays = () => {
    polylinesRef.current.forEach(pl => pl && pl.setMap(null));
    polylinesRef.current = [];
    markersRef.current.forEach(m => m && m.setMap(null));
    markersRef.current = [];
    shopMarkersRef.current.forEach(m => m && m.setMap(null));
    shopMarkersRef.current = [];
  };

  const addShopMarkers = (map, shopsList) => {
    if (!window.google || !window.google.maps) return;

    shopsList.forEach(shop => {
      if (shop.lat && shop.lng) {
        const marker = new window.google.maps.Marker({
          position: { lat: parseFloat(shop.lat), lng: parseFloat(shop.lng) },
          map: map,
          title: shop.shopName || shop.name,
          icon: {
            url: shopIcon,
            scaledSize: new window.google.maps.Size(30, 30),
            anchor: new window.google.maps.Point(15, 15)
          }
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; font-family: sans-serif;">
              <h4 style="margin: 0 0 4px 0; font-weight: bold; color: #FF5934;">${shop.shopName || shop.name}</h4>
              <p style="margin: 0 0 2px 0; font-size: 12px;"><b>Owner:</b> ${shop.name}</p>
              <p style="margin: 0 0 2px 0; font-size: 12px;"><b>Phone:</b> ${shop.phoneNumber}</p>
              <p style="margin: 0; font-size: 12px;"><b>Address:</b> ${shop.shopAddress1 || 'N/A'}</p>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        shopMarkersRef.current.push(marker);
      }
    });
  };

  // Build a road-following path using DirectionsService.
  // Falls back to original points if routing fails.
  const buildRoadPath = async (points) => {
    const norm = points
      .map(p => ({ lat: parseFloat(p.lat), lng: parseFloat(p.lng) }))
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (norm.length < 2 || !window.google || !window.google.maps) return norm;

    const ds = new window.google.maps.DirectionsService();
    const maxWaypoints = 23; // origin+destination+23 waypoints = 25 total
    const sampleEvery = Math.max(1, Math.ceil(norm.length / (maxWaypoints + 2)));
    const sampled = norm.filter((_, i) => i % sampleEvery === 0);
    if (sampled.length < 2) return norm;

    const routeAsync = (req) => new Promise((resolve, reject) => {
      ds.route(req, (res, status) => {
        if (status === window.google.maps.DirectionsStatus.OK || status === 'OK') {
          resolve(res);
        } else {
          reject(new Error(status || 'Directions error'));
        }
      });
    });

    const chunks = [];
    let startIndex = 0;
    while (startIndex < sampled.length - 1) {
      const endIndex = Math.min(startIndex + maxWaypoints + 1, sampled.length - 1);
      const origin = sampled[startIndex];
      const destination = sampled[endIndex];
      const waypoints = sampled.slice(startIndex + 1, endIndex).map(p => ({ location: p, stopover: false }));
      chunks.push({ origin, destination, waypoints });
      startIndex = endIndex;
    }

    let path = [];
    try {
      for (const chunk of chunks) {
        const res = await routeAsync({
          origin: chunk.origin,
          destination: chunk.destination,
          waypoints: chunk.waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        });
        const overview = res?.routes?.[0]?.overview_path || [];
        if (overview.length) {
          path = path.concat(overview.map(ll => ({ lat: ll.lat(), lng: ll.lng() })));
        }
      }
    } catch (e) {
      // fall back
      return norm;
    }
    return path.length ? path : norm;
  };

  useEffect(() => {
    if (!open) return;

    const init = () => {
      if (!mapRef.current || !window.google) return;
      clearOverlays();
      const map = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: sessions.length ? 14 : 12,
        mapTypeControl: true,
        streetViewControl: true,
        zoomControl: true,
        fullscreenControl: true,
      });
      mapInstanceRef.current = map;

      const render = async () => {
        const bounds = new window.google.maps.LatLngBounds();
        
        // Add shop markers
        if (shops && shops.length > 0) {
          addShopMarkers(map, shops);
          shops.forEach(shop => {
            if (shop.lat && shop.lng) {
              bounds.extend({ lat: parseFloat(shop.lat), lng: parseFloat(shop.lng) });
            }
          });
        }

        for (let i = 0; i < sessions.length; i++) {
          const roadPath = await buildRoadPath(sessions[i]);
          if (roadPath.length) {
            // Start marker
            const startMarker = new window.google.maps.Marker({
              position: roadPath[0],
              map,
              label: { text: 'S', color: '#fff' },
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#2ECC71',
                fillOpacity: 1,
                strokeColor: '#1B5E20',
                strokeWeight: 2,
              },
            });
            markersRef.current.push(startMarker);

            // End marker
            const endMarker = new window.google.maps.Marker({
              position: roadPath[roadPath.length - 1],
              map,
              label: { text: 'E', color: '#fff' },
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#E74C3C',
                fillOpacity: 1,
                strokeColor: '#7F1D1D',
                strokeWeight: 2,
              },
            });
            markersRef.current.push(endMarker);

            const pl = new window.google.maps.Polyline({
              path: roadPath,
              geodesic: true,
              strokeColor: '#FF5934',
              strokeOpacity: 0.95,
              strokeWeight: 5,
            });
            pl.setMap(map);
            polylinesRef.current.push(pl);

            roadPath.forEach(pt => bounds.extend(pt));
          }
        }
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds);
        }
      };

      render();
    };

    if (window.google && window.google.maps) {
      init();
      return () => clearOverlays();
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAuJYLmzmglhCpBYTn0BjbJhjWYg0fPEEA`;
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.head.appendChild(script);
    return () => clearOverlays();
  }, [open, sessions, defaultCenter, shops]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] md:w-[80vw] h-[80vh] relative">
        <div className="flex items-center justify-between p-3 border-b">
          <h2 className="text-lg font-semibold">Route Preview</h2>
          <button onClick={onClose} className="px-3 py-1 bg-gray-800 text-white rounded">Close</button>
        </div>
        <div ref={mapRef} className="w-full h-[calc(80vh-60px)]" />
      </div>
    </div>
  );
};

const TrackingReport = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const salesId = searchParams.get('salesId');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salesPerson, setSalesPerson] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState([]);
  const [shops, setShops] = useState([]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        if (salesId) {
          // Fetch history
          const res = await getTrackingHistoryBySalesId(salesId, 30);
          if (res.data && res.data.msg === 'success') {
            setHistory(res.data.data || []);
          }
          
          // Fetch salesperson info
          try {
            const sp = await getSalesPersonBySalesId(salesId);
            if (sp.data && sp.data.msg === 'success') {
              setSalesPerson(sp.data.data);
            }
          } catch (err) {
            console.error('Failed to fetch salesperson', err);
          }

          // Fetch shops for this salesperson
          try {
            const shopRes = await getAllRetailers();
            if (shopRes.data && shopRes.data.msg === "success") {
              const allShops = shopRes.data.data || [];
              const filteredShops = allShops.filter(shop => 
                shop.salesPersonID && (shop.salesPersonID._id === salesId || shop.salesPersonID === salesId)
              );
              setShops(filteredShops);
            }
          } catch (err) {
            console.error('Failed to fetch shops', err);
          }
        }
      } catch (e) {
        console.error('Failed to fetch tracking history', e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [salesId]);

  const openRoute = (day) => {
    // Combine all session coordinates for the day
    const coords = (day.sessions || day.allCoordinatesArray || []).map(s => s.coordinates ? s.coordinates : s);
    setSelectedCoordinates(coords);
    setModalOpen(true);
  };

  return (
    <div className="w-full min-h-screen bg-[#F8F8F8]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="text-white text-2xl hover:bg-white/20 p-1 rounded-lg"
            aria-label="Go back"
          >
            <GrFormPrevious />
          </button>
          <div>
            <p className="text-xl font-semibold">Tracking Report</p>
            <p className="text-sm">Sales ID: {salesId || 'N/A'}</p>
          </div>
        </div>
        {salesPerson && (
          <div className="text-sm">
            <p className="font-medium">{salesPerson.name}</p>
            <p className="opacity-80">{salesPerson.phone || salesPerson.email || ''}</p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="p-4">
        <table className="w-full border-separate border-spacing-y-4">
          <thead>
            <tr className="text-left text-gray-500">
              <td>ID</td>
              <td>Day</td>
              <td>Actions</td>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="text-center p-4"><Loader /></td>
              </tr>
            ) : (history && history.length ? (
              history.map((d, idx) => (
                <tr key={idx} className="cursor-pointer">
                  <td className="p-2 bg-[#FFFFFF] font-medium">{idx + 1}</td>
                  <td className="p-2 bg-[#FFFFFF] font-medium">{d.date}</td>
                  <td className="bg-[#FFFFFF] rounded-r-xl">
                    <div className="p-2 bg-[#FFFFFF] inline-flex">
                      <button
                        className="px-3 py-1 font-semibold text-white bg-[#FF5934] rounded-md hover:bg-[#e04d2d]"
                        onClick={() => openRoute(d)}
                      >
                        Show Route
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="text-center p-4">No history available</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RoutePreviewModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        coordinates={selectedCoordinates}
        shops={shops}
      />
    </div>
  );
};

export default TrackingReport;