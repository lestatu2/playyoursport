export type ContractParty = {
  firstName: string
  lastName: string
  birthDate: string
  birthPlace: string
  taxCode: string
  residenceAddress: string
  email?: string
  phone?: string
}

export type ContractPdfPayload = {
  activity: {
    key: string
    createdAt: string
    orderNumber: string
  }
  package: {
    id: string
    editionYear: number
    name: string
    description: string
    durationType: 'single-event' | 'period'
    eventDate: string
    eventTime: string
    periodStartDate: string
    periodEndDate: string
    trainingAddress: string
    contractHeaderImage: string
    contractHeaderText: string
    contractSpecialClauses: Array<{
      id: string
      title: string
      text: string
    }>
    contractRegulation: string
  }
  contractConfig: {
    subjectTemplate: string
    economicClausesTemplate: string
    servicesAdjustmentTemplate: string
    specialClausesFormula: string
  }
  company: {
    title: string
    legalForm: string
    headquartersAddress: string
    headquartersCity: string
    headquartersPostalCode: string
    headquartersProvince: string
    headquartersCountry: string
    vatNumber: string
    pecEmail: string
    email: string
    legalRepresentativeFullName: string
    legalRepresentativeRole: string
    contractSignaturePlace: string
    delegateSignatureDataUrl: string
    iban: string
    consentMinors: string
    consentAdults: string
    consentInformationNotice: string
    consentDataProcessing: string
  }
  plan: {
    createdAt: string
    enrollmentFee: number
    recurringAmount: number
    selectedPaymentMethodCode: string
    services: Array<{
      title: string
      kind: 'fixed' | 'variable'
      enabled: boolean
      amount: number
    }>
    installments: Array<{
      id: string
      dueDate: string
      amount: number
      label: string
      paymentMethodCode: string
    }>
  }
  subject: {
    kind: 'minor' | 'adult'
    athlete: ContractParty
    signerRole: 'genitore' | 'tutore' | 'esercente_responsabilita' | 'contraente'
    guardian: ContractParty | null
  }
}

export type ConsentPdfPayload = {
  activity: {
    key: string
    createdAt: string
  }
  company: {
    title: string
    portalName: string
    headquartersAddress: string
    headquartersCity: string
    email: string
    pecEmail: string
    legalRepresentativeFullName: string
    contractSignaturePlace: string
    delegateSignatureDataUrl: string
    consentMinors: string
    consentAdults: string
    consentInformationNotice: string
    consentDataProcessing: string
  }
  subject: {
    kind: 'minor' | 'adult'
    athlete: ContractParty
    guardian: ContractParty | null
  }
  consentStatus: {
    enrollmentAccepted: boolean | null
    informationAccepted: boolean | null
    dataProcessingAccepted: boolean | null
  }
  signatures: {
    enrollmentConfirmationSignatureDataUrl: string
    dataProcessingSignatureDataUrl: string
  }
}

type DownloadResult = { ok: true } | { ok: false; error: string }

const DEFAULT_CONTRACTS_API_URL = 'http://localhost:8787'

function getContractsApiUrl(): string {
  const custom = import.meta.env.VITE_CONTRACTS_API_URL
  if (typeof custom === 'string' && custom.trim().length > 0) {
    return custom.trim().replace(/\/+$/, '')
  }
  return DEFAULT_CONTRACTS_API_URL
}

function sanitizeFilePart(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function ensureContractHeaderImage(image: string, title = 'Intestazione contratto'): string {
  const trimmed = image.trim()
  if (trimmed.length > 0) {
    return trimmed
  }
  const safeTitle = title.replace(/[<>&"']/g, ' ')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240"><rect width="1200" height="240" fill="#f3f4f6"/><rect x="24" y="24" width="1152" height="192" rx="12" fill="#ffffff" stroke="#d1d5db"/><text x="60" y="110" fill="#111827" font-family="Arial, sans-serif" font-size="34" font-weight="700">${safeTitle}</text><text x="60" y="156" fill="#6b7280" font-family="Arial, sans-serif" font-size="22">Inserire logo/intestazione aziendale nel pacchetto</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function saveBlobFile(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

async function requestPdf(
  path: string,
  payload: unknown,
  filename: string,
): Promise<DownloadResult> {
  try {
    const response = await fetch(`${getContractsApiUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      return { ok: false, error: `http_${response.status}:${text || 'pdf_generation_failed'}` }
    }

    const blob = await response.blob()
    saveBlobFile(blob, filename)
    return { ok: true }
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, error: `network_error:${error.message}` }
    }
    return { ok: false, error: 'network_error:unknown' }
  }
}

export async function downloadContractPdf(input: {
  payload: ContractPdfPayload
  orderNumber: string
  contraenteFullName: string
  minorFullName?: string
  packageName: string
  editionYear: number
}): Promise<DownloadResult> {
  const orderPart = sanitizeFilePart(input.orderNumber) || 'ordine'
  const contraentePart = sanitizeFilePart(input.contraenteFullName) || 'contraente'
  const minorPart = sanitizeFilePart(input.minorFullName ?? '')
  const packagePart = sanitizeFilePart(input.packageName) || 'pacchetto'
  const editionPart = sanitizeFilePart(String(input.editionYear)) || 'edizione'
  const filename = minorPart
    ? `contratto-${orderPart}-${packagePart}-${editionPart}-${contraentePart}-${minorPart}.pdf`
    : `contratto-${orderPart}-${packagePart}-${editionPart}-${contraentePart}.pdf`
  return requestPdf('/api/contracts/pdf', input.payload, filename)
}

export async function downloadConsentsPdf(input: {
  payload: ConsentPdfPayload
  clientFullName: string
}): Promise<DownloadResult> {
  const clientPart = sanitizeFilePart(input.clientFullName) || 'cliente'
  return requestPdf('/api/consents/pdf', input.payload, `consenso-privacy-${clientPart}.pdf`)
}
