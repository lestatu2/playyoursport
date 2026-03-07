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

function formatItDate(value) {
  if (!value) {
    return '-'
  }
  const direct = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) {
    const [yy, mm, dd] = direct.split('-')
    return `${dd}/${mm}/${yy}`
  }
  const parsed = new Date(direct)
  if (Number.isNaN(parsed.getTime())) {
    return direct
  }
  return new Intl.DateTimeFormat('it-IT').format(parsed)
}

function splitResidenceAddress(address) {
  const raw = String(address ?? '').trim()
  if (!raw) {
    return { city: '-', street: '-', number: '-' }
  }
  const parts = raw.split(',').map((item) => item.trim()).filter(Boolean)
  const city = parts[0] || '-'
  const streetPart = parts[1] || parts[0] || '-'
  const streetMatch = streetPart.match(/^(.*?)(?:\s+n\.?\s*([A-Za-z0-9/-]+))?$/i)
  const street = (streetMatch?.[1] || streetPart).trim() || '-'
  const number = (streetMatch?.[2] || '').trim() || '-'
  return { city, street, number }
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

function resolveSignerRoleLabel(value) {
  if (value === 'tutore') {
    return 'tutore'
  }
  if (value === 'esercente_responsabilita') {
    return 'esercente la responsabilita genitoriale'
  }
  if (value === 'contraente') {
    return 'contraente'
  }
  return 'genitore'
}

function formatPackagePeriod(pkg) {
  if (pkg.durationType === 'period') {
    return `${formatItDate(pkg.periodStartDate)} - ${formatItDate(pkg.periodEndDate)}`
  }
  const time = pkg.eventTime ? ` ore ${escapeHtml(pkg.eventTime)}` : ''
  return `${formatItDate(pkg.eventDate)}${time}`
}

function applyContractTemplate(template, variables) {
  const source = String(template || '')
  return source.replace(/\{\{\s*([a-z0-9_]+)\s*}}/gi, (_, token) => {
    const key = `{{${token.toLowerCase()}}}`
    return variables[key] ?? ''
  })
}

function buildContractHtml(payload) {
  const subjectIsMinor = payload.subject.kind === 'minor'
  const guardian = payload.subject.guardian || {}
  const athlete = payload.subject.athlete || {}
  const contraente = subjectIsMinor ? guardian : athlete
  const contraenteFullName = `${contraente.firstName || ''} ${contraente.lastName || ''}`.trim()
  const athleteFullName = `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim()
  const packagePeriod = formatPackagePeriod(payload.package)
  const signerRoleLabel = resolveSignerRoleLabel(payload.subject.signerRole)
  const place = payload.company.contractSignaturePlace || payload.company.headquartersCity || '-'
  const today = formatItDate(new Date().toISOString())

  const variables = {
    '{{package_name}}': escapeHtml(payload.package.name || ''),
    '{{package_edition_year}}': escapeHtml(String(payload.package.editionYear || '')),
    '{{package_period}}': escapeHtml(packagePeriod),
    '{{training_address}}': escapeHtml(payload.package.trainingAddress || ''),
    '{{company_title}}': escapeHtml(payload.company.title || ''),
    '{{athlete_full_name}}': escapeHtml(athleteFullName),
    '{{athlete_birth_date}}': escapeHtml(formatItDate(athlete.birthDate || '')),
    '{{guardian_full_name}}': escapeHtml(`${guardian.firstName || ''} ${guardian.lastName || ''}`.trim()),
  }

  const subjectHtml = applyContractTemplate(payload.contractConfig.subjectTemplate, variables)
  const economicHtml = sanitizeRichHtml(payload.contractConfig.economicClausesTemplate)
  const servicesHtml = sanitizeRichHtml(payload.contractConfig.servicesAdjustmentTemplate)
  const specialFormulaHtml = sanitizeRichHtml(payload.contractConfig.specialClausesFormula)
  const specialClauses = Array.isArray(payload.package.contractSpecialClauses)
    ? payload.package.contractSpecialClauses
    : []
  const specificConsentsHtml = subjectIsMinor
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
        .section { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
        .section-title { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
        .list { margin: 0; padding-left: 18px; }
        .list li { margin: 0 0 4px; line-height: 1.4; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }
        .signature-line { margin-top: 30px; border-bottom: 1px solid #111827; height: 1px; }
        .small { font-size: 11px; color: #6b7280; }
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

      <div class="section">
        <h2 class="section-title">Dati identificativi delle parti</h2>
        <p><strong>Societa sportiva:</strong> ${escapeHtml(payload.company.title)} (${escapeHtml(payload.company.legalForm || '-')}) con sede in ${escapeHtml(payload.company.headquartersAddress)}, ${escapeHtml(payload.company.headquartersCity)} (${escapeHtml(payload.company.headquartersProvince)}), CAP ${escapeHtml(payload.company.headquartersPostalCode)}, ${escapeHtml(payload.company.headquartersCountry)}; P.IVA/CF ${escapeHtml(payload.company.vatNumber)}; e-mail ${escapeHtml(payload.company.email)}; PEC ${escapeHtml(payload.company.pecEmail || '-')}; rappresentante legale ${escapeHtml(payload.company.legalRepresentativeFullName)} (${escapeHtml(payload.company.legalRepresentativeRole || '-')}).</p>
        <p><strong>Contraente (${escapeHtml(signerRoleLabel)}):</strong> ${escapeHtml(contraenteFullName || '-')} nato a ${escapeHtml(contraente.birthPlace || '-')} il ${escapeHtml(formatItDate(contraente.birthDate || ''))}, residente in ${escapeHtml(contraente.residenceAddress || '-')}, CF ${escapeHtml(contraente.taxCode || '-')}, e-mail ${escapeHtml(contraente.email || '-')}, telefono ${escapeHtml(contraente.phone || '-')}.</p>
        ${
          subjectIsMinor
            ? `<p><strong>Atleta minore:</strong> ${escapeHtml(athleteFullName || '-')} nato a ${escapeHtml(athlete.birthPlace || '-')} il ${escapeHtml(formatItDate(athlete.birthDate || ''))}, residente in ${escapeHtml(athlete.residenceAddress || '-')}, CF ${escapeHtml(athlete.taxCode || '-')}.</p>`
            : ''
        }
        <p><strong>Ordine:</strong> ${escapeHtml(payload.activity.orderNumber || payload.activity.key)} - <strong>Pacchetto:</strong> ${escapeHtml(payload.package.name)} (edizione ${escapeHtml(String(payload.package.editionYear || '-'))}) - <strong>Periodo:</strong> ${escapeHtml(packagePeriod)}.</p>
      </div>

      <div class="section">
        <h2 class="section-title">Oggetto contrattuale</h2>
        ${sanitizeRichHtml(subjectHtml)}
      </div>

      <div class="section">
        <h2 class="section-title">Regole economiche</h2>
        ${economicHtml}
        ${servicesHtml}
        <p><strong>Importo iscrizione:</strong> ${safeCurrency(payload.plan.enrollmentFee)} EUR. <strong>Importo ricorrente:</strong> ${safeCurrency(payload.plan.recurringAmount)} EUR. <strong>Metodo di pagamento scelto:</strong> ${escapeHtml(paymentMethodLabel(payload.plan.selectedPaymentMethodCode))}.</p>
      </div>

      <div class="section">
        <h2 class="section-title">Iscrizione e copertura assicurativa</h2>
        <p>La quota di iscrizione/assicurazione applicata al presente contratto e pari a ${safeCurrency(payload.plan.enrollmentFee)} EUR, secondo le regole di compatibilita e validita della copertura associate al tipo di iscrizione del pacchetto.</p>
      </div>

      <div class="section">
        <h2 class="section-title">Consensi contrattuali</h2>
        <div>${specificConsentsHtml}</div>
        <div style="margin-top:8px;">${sanitizeRichHtml(payload.company.consentInformationNotice)}</div>
      </div>

      ${
        specialClauses.length > 0
          ? `
      <div class="section">
        <h2 class="section-title">Clausole speciali</h2>
        ${specialFormulaHtml}
        <ol class="list">
          ${specialClauses.map((clause) => `<li><strong>${escapeHtml(clause.title)}</strong>: ${sanitizeRichHtml(clause.text)}</li>`).join('')}
        </ol>
      </div>
      `
          : ''
      }

      <div class="section">
        <h2 class="section-title">Regolamento del pacchetto</h2>
        ${sanitizeRichHtml(payload.package.contractRegulation)}
      </div>

      <div class="section">
        <p><strong>Luogo:</strong> ${escapeHtml(place)} - <strong>Data:</strong> ${escapeHtml(today)}</p>
        <div class="signatures">
          <div>
            <p><strong>Firma contraente (${escapeHtml(signerRoleLabel)})</strong></p>
            <p class="small">${escapeHtml(contraenteFullName || '-')}</p>
            <div class="signature-line"></div>
          </div>
          <div>
            <p><strong>Firma responsabile aziendale</strong></p>
            <p class="small">${escapeHtml(payload.company.legalRepresentativeFullName || '-')}</p>
            ${
              payload.company.delegateSignatureDataUrl
                ? `<img src="${escapeHtml(payload.company.delegateSignatureDataUrl)}" alt="Firma responsabile" style="max-height:52px;max-width:220px;object-fit:contain;margin-top:8px;" />`
                : '<div class="signature-line"></div>'
            }
          </div>
        </div>
      </div>
    </body>
  </html>
  `
}

function buildConsentsHtml(payload) {
  const subjectIsMinor = payload.subject.kind === 'minor'
  const declarant = subjectIsMinor ? payload.subject.guardian || {} : payload.subject.athlete || {}
  const fullName = `${declarant.firstName || ''} ${declarant.lastName || ''}`.trim()
  const birthPlace = declarant.birthPlace || '-'
  const birthDate = formatItDate(declarant.birthDate || '')
  const residence = splitResidenceAddress(declarant.residenceAddress || '')
  const phone = declarant.phone || '-'
  const secondaryPhone = declarant?.['secondaryPhone'] || '-'
  const email = declarant.email || '-'
  const downloadDate = new Intl.DateTimeFormat('it-IT').format(new Date())
  const signaturePlace = payload.company.headquartersCity || payload.company.contractSignaturePlace || '-'
  const portalName = payload.company.portalName || 'Play Your Sport'
  const legalRepresentative = payload.company.legalRepresentativeFullName || '-'

  return `
  <!doctype html>
  <html lang="it">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 18mm; }
        body { font-family: Arial, sans-serif; color: #111827; font-size: 12px; }
        p { margin: 0 0 8px; line-height: 1.5; }
        h2 { margin: 0 0 10px; font-size: 14px; }
        .section { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
        .signature-row { margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .signature-block { min-height: 90px; }
        .signature-line { margin-top: 36px; border-bottom: 1px solid #111827; height: 1px; }
        .small { font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="section">
        <p>Il sottoscritto ${escapeHtml(fullName)} nato a ${escapeHtml(birthPlace)} il ${escapeHtml(birthDate)} Residente a ${escapeHtml(residence.city)} Via ${escapeHtml(residence.street)} n.${escapeHtml(residence.number)} Tel. ${escapeHtml(phone)} Cell. ${escapeHtml(secondaryPhone)} Indirizzo posta elettronica ${escapeHtml(email)} ACCONSENTE ai sensi e per gli effetti dell'art. 13 del Regolamento UE 2016/679 del Parlamento europeo e del Consiglio, del 27 aprile 2016, con la sottoscrizione del presente modulo, al trattamento dei dati personali secondo le modalita e nei limiti di cui all'informativa allegata.</p>
        <p>Letto, confermato e sottoscritto</p>
        <p><strong>Data</strong> ${escapeHtml(downloadDate)} <strong>Luogo</strong> ${escapeHtml(signaturePlace)}</p>
        <div class="signature-row">
          <div class="signature-block">
            <p>Firma del dichiarante (per esteso e leggibile)</p>
            <div class="signature-line"></div>
          </div>
          <div class="signature-block">
            <p>Firma del Responsabile del trattamento</p>
            <p class="small">${escapeHtml(legalRepresentative)}</p>
            ${
              payload.company.delegateSignatureDataUrl
                ? `<img src="${escapeHtml(payload.company.delegateSignatureDataUrl)}" alt="Firma delegato" style="max-height:52px;max-width:220px;object-fit:contain;margin-top:6px;" />`
                : '<div class="signature-line"></div>'
            }
          </div>
        </div>
      </div>

      <div class="section">
        <h2>INFORMATIVA PRIVACY</h2>
        <p>Con la presente informativa, resa ai sensi e per gli effetti dell'art. 13 del Regolamento UE 2016/679 del Parlamento europeo e del Consiglio, del 27 aprile 2016, relativo alla protezione delle persone fisiche con riguardo al trattamento dei dati personali, nonche alla libera circolazione di tali dati (di seguito "Regolamento"), si intendono fornire dovute informazioni in ordine alle finalita e modalita del trattamento dei suoi dati personali.</p>
        <p><strong>TIPOLOGIA DEI DATI TRATTATI</strong></p>
        <p>I dati raccolti e trattati dal Titolare del trattamento sono dati di natura personale, ossia informazioni attraverso le quali un soggetto puo essere identificato come persona fisica (a titolo esemplificativo: nome, cognome, data di nascita, residenza, domicilio, indirizzo e-mail, numero di telefono, etc.).</p>
        <p><strong>FINALITA DEL TRATTAMENTO</strong></p>
        <p>I dati raccolti saranno utilizzati esclusivamente per le seguenti finalita: rilascio account accesso al portale ${escapeHtml(portalName)}.</p>
        <p><strong>TITOLARE E RESPONSABILI DEL TRATTAMENTO</strong></p>
        <p>Il Responsabile del trattamento è ${escapeHtml(legalRepresentative)}.</p>
        <p>In ogni caso il trattamento avviene in modo da garantire la sicurezza e la riservatezza dei dati, mediante l'adozione delle misure previste dall'articolo 32 del Regolamento al fine di preservare l'integrita dei dati trattati e prevenire l'accesso agli stessi da parte di soggetti non autorizzati.</p>
        <p><strong>NATURA DEL CONFERIMENTO</strong></p>
        <p>Il conferimento dei dati e obbligatorio al fine di identificare gli utenti abilitati al portale dedicato.</p>
        <div class="small">${sanitizeRichHtml(payload.company.consentDataProcessing)}</div>
        <p><strong>RILASCIO DEL CONSENSO</strong></p>
        <p>L'acquisizione del consenso al trattamento dei dati personali e necessaria per il rilascio delle credenziali di accesso al portale dedicato ${escapeHtml(portalName)}.</p>
        <p>Il trattamento dei dati avverra nel pieno rispetto dei principi di riservatezza, correttezza, necessita, pertinenza, liceita e trasparenza imposti dal Regolamento per il tempo necessario al conseguimento degli scopi per cui i dati sono stati raccolti e, in ogni caso, non oltre 10 anni dalla loro raccolta.</p>
        <p>Il trattamento dei dati avverra con strumenti informatici.</p>
        <p><strong>TRASFERIMENTO DEI DATI PERSONALI</strong></p>
        <p>I dati non saranno comunicati ad altri soggetti, ne saranno oggetto di diffusione.</p>
        <p><strong>DIRITTI DEGLI INTERESSATI</strong></p>
        <p>Le ricordiamo che sono riconosciuti i diritti di cui agli articoli 15 e seguenti del Regolamento. In qualsiasi momento, potra chiedere a ${escapeHtml(payload.company.title)} di aggiornare, modificare e/o correggere i suoi dati personali. Qualora ravvisasse una violazione dei Suoi diritti puo rivolgersi all'autorita di controllo competente ai sensi dell'art. 77 del GDPR, resta salva la possibilita di rivolgersi direttamente all'autorita giudiziaria.</p>
        <p><strong>Firma del dichiarante</strong> ______________________ <strong>Data</strong> ${escapeHtml(downloadDate)}</p>
      </div>
    </body>
  </html>
  `
}

async function getBrowser() {
  if (!browserPromise) {
    const executablePath = resolveChromeExecutablePath()
    console.log('[contracts] launch', { executablePath: executablePath || 'auto-default' })
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...(executablePath ? { executablePath } : {}),
    })
  }
  return browserPromise
}

async function renderPdfBufferFromHtml(html) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' })
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    })
  } finally {
    await page.close()
  }
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
    const html = buildContractHtml(payload)
    const pdf = await renderPdfBufferFromHtml(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="contratto-attivita.pdf"')
    res.send(pdf)
  } catch (error) {
    console.error('[contracts] pdf_generation_failed', error)
    res.status(500).send('pdf_generation_failed')
  }
})

app.post('/api/consents/pdf', async (req, res) => {
  try {
    const payload = req.body || {}
    const html = buildConsentsHtml(payload)
    const pdf = await renderPdfBufferFromHtml(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="consensi-attivita.pdf"')
    res.send(pdf)
  } catch (error) {
    console.error('[consents] pdf_generation_failed', error)
    res.status(500).send('pdf_generation_failed')
  }
})

app.listen(PORT, () => {
  console.log(`Contract PDF server listening on http://localhost:${PORT}`)
})
