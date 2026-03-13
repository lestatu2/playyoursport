import { useEffect, useMemo, useState } from 'react'
import SignaturePadField from './SignaturePadField'
import type { PublicSession } from '../lib/auth'
import { getUsers, registerProspectPublic } from '../lib/auth'
import type { OpenDayEdition, OpenDayProduct } from '../lib/open-day-catalog'
import { getOpenDayGroups, getOpenDaySessions } from '../lib/open-day-catalog'
import type { OpenDayScenarioConfig } from '../lib/open-day-scenarios'
import {
  createOpenDayAdultAthlete,
  createOpenDayMinorAthlete,
  createOpenDayParticipation,
  createOpenDayProspect,
  findOpenDayMinorAthleteByIdentity,
  findOpenDayProspectByIdentity,
  getOpenDayMinorAthletesByProspectId,
  getOpenDayProspectByUserId,
  type OpenDayMinorAthlete,
} from '../lib/open-day-records'
import { getFields } from '../lib/package-catalog'
import { getPublicClients, getPublicMinors } from '../lib/public-customer-records'

type Props = {
  product: OpenDayProduct
  edition: OpenDayEdition
  session: PublicSession | null
  scenarioConfig: OpenDayScenarioConfig
  selectedExistingMinorToken?: string | null
  onClose: () => void
  onCompleted?: (message: string) => void
}

type StepId = 'account' | 'participant' | 'sessions' | 'consents' | 'confirm'

type Draft = {
  accountFirstName: string
  accountLastName: string
  accountEmail: string
  accountPhone: string
  accountBirthDate: string
  accountGender: 'M' | 'F'
  accountRole: 'self' | 'parent' | 'guardian' | 'holder_of_parental_responsibility'
  login: string
  password: string
  adultFirstName: string
  adultLastName: string
  adultBirthDate: string
  adultGender: 'M' | 'F'
  adultEmail: string
  adultPhone: string
  minorFirstName: string
  minorLastName: string
  minorBirthDate: string
  minorGender: 'M' | 'F'
  selectedSessionIds: string[]
  consentEnrollmentAccepted: boolean
  consentInformationAccepted: boolean
  consentDataProcessingAccepted: boolean
  consentDataProcessingSignatureDataUrl: string
  enrollmentConfirmationSignatureDataUrl: string
}

const EMPTY_DRAFT: Draft = {
  accountFirstName: '',
  accountLastName: '',
  accountEmail: '',
  accountPhone: '',
  accountBirthDate: '',
  accountGender: 'F',
  accountRole: 'parent',
  login: '',
  password: '',
  adultFirstName: '',
  adultLastName: '',
  adultBirthDate: '',
  adultGender: 'F',
  adultEmail: '',
  adultPhone: '',
  minorFirstName: '',
  minorLastName: '',
  minorBirthDate: '',
  minorGender: 'M',
  selectedSessionIds: [],
  consentEnrollmentAccepted: false,
  consentInformationAccepted: false,
  consentDataProcessingAccepted: false,
  consentDataProcessingSignatureDataUrl: '',
  enrollmentConfirmationSignatureDataUrl: '',
}

function buildAutoLogin(firstName: string, lastName: string, birthDate: string): string {
  const clean = (value: string) =>
    value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
  const base = `${clean(firstName) || 'utente'}.${clean(lastName) || 'utente'}`
  const users = new Set(getUsers().map((user) => user.login.toLowerCase()))
  if (!users.has(base)) {
    return base
  }
  const suffix = birthDate.slice(2, 4) || '00'
  let next = `${base}${suffix}`
  let counter = 2
  while (users.has(next)) {
    next = `${base}${suffix}${counter}`
    counter += 1
  }
  return next
}

function birthYear(value: string): number | null {
  const year = Number.parseInt(value.slice(0, 4), 10)
  return Number.isInteger(year) ? year : null
}

