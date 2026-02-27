# PlayYourSport - Contesto Progetto

## Obiettivo
Costruire una piattaforma per la gestione di:
- campi scuola calcio
- academy di calcio

## Stato attuale
- Esiste gia un progetto pilota sviluppato in WordPress.
- Obiettivo: migrare a uno stack moderno.

## Stack target
- Frontend: React
- Backend: Laravel

## Modalita di lavoro attuale
- In questa fase lavoriamo solo con dati mockati in JSON.
- Il focus iniziale e su:
  - login
  - utenti
  - tipi di utenza (ruoli)

## Stato implementazione frontend (React + TypeScript)
- Progetto migrato a TypeScript (`.ts/.tsx`) con configurazione `tsconfig`.
- Login con autenticazione mock da JSON:
  - file dati: `src/data/mock-auth.json`
  - gestione sessione/ruoli: `src/lib/auth.ts`
- Ruoli attualmente definiti:
  - `administrator`
  - `editor-admin`
  - `trainer`
  - `subscriber`
  - `client`
- Dashboard amministrativa responsive:
  - menu sinistro con icone
  - possibilita di espandere/ridurre il menu
  - contenuto a destra
- Sezione `Configurazione`:
  - visibile solo a `administrator`
  - tab: `Utenti` e `Styling`
  - editing etichette per ogni ruolo (persistenza in `localStorage`)
  - selezione tema DaisyUI da JSON mock (persistenza in `localStorage`)
- Libreria icone in uso: `lucide-react`

## Note operative
- Questo file va aggiornato progressivamente durante il progetto per mantenere allineato il contesto di lavoro.
