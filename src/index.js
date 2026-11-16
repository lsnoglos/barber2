const page = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>BarberControl 2 — Preparación</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c111b;color:#f3f5f9;padding:20px}
main{max-width:560px;background:#171e2c;border:1px solid #303a4d;border-radius:20px;padding:36px;text-align:center;box-shadow:0 18px 60px #0004}
h1{font-size:clamp(28px,5vw,42px);margin:10px 0}p{line-height:1.6;color:#c4ccd9}.tag{display:inline-block;padding:8px 12px;background:#24344a;border-radius:999px;color:#9ee4ff;font-size:13px}
small{display:block;margin-top:24px;color:#9aa5b8}
</style>
</head>
<body><main><span class="tag">Despliegue de prueba</span><h1>✂ BarberControl 2</h1><p>La aplicación se ha publicado correctamente en Cloudflare Workers.</p><p>Estamos preparando la plataforma multibarbería. El inicio de sesión y las reservas todavía no están habilitados.</p><small>Esta página no recibe datos de clientes.</small></main></body></html>`;
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      let dbReady = false;
      try {
        const check = await env.DB?.prepare("SELECT 1 AS ok").first();
        dbReady = check?.ok === 1;
      } catch (_) {
        dbReady = false;
      }
      return Response.json({
        ok: dbReady,
        project: "barber2",
        stage: "database-connected",
        database: dbReady ? "connected" : "unavailable"
      }, {
        status: dbReady ? 200 : 503,
        headers: {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
      });
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(page, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }
    return new Response("No encontrado", {status:404, headers:{"Content-Type":"text/plain; charset=utf-8"}});
  }
};
