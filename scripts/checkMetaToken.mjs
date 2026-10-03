// Read-only check of the consolidated Meta token: which permissions it has and
// which Pages / Instagram accounts it can reach. Posts nothing, prints no secrets.
//   node --env-file=.env scripts/checkMetaToken.mjs [TOKEN_ENV_NAME]
const G = "https://graph.facebook.com/v20.0";
const tokenEnv = process.argv[2] ?? "FACEBOOK_PAGE_ACCESS_TOKEN";
const token = process.env[tokenEnv];
if (!token) { console.error(`${tokenEnv} is not set`); process.exit(1); }

const get = async (path) => {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${G}/${path}${sep}access_token=${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data, err: data?.error?.message };
};

const perms = await get("me/permissions");
if (perms.ok) {
  const granted = perms.data.data.filter((p) => p.status === "granted").map((p) => p.permission);
  console.log("Permissions:", granted.join(", ") || "(none listed)");
  for (const need of ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "instagram_basic", "instagram_content_publish"]) {
    console.log(`  ${granted.includes(need) ? "OK     " : "MISSING"} ${need}`);
  }
} else console.log("Permissions: not readable for this token type —", perms.err);

const accounts = await get("me/accounts?fields=id,name&limit=100");
console.log(accounts.ok ? `Pages visible via /me/accounts (${accounts.data.data.length}):` : `/me/accounts failed: ${accounts.err}`);
if (accounts.ok) for (const p of accounts.data.data) console.log(`  ${p.id}  ${p.name}`);

const pages = { "main Page": process.env.FACEBOOK_PAGE_ID, "India cricket Page": "359420874511841" };
for (const [label, id] of Object.entries(pages)) {
  if (!id) { console.log(`${label}: id not set`); continue; }
  const r = await get(`${id}?fields=name,access_token,instagram_business_account`);
  console.log(`${label} (${id}):`, r.ok
    ? `${r.data.name} — page token exchange ${r.data.access_token ? "OK" : "NO TOKEN RETURNED"}${r.data.instagram_business_account ? `, IG ${r.data.instagram_business_account.id}` : ""}`
    : `FAILED — ${r.err}`);
}

const ig = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
if (ig) {
  const r = await get(`${ig}?fields=username`);
  console.log(`Instagram (${ig}):`, r.ok ? `@${r.data.username}` : `FAILED — ${r.err}`);
}
