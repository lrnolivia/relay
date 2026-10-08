const ACCESS_ISSUER = "https://loewfi.cloudflareaccess.com";
const RELAY_ACCESS_AUD = "7d90e5b24c6c74b4bd0fb36699e0a65a3aa25057763986ca1b8ce1a52d528819";

// One fixed Access boundary, shared by the product and independent recovery.
// Factory instances isolate key caches in tests; callers cannot change trust.
export function createAccessVerifier({requestKeys=(...args)=>fetch(...args),clock=()=>Date.now()}={}){
let jwksCache = { expires: 0, keys: [] };
function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function getAccessKeys() {
  const now = clock();
  if (jwksCache.expires > now && jwksCache.keys.length) return jwksCache.keys;
  const response = await requestKeys(ACCESS_ISSUER + "/cdn-cgi/access/certs", {
    redirect: "manual", signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error("Unable to load Access signing keys");
  const data = await response.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  jwksCache = { expires: now + 300000, keys };
  return keys;
}

async function verifyAccessJwt(request) {
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token || token.length > 8192) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const now = clock() / 1000;
    if (
      header.alg !== "RS256" ||
      typeof header.kid !== "string" ||
      claims.iss !== ACCESS_ISSUER ||
      !aud.includes(RELAY_ACCESS_AUD) ||
      typeof claims.exp !== "number" || claims.exp <= now ||
      (typeof claims.nbf === "number" && claims.nbf > now)
    ) return null;

    const keys = await getAccessKeys();
    const jwk = keys.find(k => k.kid === header.kid && k.kty === "RSA");
    if (!jwk) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1])
    );
    return ok ? { token, claims } : null;
  } catch {
    return null;
  }
}

return verifyAccessJwt;
}
export const verifyAccessJwt=createAccessVerifier();
