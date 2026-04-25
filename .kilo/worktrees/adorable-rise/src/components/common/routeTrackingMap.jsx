import { useEffect, useRef, useState } from 'react';
import { Navigation, ArrowLeft } from 'lucide-react';
import { db, doc, onSnapshot, collection, query, orderBy } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { getAllRetailers } from '../../APIS';
import shopIcon from '../../assets/karyana-icon.png';

export default function RouteTrackingMap({ salesId }) {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [error, setError] = useState(null);
  const [locationData, setLocationData] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [previousMarkerPosition, setPreviousMarkerPosition] = useState(null);
  const [shops, setShops] = useState([]);
  
  // Refs for Google Maps objects
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const animationRef = useRef(null);
  const shopMarkersRef = useRef([]);

  // Function to fetch shops data
  const fetchShops = async () => {
    try {
      const response = await getAllRetailers();
      if (response.data && response.data.msg === "success") {
        // Filter shops by salesId if provided
        const allShops = response.data.data || [];
        const filteredShops = salesId 
          ? allShops.filter(shop => shop.salesPersonID && (shop.salesPersonID._id === salesId || shop.salesPersonID === salesId))
          : allShops;
        setShops(filteredShops);
      }
    } catch (err) {
      console.error("Error fetching shops:", err);
    }
  };

  // Add shop markers to map
  const addShopMarkers = (map, shopsList) => {
    // Clear existing shop markers
    shopMarkersRef.current.forEach(m => m.setMap(null));
    shopMarkersRef.current = [];

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

  useEffect(() => {
    fetchShops();
  }, [salesId]);

  useEffect(() => {
    if (window.google && window.google.maps) {
      initializeMap();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAuJYLmzmglhCpBYTn0BjbJhjWYg0fPEEA`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      initializeMap();
    };
    
    script.onerror = () => {
      setError('Failed to load Google Maps. Please check your API key.');
    };

    document.head.appendChild(script);
  }, []);

  // Update shop markers when map is ready or shops data changes
  useEffect(() => {
    if (mapInstanceRef.current && shops.length > 0) {
      addShopMarkers(mapInstanceRef.current, shops);
    }
  }, [shops]);

  // Function to animate marker smoothly between two points
  const animateMarker = (fromPosition, toPosition, duration = 2000) => {
    if (!markerRef.current) return;

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startTime = Date.now();
    const startLat = fromPosition.lat;
    const startLng = fromPosition.lng;
    const endLat = toPosition.lat;
    const endLng = toPosition.lng;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use easing function for smooth animation
      const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      const currentLat = startLat + (endLat - startLat) * easeProgress;
      const currentLng = startLng + (endLng - startLng) * easeProgress;

      markerRef.current.setPosition({ lat: currentLat, lng: currentLng });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animate();
  };

  // Firebase real-time listener for location updates
  useEffect(() => {
    if (!salesId) return;

    setIsTracking(true);
    const locationRef = doc(db, 'LocationCollection', salesId);
    
    const unsubscribe = onSnapshot(locationRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const newLocation = {
          lat: data.latitude,
          lng: data.longitude,
          timestamp: data.updatedAt || data.createdAt,
          userId: data.userId
        };
        
        setCurrentLocation(newLocation);
        setLocationData(prev => {
          const updated = [...prev, newLocation];
          // Keep only last 100 points to avoid performance issues
          return updated.slice(-100);
        });
      }
    }, (error) => {
      console.error("Error listening to location updates:", error);
      setError("Failed to connect to live tracking. Please check your connection.");
    });

    return () => {
      unsubscribe();
      setIsTracking(false);
      // Cancel any ongoing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [salesId]);

  const initializeMap = () => {
    if (mapRef.current && window.google) {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 33.6844, lng: 73.0479 },
        zoom: 16,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      // Polyline removed - no tracking line needed

      // Initialize marker for current position
      markerRef.current = new window.google.maps.Marker({
        position: { lat: 33.6844, lng: 73.0479 }, // Initial position
        map: map,
        title: 'Current Location',
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="32" height="48" viewBox="0 0 32 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 0C7.163 0 0 7.163 0 16C0 24.837 16 48 16 48S32 24.837 32 16C32 7.163 24.837 0 16 0Z" fill="#FF5934"/>
              <circle cx="16" cy="16" r="8" fill="white"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(32, 48),
          anchor: new window.google.maps.Point(16, 48)
        }
      });
    }
  };

  // Update map when location data changes with smooth animation
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !currentLocation) return;
    
    const newPosition = { lat: currentLocation.lat, lng: currentLocation.lng };
    
    if (previousMarkerPosition) {
      // Animate from previous position to new position
      animateMarker(previousMarkerPosition, newPosition, 2000); // 2 seconds animation
    } else {
      // First location update - set position directly
      markerRef.current.setPosition(newPosition);
      // Only center map on first location to show initial position
      mapInstanceRef.current.setCenter(newPosition);
    }
    
    // Update previous position for next animation
    setPreviousMarkerPosition(newPosition);
  }, [currentLocation]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <Navigation size={32} />
            <h2 className="text-xl font-bold">Map Error</h2>
          </div>
          <p className="text-gray-700 mb-4">{error}</p>
          <p className="text-sm text-gray-600">
            To use Google Maps Directions, you need to:
            <ol className="list-decimal ml-5 mt-2">
              <li>Get an API key from Google Cloud Console</li>
              <li>Enable Maps JavaScript API and Directions API</li>
            </ol>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/attendance-tracking')}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <Navigation size={28} />
            <div>
              <h1 className="text-2xl font-bold">Live Tracking</h1>
              <p className="text-sm text-orange-100">
                Sales ID: {salesId ? `#${salesId.slice(-6)}` : 'Not Selected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
            <span className="text-sm">
              {isTracking ? 'Live' : 'Offline'}
            </span>
            {currentLocation && (
              <div className="ml-4 text-sm">
                <div>Points: {locationData.length}</div>
                {currentLocation.timestamp && (
                  <div className="text-xs text-orange-200">
                    Last Update: {new Date(currentLocation.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div 
        ref={mapRef} 
        className="flex-1 w-full"
      />
    </div>
  );
}