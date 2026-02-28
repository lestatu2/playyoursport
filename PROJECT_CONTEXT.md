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

## Pacchetti (pagina principale, non in Utility)
- Pagina: `PackagesPage` nel menu principale.
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
- Regola UI condivisa: mantenere margine verticale coerente (`mb-4`) tra input e switch quando richiesto.

### Iscrizioni
- Select iscrizione da utility iscrizioni.
- Input costo iscrizione.

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

## Dati mock aggiornati
- Categorie mock richieste:
  - Calcio
  - Tennis
  - Padel
  - Campo Scuola
- Creati pacchetti mock associati alle categorie.

## Note tecniche recenti
- Fix TypeScript/ESLint progressivi su:
  - JSX namespace/type import
  - auth typings (`SaveUserResult`)
  - `FlagIcon` typing con `country-flag-icons`
  - hook dependencies / frammenti duplicati principali
  - export mancanti su `package-catalog` (additional services / whatsapp)
  - regex lint fix: uso `\D` al posto di `[^\d]`

## Regole operative concordate
- Non duplicare pagine omologhe: usare `PackagesPage` come pagina pacchetti principale.
- Evitare regressioni di naming/file (rinominare correttamente, non creare doppioni).
- Mantenere UI coerente con richieste puntuali di spacing e ordine tab.
- Aggiornare questo file ad ogni blocco funzionale importante.
