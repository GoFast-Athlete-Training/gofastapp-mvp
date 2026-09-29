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
  const [inputValue, setInputValue] = useState(value);
  const isPlaceSelectedRef = useRef(false);

  // Sync local inputValue with prop value when it changes externally
  useEffect(() => {
    if (!isPlaceSelectedRef.current) {
      setInputValue(value);
    }
    isPlaceSelectedRef.current = false;
  }, [value]);

  // Initialize Google Places Autocomplete exactly once
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key missing. Address input will work without autocomplete.');
      return;
    }

    if (!inputRef.current || autocompleteRef.current) {
      return; // Already initialized or no input element
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
            if (!isMounted || !inputRef.current) return;

            const place = autocompleteRef.current.getPlace();

            // Only process if place has geometry (valid selection)
            if (place && place.geometry && place.formatted_address) {
              const placeData = {
                address: place.formatted_address,
                name: place.name || place.formatted_address,
                placeId: place.place_id || '',
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              };

              // Update local input value to show the place name
              const displayValue = placeData.name;
              setInputValue(displayValue);
              isPlaceSelectedRef.current = true;

              // Update parent state via onChange (for controlled input sync)
              if (inputRef.current) {
                const syntheticEvent = {
                  target: { value: displayValue },
                } as React.ChangeEvent<HTMLInputElement>;
                onChange(syntheticEvent);
              }

              // Call onPlaceSelected callback with full place data
              if (onPlaceSelected) {
                onPlaceSelected(placeData);
              }
            }
          });

        } catch (error: any) {
          console.warn('Failed to initialize Google Places Autocomplete:', error?.message || error);
        }
      })
      .catch((error) => {
        console.warn('Google Maps autocomplete unavailable:', error.message || error);
      });

    return () => {
      isMounted = false;
      if (autocompleteRef.current) {
        try {
          (window as any).google?.maps?.event?.clearInstanceListeners(
            autocompleteRef.current
          );
        } catch (e) {
          // Ignore cleanup errors
        }
        autocompleteRef.current = null;
      }
    };
  }, []); // Empty deps - initialize once

  // Handle manual typing - only update local state
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Update parent state for controlled input sync
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
