# PlayYourSport - Contesto Progetto

## Obiettivo
Costruire una piattaforma gestionale per:
- campi scuola calcio
- academy sportive

Stack target:
- Frontend: React + TypeScript
- Backend target: Laravel (fase successiva)

## Modalita di lavoro attuale
- In questa fase lavoriamo con dati mockati JSON + `localStorage`.
- Pattern UI standard: pagina con tabella + modale creazione/modifica.
- Le traduzioni vanno sempre mantenute allineate su tutte le lingue attive (`it`, `en`, `de`, `es`, `fr`) quando si introducono nuove chiavi.

## Ruoli e accessi (stato attuale)
- Ruoli presenti:
  - `super-administrator` (vede e fa tutto)
  - `administrator` (tutto tranne Configurazione)
  - `editor-admin`
  - `trainer`
  - `subscriber`
  - `client`
- Dashboard amministrativa accessibile solo a:
  - `super-administrator`, `administrator`, `editor-admin`
- `subscriber` e `client` non accedono alla dashboard.
- Pagina `Utenti`:
  - visibile a `super-administrator`, `administrator`, `editor-admin`
  - tab con visibilita per ruolo:
    - tab `administrator`: solo `super-administrator`
    - tab `editor-admin`: `super-administrator` e `administrator`
    - tab `trainer`: `super-administrator`, `administrator`, `editor-admin`
    - tab `subscriber`: `super-administrator`, `administrator`, `editor-admin`
- Regole creazione utenti:
  - `super-administrator` crea tutti (incluso `administrator`)
  - `administrator` crea `editor-admin`, `trainer`, `subscriber`
  - `editor-admin` crea `trainer`, `subscriber`

## Configurazione
- Tab progetto/configurazione gia presenti.
- Campo `Google Maps API key` configurabile.
- Valuta pagamenti configurabile (default EUR), salvata in `localStorage`.
- Etichette ruoli configurabili (es. label trainer usata anche nelle tab pacchetti).
- Le impostazioni del frontend pubblico non stanno piu in Configurazione generale: sono state spostate nella nuova sezione `Sito`.

## Pacchetti (pagina principale, non in Utility)
- Pagina: `PackagesPage` nel menu principale.
- Menu unico confermato: niente doppio menu `Pacchetti` + `Edizioni`.
- La gestione edizioni avviene dentro `Pacchetti` (tabella prodotti + modale elenco edizioni).
- Modale pacchetto strutturata a tab.
- Tab attive (ordine attuale):
  - Info generali
  - Galleria
  - Durata
  - Pagamenti
  - Iscrizioni
  - Servizi aggiuntivi
  - Campi e Gruppi
  - Trainer (etichetta dinamica da configurazione)
  - WhatsApp (ultima tab)

### Info generali
- Campi principali in singola flow di tab (no vecchio layout row1/row2).
- Switch:
  - pacchetto in evidenza
  - pacchetto descrittivo
- Campo range di eta con etichetta italiana corretta: `Età` (min/max).

### Galleria
- Upload multi-immagine con preview.
- Drag and drop con `@dnd-kit` (non nativo).
- Ordinamento immagini e caption cliccando l'immagine.

### Durata
- Radio tipologia evento:
  - singolo evento
  - periodo
- Se singolo evento: campo data + orario.
- Se periodo: selezione intervallo con calendario unico (start/end).

### Pagamenti
- Switch `pagamento ricorrente`.
- Se OFF: campo numerico `Prezzo` con valuta configurata.
- Se ON:
  - select frequenza: giornaliero, settimanale, mensile, annuale
  - prezzo etichettato `Prezzo/{frequenza}`
  - regole aggiuntive:
    - mensile: giorno limite pagamento mese corrente + giorno da cui pagare mese successivo
    - settimanale: giorno settimana limite per pagamento settimana successiva
- Switch globale: `Primo pagamento in sede`.
- Regola UI condivisa: mantenere margine verticale coerente (`mb-4`) tra campo e switch quando richiesto.

### Iscrizioni
- Select iscrizione da utility iscrizioni.
- un campo costo iscrizione.

### Servizi aggiuntivi
- Repeater separato per:
  - servizi fissi
  - servizi variabili
- Ogni riga ha select servizio + switch `attivo` a livello pacchetto.
- Vincolo UX: un servizio gia selezionato in una riga non deve comparire nelle altre select dello stesso gruppo.

### Campi e Gruppi
- Tab rinominata in `Campi e Gruppi`.
- In testa:
  - sede allenamento con ricerca indirizzo via Google Maps (Places Autocomplete + mappa)
  - numero ingressi (numerico) con limiti da frequenza pagamento:
    - giornaliero: non mostrato
    - settimanale: max 7
    - mensile: max 31
    - annuale: max 365
  - switch `Scelta orario utente`
- Gestione gruppi con tabella + modale dedicata (niente repeater inline complesso):
  - titolo
  - anno minimo / anno massimo (formato anno, es. 2014)
  - campo (filtrato in base alla categoria scelta in info generali)
  - repeater giorno+orario
- Render giorni/orari in formato leggibile:
  - esempio: `Lunedi ore 17:00`
  - merge automatico se stesso orario su piu giorni: `Lunedi e Mercoledi ore 17:00`
- Se anno min == anno max, in tabella mostrare anno una sola volta.

### Trainer
- Repeater a select dei trainer disponibili.

### WhatsApp
- Tab dedicata al collegamento account WhatsApp ai pacchetti.
- Posizionata come ultima tab della modale pacchetto.

### Prodotto + Edizioni (regole definite oggi)
- Un "pacchetto" va gestito come **prodotto con edizioni annuali**.
- Ogni configurazione salvata per anno e durata e una **entita edizione** separata.
- Campi minimi introdotti lato catalogo:
  - `productId` (identifica il prodotto base)
  - `editionYear` (anno edizione)
