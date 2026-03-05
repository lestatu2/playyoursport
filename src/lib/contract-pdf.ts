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
  }
  package: {
    id: string
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
    contractRegulation: string
  }
  company: {
    title: string
    headquartersAddress: string
    vatNumber: string
    email: string
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
    guardian: ContractParty | null
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

export async function downloadContractPdf(input: {
  payload: ContractPdfPayload
  athleteFullName: string
  packageName: string
}): Promise<DownloadResult> {
  try {
    const response = await fetch(`${getContractsApiUrl()}/api/contracts/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.payload),
    })

    if (!response.ok) {
      const text = await response.text()
      return { ok: false, error: text || 'pdf_generation_failed' }
    }

    const blob = await response.blob()
    const athletePart = sanitizeFilePart(input.athleteFullName) || 'atleta'
    const packagePart = sanitizeFilePart(input.packageName) || 'pacchetto'
    saveBlobFile(blob, `contratto-${athletePart}-${packagePart}.pdf`)
    return { ok: true }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}
