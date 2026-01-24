'use client';

import { useEffect, useRef, useState } from 'react';

const loaderCache: Record<string, Promise<any>> = {};

const loadGoogleMaps = (apiKey: string): Promise<any> => {
  if (typeof window === 'undefined') return Promise.reject('No window');
  if ((window as any).google && (window as any).google.maps) {
    return Promise.resolve((window as any).google.maps);
  }
  if (apiKey in loaderCache) return loaderCache[apiKey];

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
  const [autocompleteEnabled, setAutocompleteEnabled] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      // No API key - just a regular input, no autocomplete
      console.warn('Google Maps API key missing. Address input will work without autocomplete.');
      return;
    }

    let isMounted = true;

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (!isMounted || !inputRef.current || autocompleteRef.current) return;

        try {
          autocompleteRef.current = new maps.places.Autocomplete(inputRef.current, {
            types: ['geocode', 'establishment'],
            fields: ['formatted_address', 'geometry', 'name', 'place_id'],
          });

          autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current.getPlace();

            // Only process if place has geometry (valid selection)
            if (place && place.geometry && place.formatted_address) {
              const placeData = {
                address: place.formatted_address,
                name: place.name || place.formatted_address, // Use name, fallback to address
                placeId: place.place_id || '',
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              };

              // Set input value to the place NAME (not address) - this is what user sees
              const displayValue = placeData.name;
              
              // Trigger onChange to update React state with the name
              if (inputRef.current) {
                const syntheticEvent = {
                  target: { value: displayValue },
                } as React.ChangeEvent<HTMLInputElement>;
                onChange(syntheticEvent);
              }

              // Call onPlaceSelected callback with full place data (name + address)
              if (onPlaceSelected) {
                onPlaceSelected(placeData);
              }
            }
          });

          setAutocompleteEnabled(true);
        } catch (error: any) {
          console.warn('Failed to initialize Google Places Autocomplete:', error?.message || error);
          // Fallback: input still works, just without autocomplete
          // This can happen if:
          // - API key restrictions block this domain
          // - Places API not enabled for this project
        }
      })
      .catch((error) => {
        console.warn('Google Maps autocomplete unavailable:', error.message || error);
        // Fallback: input still works, just without autocomplete
        // Common errors:
        // - RefererNotAllowedMapError: Domain not authorized in Google Cloud Console
        // - Missing API key: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set
        // - Network error: Failed to load Google Maps script
      });

    return () => {
      isMounted = false;
      if (autocompleteRef.current) {
        try {
          (window as any).google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [onChange, onPlaceSelected]);

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