- Vincolo logico: per lo stesso `productId` non possono esistere 2 edizioni con lo stesso anno.
- La tabella principale mostra i prodotti raggruppati; da azione dedicata si apre la gestione edizioni.
- Dalla gestione edizioni e possibile:
  - aprire una edizione esistente
  - creare nuova edizione (anche partendo dalla precedente)
- In modale pacchetto sono presenti:
  - `Codice prodotto`
  - `Anno edizione`
- Migrazione compatibilita mock/localStorage:
  - se i vecchi record non hanno `productId`/`editionYear`, vengono inferiti automaticamente.
  - note operative: quando si cambiano seed/mock e il browser ha gia dati, prevale `localStorage` (`pys_package_catalog`).

### Tabella Prodotti (admin)
- Aggiunta colonna `Periodo` nella tabella prodotti.
- Render:
  - se `durationType = period`: `data inizio - data fine`
  - se `single-event`: `data + orario`

## Utility (dominio)
Sezioni utility implementate con pattern table + modale:
- `Categorie`
- `Aziende`
- `Campi`
- `Iscrizioni` (mock: Agonista, Non agonista, Campo scuola)
- `Servizi aggiuntivi`
  - tipo fisso/variabile
  - descrizione
  - prezzo solo per tipo fisso
  - switch attivo
- `WhatsApp Accounts`
  - titolo + numero telefono
  - avatar
  - switch attivo
  - disponibilita:
    - sempre attivo, oppure giorni/orari
    - messaggio offline
  - stile bottone (label/colori/base styling)
- Nuova sezione admin `Sito` (menu principale admin, non dentro Utility):
  - Tab `Impostazioni`: tipi contenuto abilitati per slider homepage (ora: `Pacchetti`)
  - Tab `Slider homepage`: gestione contenuti slider con table + modale
  - Supporto repeater in creazione slide multiple
  - Vincolo: contenuti gia presenti nello slider non selezionabili di nuovo

## Dati mock aggiornati
- Categorie mock richieste:
  - Calcio
  - Tennis
  - Padel
  - Campo Scuola
- Creati pacchetti mock associati alle categorie.
- `mock-packages.json` ricostruito in versione completa per simulazione:
  - utility popolate (categorie, campi, gruppi, aziende, iscrizioni, servizi, WhatsApp)
  - pacchetti con campi valorizzati (durata, pagamenti, gruppi, servizi, trainer, contratto, media, stato, disclaimer)
- Football Academy:
  - nome: `Football Academy`
  - audience: `youth`
  - periodo: dal `2025-09-01` al `2026-05-31`
  - migrazione forzata runtime su id `pkg-football-adult-base` per allineare anche dati gia presenti in localStorage

## Note tecniche recenti
- Fix TypeScript/ESLint progressivi su:
  - JSX namespace/type import
  - auth typings (`SaveUserResult`)
  - `FlagIcon` typing con `country-flag-icons`
  - hook dependencies / frammenti duplicati principali
  - export mancanti su `package-catalog` (additional services / WhatsApp)
  - regex lint fix: uso `\D` al posto di `[^\d]`
- Frontend pubblico separato dall'admin:
  - `/login` = backend amministrativo
  - `/` = home pubblica
  - `/pacchetti` = archive pubblico
  - `/pacchetti/:packageId` = single prodotto (placeholder strutturale)
- Header pubblico:
  - logo a sinistra
  - menu `Home` + `Pacchetti`
  - in home e in overlay sopra slider
- Homepage pubblica:
  - slider `Swiper React`
  - slide full page (`h-screen`) con immagine di sfondo full slide
  - contenuti slide: titolo + disclaimer + CTA dettaglio
- CTA abbonamento unificata su home/archive/single:
  - formato: `Abbonati a partire da {prezzo} al {frequenza}`
- Fallback immagini pubbliche:
  - resolver immagini per categoria (`/public/images`) per gestire record con media mancanti

## Regole operative concordate
- Non duplicare pagine omologhe: usare `PackagesPage` come pagina pacchetti principale.
- Evitare regressioni di naming/file (rinominare correttamente, non creare doppioni).
- Mantenere UI coerente con richieste puntuali di spacing e ordine tab.
- Aggiornare questo file a ogni blocco funzionale importante.
- Non introdurre scorciatoie non richieste: seguire la specifica testuale dell'utente in ordine stretto.
- Regola globale tabelle (DataTable condivisa):
  - paginazione standard obbligatoria con default 20 righe per pagina
  - selettore righe per pagina con opzioni 10, 20, 50, 100
  - responsive con gestione colonne centralizzata nel dropdown `Colonne` (niente modali pagina-specifiche)
  - per ogni colonna devono essere disponibili:
    - switch `Visibile` (visibilita globale desktop/mobile)
    - switch `Visibile mobile` (inclusione/esclusione su viewport piccoli)
    - ordinamento priorita tramite controlli `Su`/`Giu`
    - switch `Mobile prioritaria` per decidere se mostrare in riga o solo nei dettagli espandibili
  - colonne non prioritarie su mobile restano accessibili nell'espansione riga

## Dominio Pubblico (nuove regole funzionali)
- Distinzione utenti frontend:
  - `subscriber`: registrato alla piattaforma senza acquisto prodotto
  - `client`: utente con almeno un acquisto prodotto
- Conversione prevista: `subscriber -> client` al primo acquisto.
- Scenario prioritario definito (da implementare nel prossimo blocco):
  - modale da bottone pacchetto con form a step per pacchetti ragazzi
  - step 1: dati minore + controllo range età pacchetto + controllo duplicato CF minore
  - step 2: dati genitore + controllo duplicato CF cliente
  - integrazione Google Places per luogo/indirizzo
  - componente calcolo codice fiscale
  - upload documentale fronte (CF/doc)
  - persistenza mock con json separati:
    - clienti (id numerici)
    - minori/atleti collegati 1:1 al genitore via id numerico

### Avanzamento implementazione (aggiornamento)
- Implementata componente dedicata `PublicYouthEnrollmentModal` (DaisyUI modal fullscreen) per scenario:
  - utente non collegato
  - acquisto/iscrizione pacchetto con audience `youth`