function PublicOpenDayForm({ product, edition, session, scenarioConfig, selectedExistingMinorToken, onClose, onCompleted }: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [step, setStep] = useState<StepId>('account')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const existingProspect = useMemo(() => (session ? getOpenDayProspectByUserId(session.userId) : null), [session])
  const clientRecord = useMemo(
    () => (session?.role === 'client' ? getPublicClients().find((item) => item.userId === session.userId) ?? null : null),
    [session],
  )
  const stepOrder = useMemo<StepId[]>(() => {
    const items: StepId[] = []
    if (scenarioConfig.requiresAccountStep || scenarioConfig.requiresGuardianStep) {
      items.push('account')
    }
    if (scenarioConfig.requiresParticipantStep) {
      items.push('participant')
    }
    items.push('sessions', 'consents', 'confirm')
    return items
  }, [scenarioConfig.requiresAccountStep, scenarioConfig.requiresGuardianStep, scenarioConfig.requiresParticipantStep])
  const fieldTitleById = useMemo(() => new Map(getFields().map((field) => [field.id, field.title])), [])

  const selectedExistingMinor = useMemo(() => {
    if (!selectedExistingMinorToken) {
      return null
    }
    const parts = selectedExistingMinorToken.split('-')
    const source = parts[0]
    const numericId = Number.parseInt(parts[2] ?? '', 10)
    if (!Number.isInteger(numericId)) {
      return null
    }
    if (source === 'prospect' && existingProspect) {
      return getOpenDayMinorAthletesByProspectId(existingProspect.id).find((item) => item.id === numericId) ?? null
    }
    if (source === 'client') {
      return getPublicMinors().find((item) => item.id === numericId) ?? null
    }
    return null
  }, [existingProspect, selectedExistingMinorToken])

  const availableSessions = useMemo(() => {
    const groups = getOpenDayGroups().filter((group) => group.openDayEditionId === edition.id && group.isActive)
    const sessions = getOpenDaySessions().filter((item) => item.isActive)
    const participantBirthDate =
      product.audience === 'adult'
        ? draft.adultBirthDate || draft.accountBirthDate
        : selectedExistingMinor?.birthDate || draft.minorBirthDate
    const participantGender =
      product.audience === 'adult'
        ? draft.adultGender || draft.accountGender
        : ('gender' in (selectedExistingMinor ?? {}) ? selectedExistingMinor?.gender : undefined) ?? draft.minorGender
    const participantBirthYear = birthYear(participantBirthDate)
    return groups.flatMap((group) => {
      if (participantBirthYear !== null && (participantBirthYear < group.birthYearMin || participantBirthYear > group.birthYearMax)) {
        return []
      }
      if (group.gender !== 'mixed') {
        const expectedGender = group.gender === 'female' ? 'F' : 'M'
        if ((participantGender ?? 'M') !== expectedGender) {
          return []
        }
      }
      return sessions.filter((item) => item.groupId === group.id).map((item) => ({
        ...item,
        groupTitle: group.title,
        fieldTitle: fieldTitleById.get(group.fieldId) ?? group.fieldId,
      }))
    })
  }, [
    draft.accountBirthDate,
    draft.accountGender,
    draft.adultBirthDate,
    draft.adultGender,
    draft.minorBirthDate,
    draft.minorGender,
    edition.id,
    fieldTitleById,
    product.audience,
    selectedExistingMinor,
  ])

  useEffect(() => {
    if (session?.role === 'prospect' && existingProspect) {
      setDraft((prev) => ({
        ...prev,
        accountFirstName: existingProspect.firstName,
        accountLastName: existingProspect.lastName,
        accountEmail: existingProspect.email,
        accountPhone: existingProspect.phone,
        accountBirthDate: existingProspect.birthDate,
        accountGender: existingProspect.gender === 'M' ? 'M' : 'F',
        accountRole: existingProspect.role,
        adultFirstName: existingProspect.firstName,
        adultLastName: existingProspect.lastName,
        adultBirthDate: existingProspect.birthDate,
        adultGender: existingProspect.gender === 'M' ? 'M' : 'F',
        adultEmail: existingProspect.email,
        adultPhone: existingProspect.phone,
      }))
    } else if (session?.role === 'client' && clientRecord) {
      setDraft((prev) => ({
        ...prev,
        accountFirstName: clientRecord.parentFirstName,
        accountLastName: clientRecord.parentLastName,
        accountEmail: clientRecord.parentEmail,
        accountPhone: clientRecord.parentPhone,
        accountBirthDate: clientRecord.parentBirthDate,
        accountGender: clientRecord.parentGender === 'M' ? 'M' : 'F',
        adultFirstName: clientRecord.parentFirstName,
        adultLastName: clientRecord.parentLastName,
        adultBirthDate: clientRecord.parentBirthDate,
        adultGender: clientRecord.parentGender === 'M' ? 'M' : 'F',
        adultEmail: clientRecord.parentEmail,
        adultPhone: clientRecord.parentPhone,
      }))
    }
  }, [clientRecord, existingProspect, session])

  useEffect(() => {
    if (session) {
      return
    }
    const next = buildAutoLogin(draft.accountFirstName, draft.accountLastName, draft.accountBirthDate)
    setDraft((prev) => (prev.login === next ? prev : { ...prev, login: next }))
  }, [draft.accountBirthDate, draft.accountFirstName, draft.accountLastName, session])

  useEffect(() => {
    setStep((current) => (stepOrder.includes(current) ? current : stepOrder[0] ?? 'account'))
  }, [stepOrder])

  const validateStep = (target: StepId): boolean => {
    if (target === 'account') {
      if (!draft.accountFirstName.trim() || !draft.accountLastName.trim() || !draft.accountEmail.trim() || !draft.accountPhone.trim() || !draft.accountBirthDate.trim()) {
        setError('Compila i dati del prospect/tutore.')
        return false
      }
      if (!session && !draft.password.trim()) {
        setError('Inserisci la password del prospect.')
        return false
      }
      if (!session) {
        const existingByIdentity = findOpenDayProspectByIdentity({
          email: draft.accountEmail,
          firstName: draft.accountFirstName,
          lastName: draft.accountLastName,
          birthDate: draft.accountBirthDate,
        })
        if (existingByIdentity) {
          setError('I tuoi dati risultano gia presenti. Effettua il login per continuare.')
          return false
        }
        const existingClient = getPublicClients().find(
          (item) =>
            item.parentEmail.trim().toLowerCase() === draft.accountEmail.trim().toLowerCase() &&
            item.parentFirstName.trim().toLowerCase() === draft.accountFirstName.trim().toLowerCase() &&
            item.parentLastName.trim().toLowerCase() === draft.accountLastName.trim().toLowerCase() &&
            item.parentBirthDate === draft.accountBirthDate,
        )
        if (existingClient) {
          setError('I tuoi dati risultano gia presenti. Effettua il login per continuare.')
          return false
        }
      }
      return true
    }
    if (target === 'participant') {
      if (product.audience === 'adult') {
        if (!draft.adultFirstName.trim() || !draft.adultLastName.trim() || !draft.adultBirthDate.trim() || !draft.adultEmail.trim() || !draft.adultPhone.trim()) {
          setError('Compila i dati dell atleta adulto.')
          return false
        }
      } else if (!selectedExistingMinor && (!draft.minorFirstName.trim() || !draft.minorLastName.trim() || !draft.minorBirthDate.trim())) {
        setError('Compila i dati del minore.')
        return false
      }
      return true
    }
    if (target === 'sessions' && draft.selectedSessionIds.length === 0) {
      setError('Seleziona almeno una sessione.')
      return false
    }
    if (target === 'consents') {
      if (!draft.consentEnrollmentAccepted || !draft.consentInformationAccepted || !draft.consentDataProcessingAccepted) {
        setError('Completa tutti i consensi.')
        return false
      }
      if (!draft.consentDataProcessingSignatureDataUrl || !draft.enrollmentConfirmationSignatureDataUrl) {
        setError('Le firme sono obbligatorie.')
        return false
      }
    }
    return true
  }

  const submit = () => {
    setError('')
    for (const item of stepOrder) {
      if (!validateStep(item)) {
        setStep(item)
        return
      }
    }
    setIsSubmitting(true)
    try {
      let prospect = existingProspect
      let userId = session?.userId ?? null
      if (!session) {
        const created = registerProspectPublic({
          firstName: draft.accountFirstName,
          lastName: draft.accountLastName,
          email: draft.accountEmail,
          login: draft.login,
          password: draft.password,
        })
        if (!created.ok) {
          setError('Impossibile creare il prospect.')
          return
        }
        userId = created.user.id
      }
      if (!prospect) {
        prospect = createOpenDayProspect({
          userId,
          linkedClientId: clientRecord?.id ?? null,
          firstName: draft.accountFirstName,
          lastName: draft.accountLastName,
          email: draft.accountEmail,
          phone: draft.accountPhone,
          secondaryPhone: '',
          birthDate: draft.accountBirthDate,
          gender: draft.accountGender,
          role: product.audience === 'adult' ? 'self' : draft.accountRole,
        })
      }
      let adultAthleteId: number | null = null
      let minorAthleteId: number | null = null
      if (product.audience === 'adult') {
        adultAthleteId = createOpenDayAdultAthlete({
          prospectId: prospect.id,
          linkedDirectAthleteId: null,
          firstName: draft.adultFirstName,
          lastName: draft.adultLastName,
          birthDate: draft.adultBirthDate,
          gender: draft.adultGender,
          email: draft.adultEmail,
          phone: draft.adultPhone,
        }).id
      } else if (selectedExistingMinor && 'clientId' in selectedExistingMinor) {
        const sourceMinor = selectedExistingMinor
        minorAthleteId =
          findOpenDayMinorAthleteByIdentity({
            prospectId: prospect.id,
            firstName: sourceMinor.firstName,
            lastName: sourceMinor.lastName,
            birthDate: sourceMinor.birthDate,
          })?.id ??
          createOpenDayMinorAthlete({
            prospectId: prospect.id,
            linkedMinorId: sourceMinor.id,
            firstName: sourceMinor.firstName,
            lastName: sourceMinor.lastName,
            birthDate: sourceMinor.birthDate,
            gender: sourceMinor.gender,
          }).id
      } else if (selectedExistingMinor && 'prospectId' in selectedExistingMinor) {
        minorAthleteId = (selectedExistingMinor as OpenDayMinorAthlete).id
      } else {
        minorAthleteId =
          findOpenDayMinorAthleteByIdentity({
            prospectId: prospect.id,
            firstName: draft.minorFirstName,
            lastName: draft.minorLastName,
            birthDate: draft.minorBirthDate,
          })?.id ??
          createOpenDayMinorAthlete({
            prospectId: prospect.id,
            linkedMinorId: null,
            firstName: draft.minorFirstName,
            lastName: draft.minorLastName,
            birthDate: draft.minorBirthDate,
            gender: draft.minorGender,
          }).id
      }
      createOpenDayParticipation({
        openDayEditionId: edition.id,
        productId: product.id,
        editionYear: edition.editionYear,
        prospectId: prospect.id,
        participantType: product.audience === 'adult' ? 'adult' : 'minor',
        adultAthleteId,
        minorAthleteId,
        selectedSessionIds: draft.selectedSessionIds,
        consentEnrollmentAccepted: draft.consentEnrollmentAccepted,
        consentInformationAccepted: draft.consentInformationAccepted,
        consentDataProcessingAccepted: draft.consentDataProcessingAccepted,
        consentDataProcessingSignatureDataUrl: draft.consentDataProcessingSignatureDataUrl,
        enrollmentConfirmationSignatureDataUrl: draft.enrollmentConfirmationSignatureDataUrl,
      })
      const message = session ? 'Partecipazione open day registrata correttamente.' : 'Richiesta open day registrata. Prospect creato correttamente.'
      setSuccessMessage(message)
      onCompleted?.(message)
      setStep('confirm')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col p-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide opacity-70">Open Day</p>
        <h3 className="text-2xl font-semibold">{product.name}</h3>
        <p className="text-sm opacity-70">Edizione {edition.editionYear}</p>
      </div>
      <ul className="steps mb-6 w-full">
        {stepOrder.map((item) => <li key={item} className={`step ${stepOrder.indexOf(step) >= stepOrder.indexOf(item) ? 'step-primary' : ''}`}>{item}</li>)}
      </ul>
      <div className="flex-1 overflow-y-auto">
        {step === 'account' ? <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control"><span className="label-text mb-1 text-xs">Nome</span><input className="input input-bordered w-full" value={draft.accountFirstName} onChange={(event) => setDraft((prev) => ({ ...prev, accountFirstName: event.target.value }))} /></label>
          <label className="form-control"><span className="label-text mb-1 text-xs">Cognome</span><input className="input input-bordered w-full" value={draft.accountLastName} onChange={(event) => setDraft((prev) => ({ ...prev, accountLastName: event.target.value }))} /></label>
          <label className="form-control"><span className="label-text mb-1 text-xs">Email</span><input className="input input-bordered w-full" type="email" value={draft.accountEmail} onChange={(event) => setDraft((prev) => ({ ...prev, accountEmail: event.target.value }))} /></label>
          <label className="form-control"><span className="label-text mb-1 text-xs">Telefono</span><input className="input input-bordered w-full" value={draft.accountPhone} onChange={(event) => setDraft((prev) => ({ ...prev, accountPhone: event.target.value }))} /></label>
          <label className="form-control"><span className="label-text mb-1 text-xs">Data di nascita</span><input className="input input-bordered w-full" type="date" value={draft.accountBirthDate} onChange={(event) => setDraft((prev) => ({ ...prev, accountBirthDate: event.target.value }))} /></label>
          {!session ? <><label className="form-control"><span className="label-text mb-1 text-xs">Login</span><input className="input input-bordered w-full" value={draft.login} readOnly /></label><label className="form-control"><span className="label-text mb-1 text-xs">Password</span><input className="input input-bordered w-full" type="password" value={draft.password} onChange={(event) => setDraft((prev) => ({ ...prev, password: event.target.value }))} /></label></> : null}
        </div> : null}
        {step === 'participant' ? (product.audience === 'adult' ? <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control"><span className="label-text mb-1 text-xs">Nome atleta</span><input className="input input-bordered w-full" value={draft.adultFirstName} onChange={(event) => setDraft((prev) => ({ ...prev, adultFirstName: event.target.value }))} /></label>
          <label className="form-control"><span className="label-text mb-1 text-xs">Cognome atleta</span><input className="input input-bordered w-full" value={draft.adultLastName} onChange={(event) => setDraft((prev) => ({ ...prev, adultLastName: event.target.value }))} /></label>
          <label className="form-control"><span className="label-text mb-1 text-xs">Data nascita</span><input className="input input-bordered w-full" type="date" value={draft.adultBirthDate} onChange={(event) => setDraft((prev) => ({ ...prev, adultBirthDate: event.target.value }))} /></label>
          <label className="form-control"><span className="label-text mb-1 text-xs">Email</span><input className="input input-bordered w-full" type="email" value={draft.adultEmail} onChange={(event) => setDraft((prev) => ({ ...prev, adultEmail: event.target.value }))} /></label>
          <label className="form-control"><span className="label-text mb-1 text-xs">Telefono</span><input className="input input-bordered w-full" value={draft.adultPhone} onChange={(event) => setDraft((prev) => ({ ...prev, adultPhone: event.target.value }))} /></label>
        </div> : selectedExistingMinor ? <div className="rounded-lg border border-base-300 p-4 text-sm">{selectedExistingMinor.firstName} {selectedExistingMinor.lastName} - {selectedExistingMinor.birthDate}</div> : <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control"><span className="label-text mb-1 text-xs">Nome minore</span><input className="input input-bordered w-full" value={draft.minorFirstName} onChange={(event) => setDraft((prev) => ({ ...prev, minorFirstName: event.target.value }))} /></label>
          <label className="form-control"><span className="label-text mb-1 text-xs">Cognome minore</span><input className="input input-bordered w-full" value={draft.minorLastName} onChange={(event) => setDraft((prev) => ({ ...prev, minorLastName: event.target.value }))} /></label>
          <label className="form-control"><span className="label-text mb-1 text-xs">Data nascita</span><input className="input input-bordered w-full" type="date" value={draft.minorBirthDate} onChange={(event) => setDraft((prev) => ({ ...prev, minorBirthDate: event.target.value }))} /></label>
        </div>) : null}
        {step === 'sessions' ? <div className="space-y-3">{availableSessions.length === 0 ? <div className="rounded-lg border border-base-300 p-4 text-sm opacity-80">Nessuna sessione disponibile per il profilo selezionato.</div> : availableSessions.map((item) => <label key={item.id} className="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300 px-4 py-3"><input type="checkbox" className="checkbox checkbox-primary" checked={draft.selectedSessionIds.includes(item.id)} onChange={(event) => setDraft((prev) => ({ ...prev, selectedSessionIds: event.target.checked ? [...prev.selectedSessionIds, item.id] : prev.selectedSessionIds.filter((sessionId) => sessionId !== item.id) }))} /><span className="label-text"><span className="block font-medium">{item.groupTitle}</span><span className="block text-sm opacity-80">{item.fieldTitle}</span><span className="block text-sm opacity-80">{item.date} ore {item.startTime} - {item.endTime}</span></span></label>)}</div> : null}
        {step === 'consents' ? <div className="space-y-4">
          <label className="label cursor-pointer justify-start gap-2 rounded-lg border border-base-300 px-3 py-3"><input type="checkbox" className="checkbox checkbox-primary" checked={draft.consentEnrollmentAccepted} onChange={(event) => setDraft((prev) => ({ ...prev, consentEnrollmentAccepted: event.target.checked }))} /><span className="label-text">Confermo la richiesta di partecipazione all open day</span></label>
          <label className="label cursor-pointer justify-start gap-2 rounded-lg border border-base-300 px-3 py-3"><input type="checkbox" className="checkbox checkbox-primary" checked={draft.consentInformationAccepted} onChange={(event) => setDraft((prev) => ({ ...prev, consentInformationAccepted: event.target.checked }))} /><span className="label-text">Prendo visione dell informativa privacy</span></label>
          <label className="label cursor-pointer justify-start gap-2 rounded-lg border border-base-300 px-3 py-3"><input type="checkbox" className="checkbox checkbox-primary" checked={draft.consentDataProcessingAccepted} onChange={(event) => setDraft((prev) => ({ ...prev, consentDataProcessingAccepted: event.target.checked }))} /><span className="label-text">Acconsento al trattamento dati</span></label>
          <SignaturePadField label="Firma consenso trattamento dati" value={draft.consentDataProcessingSignatureDataUrl} onChange={(value) => setDraft((prev) => ({ ...prev, consentDataProcessingSignatureDataUrl: value }))} />
          <SignaturePadField label="Firma conferma partecipazione" value={draft.enrollmentConfirmationSignatureDataUrl} onChange={(value) => setDraft((prev) => ({ ...prev, enrollmentConfirmationSignatureDataUrl: value }))} />
        </div> : null}
        {step === 'confirm' ? <div className="space-y-4"><div className="rounded-lg border border-base-300 p-4"><h4 className="font-semibold">Riepilogo open day</h4><p className="mt-2 text-sm">{product.name}</p><p className="text-sm opacity-70">Edizione {edition.editionYear}</p></div>{successMessage ? <p className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success">{successMessage}</p> : null}</div> : null}
      </div>
      <div className="mt-4 border-t border-base-300 pt-4">
        {error ? <p className="mb-3 rounded-lg bg-error/15 px-3 py-2 text-sm text-error">{error}</p> : null}
        <div className="flex items-center justify-between">
          <button type="button" className="btn btn-ghost" onClick={step === stepOrder[0] ? onClose : () => setStep(stepOrder[Math.max(0, stepOrder.indexOf(step) - 1)] ?? stepOrder[0])} disabled={isSubmitting}>{step === stepOrder[0] ? 'Chiudi' : 'Indietro'}</button>
          {step !== stepOrder[stepOrder.length - 1] ? <button type="button" className="btn btn-primary" onClick={() => { if (!validateStep(step)) { return } setStep(stepOrder[Math.min(stepOrder.length - 1, stepOrder.indexOf(step) + 1)] ?? step) }}>Continua</button> : <button type="button" className="btn btn-primary" onClick={submit} disabled={isSubmitting}>{isSubmitting ? 'Invio...' : 'Invia richiesta open day'}</button>}
        </div>
      </div>
    </div>
  )
}

export default PublicOpenDayForm
