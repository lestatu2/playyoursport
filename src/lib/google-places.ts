function hasGooglePlaces(): boolean {
  const scopedWindow = window as typeof window & {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            inputField: HTMLInputElement,
            options?: { fields?: string[]; types?: string[] },
          ) => {
            addListener: (eventName: string, handler: () => void) => void
            getPlace: () => { formatted_address?: string; name?: string }
          }
        }
      }
    }
  }
  return Boolean(scopedWindow.google?.maps?.places)
}

export function loadGooglePlacesScript(apiKey: string, scriptId: string): Promise<void> {
  if (!apiKey.trim()) {
    return Promise.reject(new Error('missing-api-key'))
  }
  if (hasGooglePlaces()) {
    return Promise.resolve()
  }

  const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null
  if (existingScript) {
    if (existingScript.dataset.loaded === 'true') {
      if (hasGooglePlaces()) {
        return Promise.resolve()
      }
      return Promise.reject(new Error('google-places-not-available'))
    }
    return new Promise((resolve, reject) => {
      const onLoad = () => resolve()
      const onError = () => reject(new Error('google-places-load-error'))
      existingScript.addEventListener('load', onLoad, { once: true })
      existingScript.addEventListener('error', onError, { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey.trim())}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => reject(new Error('google-places-load-error'))
    document.head.appendChild(script)
  })
}

export function initializeGooglePlacesAutocomplete(input: {
  isOpen: boolean
  initializedRef: { current: boolean }
  inputElement: HTMLInputElement | null
  apiKey: string
  scriptId: string
  types: string[]
  onPlaceResolved: (value: string) => void
}): void {
  if (!input.isOpen || input.initializedRef.current || !input.inputElement || !input.apiKey.trim()) {
    return
  }
  loadGooglePlacesScript(input.apiKey, input.scriptId)
    .then(() => {
      const scopedWindow = window as typeof window & {
        google?: {
          maps?: {
            places?: {
              Autocomplete: new (
                inputField: HTMLInputElement,
                options?: { fields?: string[]; types?: string[] },
              ) => {
                addListener: (eventName: string, handler: () => void) => void
                getPlace: () => { formatted_address?: string; name?: string }
              }
            }
          }
        }
      }
      const places = scopedWindow.google?.maps?.places
      if (!places || input.initializedRef.current || !input.inputElement) {
        return
      }
      const autocomplete = new places.Autocomplete(input.inputElement, {
        fields: ['formatted_address', 'name'],
        types: input.types,
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        const value = (place.formatted_address ?? place.name ?? input.inputElement?.value ?? '').trim()
        if (value) {
          input.onPlaceResolved(value)
        }
      })
      input.initializedRef.current = true
    })
    .catch(() => {
      input.initializedRef.current = false
    })
}
