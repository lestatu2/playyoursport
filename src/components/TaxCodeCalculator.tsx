import { useEffect, useMemo, useRef, useState } from 'react'
import { computeItalianTaxCode, findBirthPlaceCodeByName } from '../lib/tax-code'

type TaxCodeCalculatorProps = {
  firstName: string
  lastName: string
  birthDate: string
  gender: 'M' | 'F'
  birthPlace: string
  birthPlaceCode?: string
  onBirthPlaceCodeResolved?: (value: string) => void
  onApply: (value: string) => void
}

function TaxCodeCalculator({
  firstName,
  lastName,
  birthDate,
  gender,
  birthPlace,
  birthPlaceCode = '',
  onBirthPlaceCodeResolved,
  onApply,
}: TaxCodeCalculatorProps) {
  const [resolvedCode, setResolvedCode] = useState<string>('')
  const lastAppliedCfRef = useRef('')

  useEffect(() => {
    let cancelled = false
    const explicitCode = birthPlaceCode.trim().toUpperCase()
    if (/^[A-Z][0-9]{3}$/.test(explicitCode)) {
      setResolvedCode(explicitCode)
      return () => {
        cancelled = true
      }
    }
    setResolvedCode('')
    findBirthPlaceCodeByName(birthPlace)
      .then((code) => {
        if (cancelled || !code) {
          return
        }
        setResolvedCode(code)
        onBirthPlaceCodeResolved?.(code)
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedCode('')
        }
      })
    return () => {
      cancelled = true
    }
  }, [birthPlace, birthPlaceCode, onBirthPlaceCodeResolved])

  const effectiveCode = resolvedCode || birthPlaceCode.trim().toUpperCase()
  const computed = useMemo(
    () =>
      computeItalianTaxCode({
        firstName,
        lastName,
        birthDate,
        gender,
        birthPlaceCode: effectiveCode,
      }),
    [birthDate, effectiveCode, firstName, gender, lastName],
  )

  useEffect(() => {
    if (computed) {
      if (computed !== lastAppliedCfRef.current) {
        lastAppliedCfRef.current = computed
        onApply(computed)
      }
    }
  }, [computed, onApply])

  return (
    <div className="rounded-lg border border-base-300 p-3">
      <p className="text-xs opacity-70">Calcolo codice fiscale automatico</p>
      <p className="text-xs opacity-70">Codice comune: {effectiveCode || 'ricerca in corso/non trovato'}</p>
      <p className="mt-1 font-mono text-sm">{computed ?? 'Completa i dati anagrafici'}</p>
    </div>
  )
}

export default TaxCodeCalculator
