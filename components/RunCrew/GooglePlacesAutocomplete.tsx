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

export type GooglePlaceSelectedData = {
  address: string;
  name: string;
  placeId: string;
  lat: number;
  lng: number;
  addressComponents?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
};

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPlaceSelected?: (placeData: GooglePlaceSelectedData) => void;
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
  const onChangeRef = useRef(onChange);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const [inputValue, setInputValue] = useState(value);
  const isPlaceSelectedRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onPlaceSelectedRef.current = onPlaceSelected;
  }, [onPlaceSelected]);

  useEffect(() => {
    if (!isPlaceSelectedRef.current) {
      setInputValue(value);
    }
    isPlaceSelectedRef.current = false;
  }, [value]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key missing. Address input will work without autocomplete.');
      return;
    }

    if (!inputRef.current || autocompleteRef.current) {
      return;
    }

    let isMounted = true;

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (!isMounted || !inputRef.current || autocompleteRef.current) return;

        try {
          autocompleteRef.current = new maps.places.Autocomplete(inputRef.current, {
            types: ['geocode', 'establishment'],
            fields: [
              'formatted_address',
              'geometry',
              'name',
              'place_id',
              'address_components',
            ],
          });

          autocompleteRef.current.addListener('place_changed', () => {
            if (!isMounted || !inputRef.current) return;

            const place = autocompleteRef.current.getPlace();

            if (place && place.geometry && place.formatted_address) {
              const placeData: GooglePlaceSelectedData = {
                address: place.formatted_address,
                name: place.name || place.formatted_address,
                placeId: place.place_id || '',
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                addressComponents: place.address_components ?? undefined,
              };

              const displayValue = placeData.name;
              setInputValue(displayValue);
              isPlaceSelectedRef.current = true;

              const syntheticEvent = {
                target: { value: displayValue },
              } as React.ChangeEvent<HTMLInputElement>;
              onChangeRef.current(syntheticEvent);

              onPlaceSelectedRef.current?.(placeData);
            }
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn('Failed to initialize Google Places Autocomplete:', message);
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('Google Maps autocomplete unavailable:', message);
      });

    return () => {
      isMounted = false;
      if (autocompleteRef.current) {
        try {
          (window as any).google?.maps?.event?.clearInstanceListeners(
            autocompleteRef.current
          );
        } catch {
          // Ignore cleanup errors
        }
        autocompleteRef.current = null;
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onChange(e);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={inputValue}
      onChange={handleInputChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
}
