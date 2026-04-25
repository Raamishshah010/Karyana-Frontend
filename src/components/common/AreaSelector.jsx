import { useEffect, useRef, useState } from 'react';
import { MapPin, Trash2, Save } from 'lucide-react';

// Supports multiple polygons. Backwards compatible with a single flat array of points.
export default function AreaSelector({ onAreaChange, initialArea = [], isVisible, onClose }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonsRef = useRef([]); // store google.maps.Polygon instances
  const drawingManagerRef = useRef(null);
  const [coordinates, setCoordinates] = useState(() => normalizeInitial(initialArea));
  const [isDrawing, setIsDrawing] = useState(false);

  function normalizeInitial(area) {
    if (!Array.isArray(area)) return [];
    // If first element looks like a point, treat as single polygon
    if (area.length > 0 && area[0] && typeof area[0] === 'object' && 'lat' in area[0] && 'lng' in area[0]) {
      return [area];
    }
    // Otherwise assume already in [[{lat,lng}], ...] format
    return area;
  }

  useEffect(() => {
    if (!isVisible) return;

    if (window.google && window.google.maps && window.google.maps.drawing) {
      // Use a small timeout to ensure the DOM element mapRef is fully rendered and available
      setTimeout(initializeMap, 100);
      return;
    }

    // Check if script is already loading or exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const handleLoad = () => {
        // Add a small delay to ensure drawing library is fully loaded
        setTimeout(() => {
          if (window.google && window.google.maps && window.google.maps.drawing) {
            initializeMap();
          }
        }, 300);
      };
      
      if (window.google && window.google.maps && window.google.maps.drawing) {
        handleLoad();
      } else {
        existingScript.addEventListener('load', handleLoad);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyAuJYLmzmglhCpBYTn0BjbJhjWYg0fPEEA&libraries=drawing`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      // Add a small delay to ensure drawing library is fully loaded
      setTimeout(() => {
        if (window.google && window.google.maps && window.google.maps.drawing) {
          initializeMap();
        } else {
          console.error('Google Maps drawing library failed to load');
        }
      }, 300);
    };

    script.onerror = () => {
      console.error('Failed to load Google Maps API');
    };

    document.head.appendChild(script);
  }, [isVisible]);

  useEffect(() => {
    if (initialArea && initialArea.length > 0) {
      setCoordinates(normalizeInitial(initialArea));
    }
  }, [initialArea]);

  const initializeMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) return;

    // Check if drawing library is available
    if (!window.google.maps.drawing || !window.google.maps.drawing.DrawingManager) {
      console.error('Google Maps drawing library is not available');
      return;
    }

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 33.6844, lng: 73.0479 }, // Default to Islamabad
      zoom: 12,
      mapTypeControl: true,
      fullscreenControl: true,
      streetViewControl: true,
      zoomControl: true,
    });

    mapInstanceRef.current = map;

    // Initialize Drawing Manager
    const drawingManager = new window.google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: true,
      drawingControlOptions: {
        position: window.google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [window.google.maps.drawing.OverlayType.POLYGON]
      },
      polygonOptions: {
        fillColor: '#FF5934',
        fillOpacity: 0.3,
        strokeWeight: 2,
        strokeColor: '#FF5934',
        clickable: true,
        editable: true,
        zIndex: 1
      }
    });

    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;

    // Handle polygon completion (supports multiple polygons)
    window.google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon) => {
      setIsDrawing(false);

      polygonsRef.current.push(polygon);

      // Get coordinates from the polygon
      const path = polygon.getPath();
      const coords = [];
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        coords.push({ lat: point.lat(), lng: point.lng() });
      }

      setCoordinates(prev => [...prev, coords]);

      const index = polygonsRef.current.length - 1;
      const updateFn = () => updateCoordinatesAt(index);
      window.google.maps.event.addListener(polygon.getPath(), 'set_at', updateFn);
      window.google.maps.event.addListener(polygon.getPath(), 'insert_at', updateFn);
      window.google.maps.event.addListener(polygon.getPath(), 'remove_at', updateFn);

      // Disable drawing mode after completion
      drawingManager.setDrawingMode(null);
    });

    // Handle drawing start
    window.google.maps.event.addListener(drawingManager, 'drawingmode_changed', () => {
      if (drawingManager.getDrawingMode()) {
        setIsDrawing(true);
      }
    });

    // Load existing polygon if coordinates exist
    if (coordinates && coordinates.length > 0) {
      loadExistingPolygons(map);
    }
  };

  const updateCoordinatesAt = (index) => {
    const poly = polygonsRef.current[index];
    if (!poly) return;
    const path = poly.getPath();
    const coords = [];
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coords.push({ lat: point.lat(), lng: point.lng() });
    }
    setCoordinates(prev => prev.map((p, i) => (i === index ? coords : p)));
  };

  const loadExistingPolygons = (map) => {
    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach((coords, index) => {
      if (!Array.isArray(coords) || coords.length < 3) return;
      const polygon = new window.google.maps.Polygon({
        paths: coords,
        fillColor: '#FF5934',
        fillOpacity: 0.3,
        strokeWeight: 2,
        strokeColor: '#FF5934',
        clickable: true,
        editable: true,
        zIndex: 1
      });
      polygon.setMap(map);
      polygonsRef.current.push(polygon);
      const updateFn = () => updateCoordinatesAt(index);
      window.google.maps.event.addListener(polygon.getPath(), 'set_at', updateFn);
      window.google.maps.event.addListener(polygon.getPath(), 'insert_at', updateFn);
      window.google.maps.event.addListener(polygon.getPath(), 'remove_at', updateFn);
      coords.forEach(coord => bounds.extend(coord));
    });
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds);
    }
  };

  const clearAllPolygons = () => {
    polygonsRef.current.forEach(p => p.setMap(null));
    polygonsRef.current = [];
    setCoordinates([]);
    setIsDrawing(false);
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(null);
    }
  };

  const removeLastPolygon = () => {
    const last = polygonsRef.current.pop();
    if (last) last.setMap(null);
    setCoordinates(prev => prev.slice(0, -1));
  };

  const saveArea = () => {
    const validCount = coordinates.filter(poly => Array.isArray(poly) && poly.length >= 3).length;
    if (validCount >= 1) {
      onAreaChange(coordinates);
      onClose();
    } else {
      alert('Please draw at least one polygon (3+ points).');
    }
  };

  const startDrawing = () => {
    if (drawingManagerRef.current) {
      // Allow drawing a new polygon without clearing existing ones
      drawingManagerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin size={28} />
              <div>
                <h2 className="text-xl font-bold">Assign Area</h2>
                <p className="text-sm text-orange-100">
                  Draw a polygon to define the sales person's assigned area
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={startDrawing}
                disabled={isDrawing}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDrawing 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                <MapPin size={16} />
                {isDrawing ? 'Drawing...' : 'Draw New Area'}
              </button>
              
              <button
                onClick={removeLastPolygon}
                disabled={coordinates.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  coordinates.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                <Trash2 size={16} />
                Remove Last Area
              </button>

              <button
                onClick={clearAllPolygons}
                disabled={coordinates.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  coordinates.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                <Trash2 size={16} />
                Clear All
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Areas: {coordinates.length} · Points: {coordinates.reduce((acc, poly) => acc + (Array.isArray(poly) ? poly.length : 0), 0)}
                {coordinates.filter(poly => Array.isArray(poly) && poly.length >= 3).length < 1 && (
                  <span className="text-red-500 ml-1">(Need at least 1 valid area)</span>
                )}
              </span>
              
              <button
                onClick={saveArea}
                disabled={coordinates.filter(poly => Array.isArray(poly) && poly.length >= 3).length < 1}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
                  coordinates.filter(poly => Array.isArray(poly) && poly.length >= 3).length >= 1
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Save size={16} />
                Save Area
              </button>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />
          
          {isDrawing && (
            <div className="absolute top-4 left-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                Click on the map to start drawing the area boundary
              </div>
            </div>
          )}
        </div>


      </div>
    </div>
  );
}