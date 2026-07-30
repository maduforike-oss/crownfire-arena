/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CROWDFIRE_SERVICE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