- Apertura form a step collegata ai bottoni prodotto su:
  - home pubblica (`/`)
  - archivio pubblico (`/pacchetti`)
  - dettaglio pubblico (`/pacchetti/:packageId`)
- Flusso step attuale:
  - step 1: dati minore (data nascita completa, luogo nascita, residenza) + validazione eta su range `ageMin/ageMax` del pacchetto + controllo duplicato CF minore
  - step 2: dati genitore/account (data nascita completa, luogo nascita, residenza) + controllo duplicato CF cliente
  - step 3: conferma privacy e submit
- Upload documentali obbligatori nel flusso:
  - foto codice fiscale minore
  - foto codice fiscale adulto
  - documento identita adulto
- Persistenza mock aggiunta:
  - `src/lib/public-customer-records.ts` con storage separato:
    - `pys_public_clients`
    - `pys_public_minors`
- In submit:
  - crea utente `subscribers` (registrazione pubblica)
  - login pubblico automatico
  - crea record cliente + minore
  - crea enrollment pubblico
  - converte utente in `client` al primo acquisto

## Backend Laravel - linee guida concordate
Obiettivo: riflettere fedelmente i domini oggi gestiti in mock JSON + `localStorage`, senza comprimere concetti diversi sotto endpoint generici.

### Domini backend da mantenere separati
- auth gestionale
- auth portale pubblico
- utenti e ruoli
- configurazione progetto
- utility catalogo
- pacchetti
- clienti / minori / atleti diretti
- enrollments pubblici pacchetti
- attivita / pagamenti / storico
- open day
- prospect e partecipazioni open day
- sito / contenuti pubblici

### Modello DB consigliato

#### Pacchetti
- Tabella `package_products`:
  - `id`, `code` (unique), `name`, `category_id`, `company_id`, `audience`, `status`, timestamps
- Tabella `package_product_editions`:
  - `id`, `product_id` (FK), `edition_year`, `status` (`draft|published|archived`), timestamps
  - campi configurazione edizione: durata, pagamenti, iscrizione, servizi, gruppi, trainer, whatsapp, contratto, gallery, media
- Vincolo fondamentale DB:
  - unique composita (`product_id`, `edition_year`)
- Tabelle figlie edizione consigliate:
  - `package_edition_groups`
  - `package_edition_group_schedules`
  - `package_edition_trainers`
  - `package_edition_whatsapp_accounts`
  - `package_edition_services`
  - `package_edition_gallery`

#### Open Day
- Tabella `open_day_products`:
  - `id`, `code` (unique), `name`, `category_id`, `audience`, `description`, `disclaimer`, `age_min`, `age_max`, `status`, timestamps
- Tabella `open_day_editions`:
  - `id`, `product_id` (FK), `edition_year`, `status`, `duration_type`, `event_date`, `period_start_date`, `period_end_date`, timestamps
- Vincolo fondamentale DB:
  - unique composita (`product_id`, `edition_year`)
- Tabelle figlie consigliate:
  - `open_day_groups`
  - `open_day_sessions`
  - `open_day_prospects`
  - `open_day_minor_athletes`
  - `open_day_adult_athletes`
  - `open_day_participations`
  - `open_day_participation_sessions`

### API Laravel consigliate (REST)

#### Auth gestionale
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

#### Auth portale pubblico
- `POST /api/public/auth/login`
- `POST /api/public/auth/logout`
- `GET /api/public/auth/me`
- `POST /api/public/auth/register-subscriber`
- `POST /api/public/auth/register-prospect`

