/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** HeiGIT ohsome API key, embedded at build time (see README). */
  readonly VITE_OHSOME_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
