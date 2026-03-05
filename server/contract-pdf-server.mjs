import express from 'express'
import cors from 'cors'
import puppeteer from 'puppeteer'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const PORT = Number(process.env.CONTRACTS_PORT || 8787)

let browserPromise = null

function resolveChromeExecutablePath() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv
  }

  const home = os.homedir()
  const candidates = [
    path.join(
      home,
      '.cache',
      'puppeteer',
      'chrome-headless-shell',
      'win64-146.0.7680.31',
      'chrome-headless-shell-win64',
      'chrome-headless-shell.exe',
    ),
    path.join(
      home,
      '.cache',
      'puppeteer',
      'chrome',
      'win64-146.0.7680.31',
      'chrome-win64',
      'chrome.exe',
    ),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ]

  return candidates.find((item) => existsSync(item)) || null
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeRichHtml(value) {
  const raw = String(value ?? '')
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
}

function safeCurrency(value) {
  const numeric = Number(value)
  const safe = Number.isFinite(numeric) ? numeric : 0
  return safe.toFixed(2)
}

function paymentMethodLabel(code) {
  if (code === 'bank_transfer') {
    return 'Bonifico bancario'
  }
  if (code === 'paypal') {
    return 'PayPal'
  }
  return 'In sede'
}

function buildPartyRows(party) {
  return `
    <tr><th>Nome</th><td>${escapeHtml(party.firstName)}</td></tr>
    <tr><th>Cognome</th><td>${escapeHtml(party.lastName)}</td></tr>
    <tr><th>Data di nascita</th><td>${escapeHtml(party.birthDate)}</td></tr>
    <tr><th>Luogo di nascita</th><td>${escapeHtml(party.birthPlace)}</td></tr>
    <tr><th>Codice fiscale</th><td>${escapeHtml(party.taxCode)}</td></tr>
    <tr><th>Residenza</th><td>${escapeHtml(party.residenceAddress)}</td></tr>
    ${
      party.email
        ? `<tr><th>Email</th><td>${escapeHtml(party.email)}</td></tr>`
        : ''
    }
    ${
      party.phone
        ? `<tr><th>Telefono</th><td>${escapeHtml(party.phone)}</td></tr>`
        : ''
    }
  `
}

function buildSignatureBox(label) {
  return `
    <div class="signature-box">
      <p class="signature-label">${escapeHtml(label)}</p>
      <div class="signature-line"></div>
    </div>
  `
}

