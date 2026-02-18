/// <reference types="vite/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly API_KEY: string;
    readonly RESEND_API_KEY: string;
    readonly VERIFIED_DOMAIN: string;
    [key: string]: string | undefined;
  }
}
