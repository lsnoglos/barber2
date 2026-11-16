// Verificación de Firebase ID tokens con WebCrypto en Cloudflare Workers.
// Solo se confía en la firma RS256, nunca en el correo recibido del navegador.
const PROJECT_ID = "barbercontrol2";
const KEYS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let keysCache = null;
let keysUntil = 0;

export class AuthError extends Error {}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new AuthError("Token inválido.");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

function parsePart(value) {
  try { return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))); }
  catch (_) { throw new AuthError("Token inválido."); }
}

async function publicKeys() {
  if (keysCache && Date.now() < keysUntil) return keysCache;
  const res = await fetch(KEYS_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("No se pudieron consultar las claves públicas de Google.");
  const payload = await res.json();
  if (!Array.isArray(payload.keys) || !payload.keys.length) throw new Error("Claves públicas no disponibles.");
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") || "")?.[1] || 300);
  keysCache = payload.keys;
  keysUntil = Date.now() + Math.min(Math.max(maxAge, 60), 3600) * 1000;
  return keysCache;
}

export async function verifyFirebaseIdToken(token) {
  if (typeof token !== "string" || token.length > 8192) throw new AuthError("Token inválido.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new AuthError("Token inválido.");
  const header = parsePart(parts[0]);
  if (header?.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
    throw new AuthError("Firma no admitida.");
  }
  const keys = await publicKeys();
  const jwk = keys.find(key => key.kid === header.kid && key.kty === "RSA" && key.alg === "RS256");
  if (!jwk) throw new AuthError("Clave de firma no reconocida.");
  const cryptoKey = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const bytes = new TextEncoder().encode(parts[0] + "." + parts[1]);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", cryptoKey, decodeBase64Url(parts[2]), bytes
  );
  if (!valid) throw new AuthError("Firma inválida.");
  const claims = parsePart(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.aud !== PROJECT_ID ||
    claims.iss !== "https://securetoken.google.com/" + PROJECT_ID ||
    typeof claims.sub !== "string" || claims.sub.length < 1 || claims.sub.length > 128 ||
    typeof claims.iat !== "number" || claims.iat > now ||
    typeof claims.exp !== "number" || claims.exp <= now ||
    typeof claims.auth_time !== "number" || claims.auth_time > now ||
    claims.email_verified !== true ||
    claims.firebase?.sign_in_provider !== "google.com"
  ) throw new AuthError("Token vencido o no autorizado.");
  return claims;
}
