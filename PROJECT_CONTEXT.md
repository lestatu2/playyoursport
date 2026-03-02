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

## Backend Laravel - linee guida concordate
Obiettivo: mantenere separazione netta tra prodotto base e edizione annuale.

### Modello DB consigliato
- Tabella `products` (anagrafica base):
  - `id`, `code` (unique), `name`, `category_id`, `company_id`, `audience`, `status`, timestamps
- Tabella `product_editions` (configurazione per anno):
  - `id`, `product_id` (FK), `edition_year`, `status` (`draft|published|archived`), timestamps
  - campi di configurazione edizione: durata, pagamento, gruppi, whatsapp, contratto, servizi, trainer, ecc.
- Vincolo fondamentale DB:
  - unique composita (`product_id`, `edition_year`)

### Tabelle figlie edizione (consigliate)
- `product_edition_groups`
- `product_edition_group_schedules`
- `product_edition_trainers`
- `product_edition_whatsapp_accounts`
- `product_edition_services`
- `product_edition_gallery`

### API Laravel consigliate (REST)
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/{id}`
- `GET /api/products/{id}/editions`
- `POST /api/products/{id}/editions`
- `GET /api/products/{id}/editions/{editionId}`
- `PATCH /api/products/{id}/editions/{editionId}`
- `DELETE /api/products/{id}/editions/{editionId}`
- Opzionale: `POST /api/products/{id}/editions/{editionId}/clone` con `target_year`

### Regole server importanti
- Validare unicita anno edizione per prodotto (oltre al vincolo DB).
- Tutte le operazioni gestionali (iscrizioni/pagamenti/gruppi) devono riferirsi a `editionId`.
- Le edizioni pubblicate devono essere trattate come snapshot versionate (no modifiche retroattive non controllate).
