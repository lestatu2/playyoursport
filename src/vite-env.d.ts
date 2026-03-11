/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTRACTS_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
