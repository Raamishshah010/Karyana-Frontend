/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react';
import { FaMapPin as MapPin } from 'react-icons/fa6';
export default function GoogleMapComponent(props) {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(null);
  const defaultCenter = { lat: 33.5651, lng: 73.0169 };

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

    return () => {
      // Cleanup if needed
    };
  }, [props.center]);

  const initializeMap = () => {
    if (mapRef.current && window.google) {
      const center = props.center || defaultCenter;
      const zoom = props.zoom || 12;
      
      const map = new window.google.maps.Map(mapRef.current, {
        center: center,
        zoom: zoom,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
      });

      // Add a marker at the specified location
      new window.google.maps.Marker({
        position: center,
        map: map,
        title: 'Check-in Location',
      });

      setMapLoaded(true);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <MapPin size={32} />
            <h2 className="text-xl font-bold">Map Error</h2>
          </div>
          <p className="text-gray-700 mb-4">{error}</p>
          <p className="text-sm text-gray-600">
            To use Google Maps, you need to:
            <ol className="list-decimal ml-5 mt-2">
              <li>Get an API key from Google Cloud Console</li>
              <li>Enable Maps JavaScript API</li>
            </ol>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>      
      <div 
        ref={mapRef} 
        className="w-full h-full"
        style={{ height: props.height  ? props.height : '400px' }}
      />
      
      {!mapLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}