function buildContractHtml(payload) {
  const totalInstallments = (payload.plan.installments || []).reduce(
    (sum, item) => sum + (Number.isFinite(item.amount) ? Number(item.amount) : 0),
    0,
  )
  const activeServices = (payload.plan.services || []).filter((item) => item.enabled)
  const subjectIsMinor = payload.subject.kind === 'minor'
  const athleteLabel = subjectIsMinor ? 'Atleta minore' : 'Atleta'
  const signerLabel = subjectIsMinor ? 'Firma genitore' : 'Firma atleta'
  const signerName = subjectIsMinor
    ? `${payload.subject.guardian?.firstName || ''} ${payload.subject.guardian?.lastName || ''}`.trim()
    : `${payload.subject.athlete.firstName} ${payload.subject.athlete.lastName}`.trim()

  const periodLabel =
    payload.package.durationType === 'period'
      ? `${escapeHtml(payload.package.periodStartDate)} - ${escapeHtml(payload.package.periodEndDate)}`
      : `${escapeHtml(payload.package.eventDate)} ${payload.package.eventTime ? `ore ${escapeHtml(payload.package.eventTime)}` : ''}`

  const mainConsentHtml = subjectIsMinor
    ? sanitizeRichHtml(payload.company.consentMinors)
    : sanitizeRichHtml(payload.company.consentAdults)

  return `
  <!doctype html>
  <html lang="it">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 18mm; }
        body { font-family: Arial, sans-serif; color: #1f2937; font-size: 12px; }
        h1, h2, h3 { margin: 0; }
        p { margin: 0 0 6px; line-height: 1.4; }
        .header { margin-bottom: 16px; }
        .header img { max-width: 100%; max-height: 110px; object-fit: contain; margin-bottom: 8px; }
        .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        .table th, .table td { border: 1px solid #d1d5db; padding: 6px; text-align: left; vertical-align: top; }
        .table th { width: 34%; background: #f9fafb; }
        .section-title { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
        .sub-title { font-size: 13px; font-weight: 700; margin: 4px 0 6px; }
        .muted { color: #6b7280; }
        .service-chip { display: inline-block; padding: 2px 8px; border: 1px solid #d1d5db; border-radius: 999px; margin: 0 6px 6px 0; font-size: 11px; }
        .signature-box { margin-top: 10px; }
        .signature-label { font-size: 11px; margin-bottom: 18px; }
        .signature-line { border-bottom: 1px solid #111827; height: 22px; width: 100%; }
        .consent-block { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1; }
        .footer-space { margin-top: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        ${
          payload.package.contractHeaderImage
            ? `<img src="${payload.package.contractHeaderImage}" alt="Header contratto" />`
            : ''
        }
        ${sanitizeRichHtml(payload.package.contractHeaderText)}
      </div>

      <div class="card">
        <h2 class="section-title">Dati contratto</h2>
        <table class="table">
          <tbody>
            <tr><th>Attività</th><td>${escapeHtml(payload.package.name)}</td></tr>
            <tr><th>Periodo attività</th><td>${periodLabel}</td></tr>
            <tr><th>Luogo attività</th><td>${escapeHtml(payload.package.trainingAddress)}</td></tr>
            <tr><th>Azienda</th><td>${escapeHtml(payload.company.title)}</td></tr>
            <tr><th>Sede legale</th><td>${escapeHtml(payload.company.headquartersAddress)}</td></tr>
            <tr><th>P.IVA</th><td>${escapeHtml(payload.company.vatNumber)}</td></tr>
            <tr><th>Email azienda</th><td>${escapeHtml(payload.company.email)}</td></tr>
            <tr><th>IBAN</th><td>${escapeHtml(payload.company.iban)}</td></tr>
            <tr><th>Data richiesta</th><td>${escapeHtml(payload.activity.createdAt)}</td></tr>
            <tr><th>Metodo pagamento preferito</th><td>${escapeHtml(paymentMethodLabel(payload.plan.selectedPaymentMethodCode))}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="grid">
        <div class="card">
          <h3 class="sub-title">${athleteLabel}</h3>
          <table class="table"><tbody>${buildPartyRows(payload.subject.athlete)}</tbody></table>
        </div>
        ${
          subjectIsMinor
            ? `
              <div class="card">
                <h3 class="sub-title">Genitore / Firmatario</h3>
                <table class="table"><tbody>${buildPartyRows(payload.subject.guardian || {})}</tbody></table>
              </div>
            `
            : ''
        }
      </div>

      <div class="card">
        <h3 class="sub-title">Riepilogo economico</h3>
        <p><strong>Costo iscrizione:</strong> ${safeCurrency(payload.plan.enrollmentFee)} EUR</p>
        <p><strong>Costo ricorrente:</strong> ${safeCurrency(payload.plan.recurringAmount)} EUR</p>
        <p><strong>Totale piano rate:</strong> ${safeCurrency(totalInstallments)} EUR</p>
        <div class="footer-space">
          <p><strong>Servizi attivi:</strong></p>
          ${
            activeServices.length > 0
              ? activeServices
                  .map(
                    (service) =>
                      `<span class="service-chip">${escapeHtml(service.title)} - ${safeCurrency(service.amount)} EUR</span>`,
                  )
                  .join('')
              : '<span class="muted">Nessun servizio attivo</span>'
          }
        </div>
        <div class="footer-space">
          <p><strong>Rate previste:</strong></p>
          <table class="table">
            <thead>
              <tr>
                <th>Rata</th>
                <th>Scadenza</th>
                <th>Importo</th>
                <th>Metodo</th>
              </tr>
            </thead>
            <tbody>
              ${(payload.plan.installments || [])
                .map(
                  (item) => `
                    <tr>
                      <td>${escapeHtml(item.label)}</td>
                      <td>${escapeHtml(item.dueDate)}</td>
                      <td>${safeCurrency(item.amount)} EUR</td>
                      <td>${escapeHtml(paymentMethodLabel(item.paymentMethodCode))}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3 class="sub-title">Consensi e presa visione</h3>
        <div class="consent-block">
          ${mainConsentHtml}
          ${buildSignatureBox(`Spazio firma - consenso iscrizione (${signerName || 'firmatario'})`)}
        </div>
        <div class="consent-block">
          ${sanitizeRichHtml(payload.company.consentInformationNotice)}
          ${buildSignatureBox(`Spazio firma - presa visione informativa (${signerName || 'firmatario'})`)}
        </div>
        <div class="consent-block">
          ${sanitizeRichHtml(payload.company.consentDataProcessing)}
          ${buildSignatureBox(`Spazio firma - consenso trattamento dati (${signerName || 'firmatario'})`)}
        </div>
      </div>

      <div class="card">
        <h3 class="sub-title">Regolamento pacchetto</h3>
        ${sanitizeRichHtml(payload.package.contractRegulation)}
      </div>

      <div class="grid">
        <div class="card">
          ${buildSignatureBox(signerLabel)}
        </div>
        <div class="card">
          ${buildSignatureBox('Firma operatore centro sportivo')}
        </div>
      </div>
    </body>
  </html>
  `
}

async function getBrowser() {
  if (!browserPromise) {
    const executablePath = resolveChromeExecutablePath()
    // eslint-disable-next-line no-console
    console.log('[contracts] launch', { executablePath: executablePath || 'auto-default' })
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(executablePath ? { executablePath } : {}),
    })
  }
  return browserPromise
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/contracts/pdf', async (req, res) => {
  try {
    const payload = req.body || {}
    // Debug payload for contract rendering issues (logo/header/subject data).
    // eslint-disable-next-line no-console
    console.log('[contracts] request', {
      activityKey: payload?.activity?.key ?? '',
      packageId: payload?.package?.id ?? '',
      packageName: payload?.package?.name ?? '',
      subjectKind: payload?.subject?.kind ?? '',
      hasHeaderImage: Boolean(payload?.package?.contractHeaderImage),
      headerImagePrefix: String(payload?.package?.contractHeaderImage ?? '').slice(0, 40),
      hasHeaderText: Boolean(payload?.package?.contractHeaderText),
      hasRegulation: Boolean(payload?.package?.contractRegulation),
    })
    const html = buildContractHtml(payload)
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    })
    await page.close()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="contratto-attivita.pdf"')
    res.send(pdf)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[contracts] pdf_generation_failed', error)
    res.status(500).send('pdf_generation_failed')
  }
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Contract PDF server listening on http://localhost:${PORT}`)
})
