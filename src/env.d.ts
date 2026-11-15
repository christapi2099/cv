/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Canonical origin (plan §3 env table). */
  readonly SITE_URL?: string;
  /** D12: the progressive contact form only ships when this is provisioned. */
  readonly CONTACT_ENDPOINT?: string;
  /** Review-only routes (`/dev/design`); absent from the plain production build. */
  readonly VITE_DEV_ROUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
