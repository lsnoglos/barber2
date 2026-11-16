import { page } from "./page.js";
import { client } from "./client.js";
import { verifyFirebaseIdToken, AuthError } from "./firebase-auth.js";

const csp = [
  "default-src 'self'",
  "script-src 'self' https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com",
  "frame-src https://barbercontrol2.firebaseapp.com https://accounts.google.com https://*.google.com",
  "img-src 'self' data: https://*.googleusercontent.com",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'"
].join("; ");

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Authorization"
    }
  });
}

async function currentAccount(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!/^Bearer [^\s]+$/.test(auth)) return json({ error: "Inicia sesión con Google." }, 401);
  try {
    const claims = await verifyFirebaseIdToken(auth.slice(7));
    if (!env.DB) return json({ error: "Base de datos no disponible." }, 503);
    const user = await env.DB.prepare(
      "SELECT id, status FROM users WHERE firebase_uid = ? LIMIT 1"
    ).bind(claims.sub).first();
    if (user && user.status !== "active") {
      return json({ error: "Esta cuenta fue deshabilitada por la administración." }, 403);
    }
    const superAdmin = user ? Boolean(await env.DB.prepare(
      "SELECT 1 AS allowed FROM platform_admins WHERE user_id = ? LIMIT 1"
    ).bind(user.id).first()) : false;
    const businesses = user ? (await env.DB.prepare(
      "SELECT b.id, b.name, b.slug, bm.role FROM business_members bm JOIN businesses b ON b.id = bm.business_id WHERE bm.user_id = ? AND bm.status = 'active' AND b.status = 'active' ORDER BY b.name LIMIT 100"
    ).bind(user.id).all()).results : [];
    return json({
      authenticated: true,
      access: superAdmin ? "superadmin" : businesses.length ? "member" : "pending",
      superAdmin,
      identity: {
        uid: claims.sub,
        email: typeof claims.email === "string" ? claims.email : "",
        name: typeof claims.name === "string" ? claims.name : ""
      },
      businesses
    });
  } catch (error) {
    if (error instanceof AuthError) return json({ error: "Sesión inválida. Vuelve a iniciar sesión." }, 401);
    return json({ error: "No se pudo comprobar el acceso. Intenta nuevamente." }, 503);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      let dbReady = false;
      try {
        const check = await env.DB?.prepare("SELECT 1 AS ok").first();
        dbReady = check?.ok === 1;
      } catch (_) { dbReady = false; }
      return json({
        ok: dbReady,
        project: "barber2",
        stage: "google-auth-preview",
        database: dbReady ? "connected" : "unavailable"
      }, dbReady ? 200 : 503);
    }
    if (url.pathname === "/api/me") {
      if (request.method !== "GET") return json({ error: "Método no permitido." }, 405);
      return currentAccount(request, env);
    }
    if (request.method !== "GET") return new Response("Método no permitido", { status: 405 });
    if (url.pathname === "/app.js") {
      return new Response(client, {
        headers: {
          "Content-Type": "text/javascript; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(page, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": csp,
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin"
        }
      });
    }
    return new Response("No encontrado", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
};
