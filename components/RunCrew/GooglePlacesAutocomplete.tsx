'use client';

import { useEffect, useRef } from 'react';

const loaderCache: Record<string, Promise<any>> = {};

const loadGoogleMaps = (apiKey: string): Promise<any> => {
  if (typeof window === 'undefined') return Promise.reject('No window');
  if ((window as any).google && (window as any).google.maps) {
    return Promise.resolve((window as any).google.maps);
  }
  if (loaderCache[apiKey]) return loaderCache[apiKey];

  loaderCache[apiKey] = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-maps-loader="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).google.maps));
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = 'true';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.onload = () => resolve((window as any).google.maps);
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.body.appendChild(script);
  });

  return loaderCache[apiKey];
};

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPlaceSelected?: (placeData: {
    address: string;
    name: string;
    placeId: string;
    lat: number;
    lng: number;
  }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Enter address...',
  className = '',
  disabled = false,
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key missing. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
      return;
    }

    let isMounted = true;

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (!isMounted || !inputRef.current || autocompleteRef.current) return;

        autocompleteRef.current = new maps.places.Autocomplete(inputRef.current, {
          types: ['geocode', 'establishment'],
          fields: ['formatted_address', 'geometry', 'name', 'place_id'],
        });

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current.getPlace();

          if (place && place.geometry) {
            const placeData = {
              address: place.formatted_address || '',
              name: place.name || '',
              placeId: place.place_id || '',
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            };

            if (onPlaceSelected) {
              onPlaceSelected(placeData);
            }
          }
        });
      })
      .catch((error) => {
        console.error('Failed to load Google Maps autocomplete:', error);
      });

    return () => {
      isMounted = false;
      if (autocompleteRef.current) {
        (window as any).google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [onPlaceSelected]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
}