#### Utenti e ruoli
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/{userId}`
- `PATCH /api/users/{userId}`
- `DELETE /api/users/{userId}`
- `GET /api/roles`

#### Project settings / configurazione
- `GET /api/project-settings`
- `PATCH /api/project-settings`

#### Utility catalogo
- `GET /api/utility/categories`
- `POST /api/utility/categories`
- `PATCH /api/utility/categories/{categoryId}`
- `DELETE /api/utility/categories/{categoryId}`
- `GET /api/utility/fields`
- `POST /api/utility/fields`
- `PATCH /api/utility/fields/{fieldId}`
- `DELETE /api/utility/fields/{fieldId}`
- `GET /api/utility/groups`
- `POST /api/utility/groups`
- `PATCH /api/utility/groups/{groupId}`
- `DELETE /api/utility/groups/{groupId}`
- `GET /api/utility/companies`
- `POST /api/utility/companies`
- `PATCH /api/utility/companies/{companyId}`
- `DELETE /api/utility/companies/{companyId}`
- `GET /api/utility/insurances`
- `POST /api/utility/insurances`
- `PATCH /api/utility/insurances/{insuranceId}`
- `DELETE /api/utility/insurances/{insuranceId}`
- `GET /api/utility/enrollments`
- `POST /api/utility/enrollments`
- `PATCH /api/utility/enrollments/{enrollmentId}`
- `DELETE /api/utility/enrollments/{enrollmentId}`
- `GET /api/utility/additional-services`
- `POST /api/utility/additional-services`
- `PATCH /api/utility/additional-services/{serviceId}`
- `DELETE /api/utility/additional-services/{serviceId}`
- `GET /api/utility/whatsapp-accounts`
- `POST /api/utility/whatsapp-accounts`
- `PATCH /api/utility/whatsapp-accounts/{accountId}`
- `DELETE /api/utility/whatsapp-accounts/{accountId}`
- `GET /api/utility/payment-methods`
- `POST /api/utility/payment-methods`
- `PATCH /api/utility/payment-methods/{paymentMethodId}`
- `DELETE /api/utility/payment-methods/{paymentMethodId}`
- `GET /api/utility/contracts/settings`
- `PATCH /api/utility/contracts/settings`

#### Pacchetti
- `GET /api/packages/products`
- `POST /api/packages/products`
- `GET /api/packages/products/{productId}`
- `PATCH /api/packages/products/{productId}`
- `DELETE /api/packages/products/{productId}`
- `GET /api/packages/products/{productId}/editions`
- `POST /api/packages/products/{productId}/editions`
- `GET /api/packages/products/{productId}/editions/{editionId}`
- `PATCH /api/packages/products/{productId}/editions/{editionId}`
- `DELETE /api/packages/products/{productId}/editions/{editionId}`
- `POST /api/packages/products/{productId}/editions/{editionId}/clone`

#### Gruppi pacchetto
- `GET /api/packages/editions/{editionId}/groups`
- `POST /api/packages/editions/{editionId}/groups`
- `GET /api/packages/editions/{editionId}/groups/{groupId}`
- `PATCH /api/packages/editions/{editionId}/groups/{groupId}`
- `DELETE /api/packages/editions/{editionId}/groups/{groupId}`

#### Clienti e anagrafiche pacchetti
- `GET /api/clients`
- `POST /api/clients`
- `GET /api/clients/{clientId}`
- `PATCH /api/clients/{clientId}`
- `GET /api/clients/{clientId}/minors`
- `POST /api/clients/{clientId}/minors`
- `GET /api/clients/{clientId}/minors/{minorId}`
- `PATCH /api/clients/{clientId}/minors/{minorId}`
- `GET /api/direct-athletes`
- `POST /api/direct-athletes`
- `GET /api/direct-athletes/{athleteId}`
- `PATCH /api/direct-athletes/{athleteId}`

#### Frontend pubblico pacchetti
- `GET /api/public/packages`
- `GET /api/public/packages/{editionId}`
- `POST /api/public/packages/{editionId}/enrollments`
- `POST /api/public/packages/identity-check`

#### Iscrizioni / attivita / pagamenti pacchetti
- `GET /api/enrollments`
- `GET /api/enrollments/{enrollmentRecordId}`
- `PATCH /api/enrollments/{enrollmentRecordId}`
- `GET /api/activities`
- `GET /api/activities/{activityId}`
- `PATCH /api/activities/{activityId}`
- `GET /api/activity-payments`
- `GET /api/activity-payments/{paymentId}`
- `PATCH /api/activity-payments/{paymentId}`
- `GET /api/activity-history`
- `GET /api/activity-history/{historyId}`

#### Open Day
- `GET /api/open-days/products`
- `POST /api/open-days/products`
- `GET /api/open-days/products/{productId}`
- `PATCH /api/open-days/products/{productId}`
- `DELETE /api/open-days/products/{productId}`
- `GET /api/open-days/products/{productId}/editions`
- `POST /api/open-days/products/{productId}/editions`
- `GET /api/open-days/products/{productId}/editions/{editionId}`
- `PATCH /api/open-days/products/{productId}/editions/{editionId}`
- `DELETE /api/open-days/products/{productId}/editions/{editionId}`
- `POST /api/open-days/products/{productId}/editions/{editionId}/clone`

#### Gruppi e sessioni Open Day
- `GET /api/open-days/editions/{editionId}/groups`
- `POST /api/open-days/editions/{editionId}/groups`
- `GET /api/open-days/editions/{editionId}/groups/{groupId}`
- `PATCH /api/open-days/editions/{editionId}/groups/{groupId}`
- `DELETE /api/open-days/editions/{editionId}/groups/{groupId}`
- `GET /api/open-days/editions/{editionId}/groups/{groupId}/sessions`
- `POST /api/open-days/editions/{editionId}/groups/{groupId}/sessions`
- `GET /api/open-days/editions/{editionId}/groups/{groupId}/sessions/{sessionId}`
- `PATCH /api/open-days/editions/{editionId}/groups/{groupId}/sessions/{sessionId}`
- `DELETE /api/open-days/editions/{editionId}/groups/{groupId}/sessions/{sessionId}`

#### Prospect e anagrafiche Open Day
- `GET /api/open-day-prospects`
- `POST /api/open-day-prospects`
- `GET /api/open-day-prospects/{prospectId}`
- `PATCH /api/open-day-prospects/{prospectId}`
- `GET /api/open-day-prospects/{prospectId}/minor-athletes`
- `POST /api/open-day-prospects/{prospectId}/minor-athletes`
- `GET /api/open-day-prospects/{prospectId}/minor-athletes/{minorAthleteId}`
- `PATCH /api/open-day-prospects/{prospectId}/minor-athletes/{minorAthleteId}`
- `GET /api/open-day-prospects/{prospectId}/adult-athletes`
- `POST /api/open-day-prospects/{prospectId}/adult-athletes`
- `GET /api/open-day-prospects/{prospectId}/adult-athletes/{adultAthleteId}`
- `PATCH /api/open-day-prospects/{prospectId}/adult-athletes/{adultAthleteId}`

#### Partecipazioni Open Day
- `GET /api/open-days/participations`
  - lista admin aggregata, non legata a una sola edizione
  - supporta filtri coerenti con la UI:
    - `scope=active|history`
    - `category_id`
    - `group_id`
    - `date_from`
    - `date_to`
    - `status`
    - `participant_type=adult|minor`
    - `search`
- `GET /api/open-days/editions/{editionId}/participations`
- `POST /api/open-days/editions/{editionId}/participations`
- `GET /api/open-days/editions/{editionId}/participations/{participationId}`
- `PATCH /api/open-days/editions/{editionId}/participations/{participationId}`
- `DELETE /api/open-days/editions/{editionId}/participations/{participationId}`
- `GET /api/open-days/participations/export`
  - export admin basato sugli stessi filtri della lista
  - parametri principali:
    - `format=xlsx|pdf|docx`
    - `scope=active|history`
    - `category_id`
    - `group_id`
    - `date_from`
    - `date_to`
    - `status`
    - `participant_type=adult|minor`
    - `search`
  - se una partecipazione ha piu sessioni, l export deve produrre una riga per sessione

#### Frontend pubblico Open Day
- `GET /api/public/open-days`
- `GET /api/public/open-days/{editionId}`
- `POST /api/public/open-days/{editionId}/participations`
- `POST /api/public/open-days/identity-check`

#### Sito / contenuti pubblici
- `GET /api/site/settings`
- `PATCH /api/site/settings`
- `GET /api/site/homepage-slider`
- `PATCH /api/site/homepage-slider`

### Regole server importanti
- Validare unicita anno edizione per prodotto, sia per pacchetti sia per open day.
- Tutte le operazioni gestionali operative devono riferirsi all edizione, non al prodotto base.
- Le edizioni pubblicate devono essere trattate come snapshot versionate, evitando modifiche retroattive non controllate.
- Non comprimere `packages` e `open-days` sotto un solo dominio `products`: hanno vincoli funzionali diversi su azienda, pagamenti, servizi, iscrizioni, documenti e anagrafiche.

## Aggiornamento odierno (2026-03-04)

### Direzione generale
- Decisione confermata: NON creare una modale diversa per ogni scenario.
- Deve esistere un unico form/modale pubblico con step riutilizzabili, attivati/disattivati in base alle condizioni reali.
- Lo scenario corrente prioritario e: utente non loggato che acquista pacchetto ragazzi per minore (scenario 1).

### Scenario model (da usare come base)
- Scenari identificati da condizioni, non da componenti verticali:
  - non loggato + pacchetto youth + acquisto per minore
  - loggato subscriber + nuovo acquisto per minore
  - loggato con minore gia esistente + nuovo acquisto stesso/altro pacchetto
  - loggato con minore gia esistente + acquisto per altro minore
  - non loggato + pacchetto adulto per se stesso
  - loggato subscriber + pacchetto adulto per se stesso
  - loggato con storico adulto + nuovo acquisto/nuova edizione

### Form pubblico (scenario 1)
- Modale fullscreen DaisyUI.
- Campi con label esplicite.
- `birthDate` e data completa (non solo anno).
- Campo sesso vicino a data/luogo nascita come richiesto.
- Luogo nascita e residenza: input con Google Places dal sito pubblico usando API key da dashboard.
- Codice fiscale:
  - usare logica/calcolo in stile progetto maugieri (comuni + belfiore).
  - NON mostrare box separato "codice calcolato".
  - auto-compilare direttamente l input `codice fiscale` in base ai dati form.
- Upload obbligatori scenario 1:
  - foto codice fiscale minore
  - foto codice fiscale adulto
  - documento identita adulto

### Step e UX richiesti
- Navigazione step cliccabile solo in fase sviluppo (per debug/test rapido).
- Step consensi:
  - blocco 1: conferma richiesta iscrizione/tesseramento con check + testo da pacchetto in collapse
  - blocco 2: presa visione informativa privacy con check + testo in collapse
  - blocco 3: consenso trattamento dati per finalita ulteriori + firma
  - blocco 4: firma conferma iscrizione
- Componente firma riusabile tra scenari (salvataggio immagine firma).
- Rimosso check ridondante "accetto termini" se gia coperto nei consensi.

### Username/login pubblico
- Login NON scelto dall utente.
- Regola generazione:
  - base: `nome.cognome`
  - se esiste: `nome.cognome{annoNascita}`
  - se omonimia con stesso anno: suffisso iniziale mese (esempio indicativo richiesto)
- Campo readonly.

### Servizi aggiuntivi
- Step dedicato con servizi fissi e variabili del pacchetto.
- Selezione via check.
- Mostrare prezzo e descrizione per servizio.
- Descrizione dentro collapse.
- Prezzo servizio fisso deve essere visibile anche nel riepilogo.

### Metodi di pagamento (utility + form)
- Utility metodi pagamento con switch di attivazione.
- Metodi previsti:
  - In sede
  - Bonifico bancario
  - PayPal
- Bonifico/PayPal disponibili solo se dati presenti in azienda.
- Se metodo non configurato lato azienda, non deve apparire.
- Se pacchetto ha `firstPaymentOnSite=true`, nel form mostrare solo In sede.
- Descrizioni richieste:
  - In sede: pagamento in sede tramite POS o contanti.
  - Bonifico: bonifico intestato all azienda con IBAN aziendale.
  - PayPal: pagamento con account PayPal o carta su circuito PayPal.
- UI metodi:
  - card con stessa altezza
  - layout 3 colonne con Tailwind (desktop) e colonna singola mobile
  - collapse autochiudibili
  - titoli: `In sede`, `Bonifico Bancario`, `PayPal`

### Riepilogo economico prima invio
- Mostrare sotto metodo pagamento:
  - costo pacchetto
  - costo iscrizione
  - totale servizi aggiuntivi
  - totale evidenziato
- Testi frequenza in italiano:
  - mensile -> al mese
  - settimanale -> alla settimana
  - giornaliero -> al giorno
  - annuale -> all anno

### Submit scenario 1
- Dopo invio: mostrare conferma richiesta, NON login automatico.
- Messaggio conferma:
  - richiesta registrata
  - attivazione subordinata a verifica dati genitore/minore
  - notifica successiva di validazione
  - pagamento dopo validazione con metodi disponibili
  - se primo pagamento in sede, indicare passaggio in sede
  - testo variazioni prezzo:
    - sempre indicare che il totale finale puo variare dopo validazione
    - se presenti servizi variabili, indicare che il prezzo finale verra integrato con importi variabili definiti in validazione

### Dashboard admin - menu e anagrafiche
- Menu aggiornato con `Utenti` dopo Dashboard.
- Sezioni dedicate:
  - `Clienti` (genitori/clienti)
  - `Atleti` (minori + adulti atleta diretto)
- Icone differenziate richieste; per atleti usare `circle-user` (non coppa).
- In tabella clienti mostrare anche i minori collegati (nomi/cognomi).
- Relazioni:
  - un genitore puo avere piu minori
  - un minore ha un solo genitore
  - atleta adulto cliente diretto: gestito come atleta con parent `-`

### Validazione clienti e minori
- In clienti:
  - azione con icona che apre modale scheda
  - se non validato: icona validazione
  - se validato: icona scheda
- Modale cliente:
  - dati editabili
  - collapse documenti
  - bottoni `Verifica` + `Salva`
  - se verificato: `Passa a non verificato` + `Salva`
  - se si valida genitore e ci sono minori non validati: alert conferma
- Minori collegati in modale cliente:
  - apertura dati in collapse
  - evidenza stato validato/non validato sul nome minore
  - validazione minore nel suo collapse
  - documenti minore in collapse quando non validato
- Stessa logica validazione anche nella pagina Atleti (azioni su scheda atleta).

### Certificato medico atleta
- Gestione certificato per tutti gli atleti (minori e adulti):
  - upload documento
  - data scadenza
- Colore scadenza:
  - verde se valido
  - rosso se scaduto
- Filtri atleti:
  - cerca globale testuale
  - filtro pacchetto
  - filtro validazione
  - filtro certificato scaduto/non scaduto
  - range date scadenza da/a
  - reset filtri

### Attivita e pagamenti (impostazione smart)
- Non creare dashboard separata: integrare nel progetto corrente.
- Nuova sezione `Attivita & Pagamenti` con logica centralizzata:
  - vista attivita
  - tab operative: scadenze, scadute, incassi, insoluti, storico
  - apertura contestuale da atleta con filtro id
- Link coerenti:
  - da attivita verso clienti/atleti/pacchetti a seconda del tipo soggetto
  - per atleta=cliente diretto, parent sempre `-` (non cliccabile)

### Piano pagamenti (regole concordate)
- Creazione piano solo dopo validazione workflow richiesta (utente/minore quando necessario).
- Date inizio/fine piano non modificabili dopo salvataggio.
- Piano composto da rate con importi editabili.
- Servizi gestiti singolarmente (non solo totale):
  - importo editabile per singolo servizio
  - aggiungi servizio disponibile
  - elimina servizio con icona
- Ogni rata mantiene snapshot storico servizi attivi+prezzi.
- Metodo pagamento modificabile per rata (admin: in sede/bonifico).
- Pagato/non pagato:
  - in sede: azione pagato
  - bonifico: evidenza + azione pagato
  - una rata pagata non e modificabile, salvo sblocco esplicito
- PayPal:
  - no gestione pagamento manuale backend
  - solo eventuale visualizzazione stato/evento dal frontend
- Regola servizi su rate:
  - attivazione/disattivazione/modifica/cancellazione agisce solo su rata corrente non pagata
  - mai su rate antecedenti
  - se cambia mese, non agisce piu sulla rata precedente

### Stato pagamenti e filtri periodo (definiti oggi)
- Filtro mese:
  - non deve consentire mesi futuri (max mese corrente).
- Definizioni etichette:
  - In scadenza: rata mese corrente non pagata e non oltre data limite
  - Scaduta: rata mese corrente non pagata oltre data limite
  - Insoluti: rate non pagate dei mesi precedenti
  - Pagata: rata pagata del mese corrente o qualsiasi mese (tab incassi)
- Tab:
  - Scadenze: solo pending del mese corrente non scadute
  - Scadute: solo pending del mese corrente scadute
  - Insoluti: solo pending dei mesi precedenti
  - Incassi: pagate cumulative fino al mese filtro
- Stato in tab Attivita:
  - mostra `Scaduta` quando c e rata corrente scaduta
  - se esistono mesi precedenti non pagati, mostra dettaglio piccolo `Insoluti: N`
  - evita doppio badge ambiguo in conflitto

### Dati mock richiesti oggi
- `Tennis Base` riconfigurato come pacchetto mensile a periodo:
  - inizio: 2026-01-01
  - fine: 2026-07-31
  - scadenza rata mensile: giorno 5
- Caso `Sara Gialli`:
  - iscritta da gennaio
  - gennaio pagato (con iscrizione)
  - febbraio e marzo non pagati
- Nota operativa mock:
  - in presenza di dati su localStorage, i seed possono non riflettersi finche non si puliscono le chiavi coinvolte.

### Decisione definitiva storico vs operativo (edizioni)
- Il sistema deve lavorare per **edizione pacchetto**.
- Una edizione chiusa resta chiusa per logica operativa.
- `Attivita & Pagamenti` (operativo) deve mostrare solo attivita legate a **edizioni aperte**.
- `Storico attivita` deve essere sezione separata (non tab operativa) e mostrare solo attivita legate a **edizioni chiuse**.
- In `Storico attivita` resta consentita la manutenzione fiscale (incassi/insoluti/residui) anche dopo chiusura edizione.
- Determinazione chiusura edizione:
  - `durationType=period` -> edizione chiusa se `periodEndDate < oggi`
  - `durationType=single-event` -> edizione chiusa se `eventDate < oggi`

## Aggiornamento odierno (2026-03-09)

### Frontend pubblico - scenario `subscriber` loggato
- Scenario `subscriber` loggato + acquisto pacchetto `youth`:
  - sezione genitore: `nome`, `cognome`, `email` visibili ma non modificabili
  - NON richiedere `login` e `password`
  - continuare a richiedere gli altri campi necessari
- Submit:
  - usare sempre `session.userId` (no fallback su altri utenti)
  - conversione ruolo `subscriber -> client` al primo acquisto confermata
- Regola sicurezza dati:
  - nessun riuso/aggancio cliente di altri utenti in base a CF quando l utente e loggato

### Frontend pubblico - documenti adulti per subscriber
- Anche su pacchetto `adult`, se utente `subscriber` loggato:
  - upload foto CF adulto obbligatorio
  - upload documento identita adulto obbligatorio
  - obbligatorieta valida sia in validazione step sia in submit

### Frontend pubblico - scenari `client` loggato (pacchetti minori)
- Caso pacchetto gia acquistato per almeno un minore collegato:
  - mostrare disclaimer dedicato
  - dopo disclaimer, permettere due percorsi:
    - acquisto per altro minore gia collegato (selezione minore)
    - acquisto per nuovo ulteriore minore
- Caso acquisto per minore gia collegato:
  - nessuna sezione minore
  - nessuna sezione genitore
  - form parte direttamente da sezione 3 (servizi) + sezioni successive
- Caso acquisto per nuovo ulteriore minore (cliente gia validato):
  - sezione minore presente
  - sezione genitore assente

### Backend operativo/admin - validazioni
- Nei flussi `client` loggato con cliente gia validato:
  - non ripetere validazione genitore
  - eventuale validazione richiesta solo per nuovo minore collegato

### Post-submit pubblico
- Nei casi in cui non e prevista una nuova validazione:
  - non mostrare messaggi di verifica/attivazione
  - non mostrare testi prezzo legati a "dopo validazione"
- Restano i messaggi operativi di pagamento (metodi disponibili / primo pagamento in sede)

### Attivita e chiavi tecniche
- Fix creazione attivita da submit pubblico:
  - creazione esplicita `AthleteActivity` su acquisto pubblico (minor/direct)
- Fix collisione chiavi attivita:
  - chiave primaria atleta: `minor-{id}` / `direct-{id}`
  - pacchetti aggiuntivi stesso atleta: `minor-{id}::{packageId}` / `direct-{id}::{packageId}`
- Aggiunta riconciliazione da enrollments per allineare attivita mancanti senza rifare i flussi

### Correzioni dati collegamento cliente/minori
- Aggiunta routine di riallineamento collegamenti `minor.clientId` su dati gia sporchi, usando i riferimenti enrollment quando deterministici.

### UI Atleti
- Colonna coperture iscrizione:
  - badge con nome iscrizione (es. Agonista, Campo scuola)
  - data scadenza mostrata sotto in testo piccolo

### Refactor tecnici
- Introdotto helper comune storage:
  - `src/lib/storage.ts`
  - `readJsonArray<T>()`, `writeJsonValue<T>()`
- Eliminata duplicazione parser/storage in moduli che la replicavano.

## Aggiornamento odierno (2026-03-12)

### Open Day - direzione dominio approvata
- Gli `Open Day` NON vanno modellati come pacchetti senza pagamento.
- Devono essere una entita separata, con prodotto base + edizioni annuali, coerente con la logica gia usata per i pacchetti ma con dominio distinto.
- Nuovo ruolo frontend approvato: `prospect`
  - serve per utenti noti alla piattaforma che partecipano agli open day senza essere ancora `subscriber` o `client`
  - utile anche per metriche di conversione verso `subscriber` / `client`
- Entita dominio previste:
  - `OpenDayProduct`
  - `OpenDayEdition`
  - `OpenDayGroup`
  - `OpenDaySession`
  - `OpenDayProspect`
  - `OpenDayMinorAthlete`
  - `OpenDayAdultAthlete`
  - `OpenDayParticipation`
- Anagrafiche Open Day minimali:
  - `OpenDayProspect`: nome, cognome, email, telefono, telefono secondario, data nascita, sesso, ruolo
  - `OpenDayMinorAthlete`: nome, cognome, data nascita, sesso
  - `OpenDayAdultAthlete`: nome, cognome, data nascita, sesso, email, telefono
- Gli Open Day:
  - condividono categorie e campi con i pacchetti
  - NON hanno azienda
  - NON hanno iscrizione/assicurazione
  - NON hanno servizi aggiuntivi
  - NON hanno pagamenti
  - NON richiedono documenti nel form pubblico
  - NON richiedono luogo di nascita
  - NON richiedono residenza
  - NON hanno workflow di validazione
- Gruppi/sessioni open day:
  - i gruppi hanno filtro sesso + range anno nascita + campo
  - le sessioni hanno data specifica e fascia oraria
  - nel form pubblico l utente puo selezionare piu gruppi/sessioni compatibili
- Le anagrafiche open day devono restare separate dagli atleti dei pacchetti, ma con collegamenti opzionali a:
  - `client`
  - `minor`
  - `direct athlete`
- Primo blocco tecnico approvato:
  - introduzione ruolo `prospect`
  - introduzione moduli storage/tipi separati per catalogo e partecipazioni open day
- Secondo blocco tecnico approvato:
  - formalizzazione scenari open day in modulo separato
  - scenari distinti per:
    - guest
    - `prospect`
    - `client`
    - audience `adult` / `youth`
    - presenza o meno di minori gia collegati
  - la risoluzione scenario deve produrre anche flag operativi per la UI:
    - step account richiesto o meno
    - step tutore richiesto o meno
    - step partecipante richiesto o meno
    - possibilita di selezionare minore esistente
    - possibilita di creare nuovo minore
    - riuso dati profilo quando disponibile
- Terzo blocco tecnico approvato:
  - creazione controller/gate frontend dedicato `PublicOpenDayModal`
  - componente separata dal wizard pacchetti
  - gestisce:
    - disclaimer/riuso dati per `prospect` e `client`
    - scelta minore esistente vs nuovo minore quando applicabile
    - esposizione dei flag scenario risolti come base per il form finale
  - in questa fase il controller NON e ancora agganciato alle pagine pubbliche e NON contiene ancora il form definitivo di iscrizione open day
- Quarto blocco tecnico approvato:
  - introdotto `PublicOpenDayForm` come primo form reale open day
  - integrato dentro `PublicOpenDayModal`
  - copre il flusso base:
    - dati prospect/tutore
    - dati partecipante adulto o minore
    - scelta sessioni compatibili per eta/sesso
    - consensi e firme
    - submit su storage open day
  - il form non richiede documenti, servizi o pagamenti
  - in caso guest crea utente frontend con ruolo `prospect`
  - in caso di dati prospect gia esistenti da guest blocca con messaggio che richiede login
  - anche in questa fase il flusso open day NON e ancora collegato alle pagine pubbliche / route visibili
- Quinto blocco tecnico approvato:
  - introdotta pagina admin `OpenDayPage`
  - collegata a route gestionale `/app/open-day`
  - collegata al menu admin
  - CRUD base prodotto+edizione open day con campi minimi:
    - codice
    - titolo
    - descrizione
    - disclaimer
    - categoria
    - audience
    - eta min/max
    - anno edizione
    - durata singolo giorno / periodo
    - stato prodotto
    - stato edizione
  - in questa fase gruppi/sessioni e partecipazioni open day sono ancora fuori dalla pagina admin principale
- Sesto blocco tecnico approvato:
  - `OpenDayPage` gestisce ora gruppi e sessioni open day direttamente nel draft della modale admin
  - il tab `Campi e Gruppi` permette:
    - creazione/modifica/cancellazione gruppi
    - definizione di campo, sesso, range anno nascita, capienza, stato
    - definizione di sessioni datate multiple con orario/capienza/stato
  - `open-day-catalog.ts` salva prodotto, edizione, gruppi e sessioni in modo atomico su create/update
- Settimo blocco tecnico approvato:
  - open day esposti anche nel frontend pubblico
  - nuove route:
    - `/open-day`
    - `/open-day/:editionId`
  - nuove pagine:
    - `PublicOpenDaysPage`
    - `PublicOpenDayDetailPage`
  - entrambe aprono `PublicOpenDayModal` sugli open day pubblicati
  - `public-content.ts` espone il catalogo pubblico open day tramite helper dedicati
- Ottavo blocco tecnico approvato:
  - introdotta pagina admin `OpenDayParticipationsPage`
  - collegata a route gestionale `/app/open-day/registrazioni`
  - collegata al menu admin come voce separata rispetto al catalogo open day
  - la pagina gestisce:
    - tabella partecipazioni open day
    - filtri per edizione, stato, tipo partecipante e ricerca testuale
    - scheda dettaglio con dati prospect/tutor, partecipante e sessioni selezionate
    - aggiornamento stato partecipazione
  - `open-day-records.ts` espone ora evento di change e update record per supportare la gestione admin reattiva
- Correzione di dominio approvata:
  - sugli open day NON esiste workflow di validazione prospect/tutor
  - il `prospect` serve come account/lead per analisi e riuso dati, non come soggetto da validare
  - quindi negli open day:
    - niente `validationStatus`
    - niente badge `Validato / Da validare`
    - niente azione `Verifica prospect`
  - la gestione admin open day resta centrata su:
    - anagrafica prospect
    - anagrafica partecipante
    - sessioni selezionate
    - stato partecipazione
- Nono blocco tecnico approvato:
  - `OpenDayPage` gestisce le edizioni come i pacchetti:
    - tabella principale per prodotto
    - modale secondaria elenco edizioni per prodotto
    - creazione nuova edizione sul prodotto esistente
  - la modale fullscreen open day ha ora anche tab `WhatsApp`
  - il collegamento WhatsApp e definito a livello `OpenDayEdition`, non prodotto
  - ogni edizione open day salva:
    - `whatsappAccountIds`
    - `whatsappGroupLink`
  - gli account selezionabili arrivano dalla stessa utility WhatsApp usata dai pacchetti
- Decimo blocco tecnico approvato:
  - `OpenDayParticipationsPage` e ora gestione operativa, non sola consultazione
  - la scheda partecipazione permette:
    - modifica anagrafica prospect/tutor
    - modifica anagrafica partecipante
    - modifica sessioni selezionate
    - modifica stato partecipazione
    - cancellazione partecipazione
  - le anagrafiche open day restano minimali anche in gestione:
    - niente luogo di nascita
    - niente residenza
    - niente workflow di validazione
  - le sessioni selezionabili in modifica rispettano sempre sesso ed eta del partecipante
  - se sesso o data nascita cambiano, le sessioni non piu compatibili vengono rimosse dal draft
- Undicesimo blocco tecnico approvato:
  - `OpenDayParticipationsPage` usa ora filtri allineati al dominio open day:
    - vista `Attive` / `Storico`
    - `Categoria`
    - `Gruppo`
    - `Da` / `A` sulle date sessione
    - `Stato`
    - `Tipo`
  - il filtro `Categoria` mostra solo categorie realmente presenti nella vista corrente
  - il filtro `Gruppo` mostra solo gruppi realmente presenti nella vista corrente
  - la colonna pianificazione e stata separata in:
    - `Gruppo`
    - `Data / Orario`
  - `Data / Orario` rende una riga per sessione
- Dodicesimo blocco tecnico approvato:
  - nelle registrazioni open day la colonna `Azioni` e stata riallineata al pattern clienti/pacchetti
  - azioni disponibili:
    - icona scheda `FileText` per aprire la gestione
    - icona `Trash2` per eliminazione con conferma
    - icona `MessageCircle` per apertura chat WhatsApp verso il numero del prospect/tutor
  - il bottone WhatsApp e attivo solo se il numero del prospect/tutor e presente
- Tredicesimo blocco tecnico approvato:
  - `OpenDayParticipationsPage` ha export dedicato come attivita/pagamenti
  - export basato esclusivamente sui dati filtrati della vista corrente
  - formati disponibili:
    - `xlsx`
    - `pdf`
    - `docx`
  - colonne export correnti:
    - Open Day
    - Categoria
    - Atleta
    - Tipo
    - Tutor / Prospect
    - Email
    - Telefono
    - Gruppo
    - Data / Orario
    - Stato
    - Data creazione
  - se una partecipazione contiene piu sessioni, l export genera una riga per ogni sessione
- Quattordicesimo blocco tecnico approvato:
  - il menu admin `Open Day` e stato riallineato al pattern `Utility`
  - sidebar aperta:
    - menu padre `Open Day`
    - sottomenu `Crea e gestisci Open Day`
    - sottomenu `Registrazioni Open Day`
  - sidebar chiusa:
    - fallback a due voci singole coerente con il layout attuale
