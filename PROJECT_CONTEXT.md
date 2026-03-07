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
