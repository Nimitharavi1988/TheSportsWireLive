// The R2 bucket for photos uploaded in admin (wrangler.jsonc MEDIA_BUCKET).
declare global {
  interface CloudflareEnv {
    MEDIA_BUCKET?: NonNullable<CloudflareEnv["NEXT_INC_CACHE_R2_BUCKET"]>;
  }
}

export {};
