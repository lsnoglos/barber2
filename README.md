# BarberControl 2

Plataforma multibarbería en desarrollo.

## Estado

Etapa inicial de despliegue en Cloudflare Workers. **No está habilitada la autenticación, la base de datos, el catálogo ni las reservas.** No utilizar con información de clientes reales hasta implementar y validar seguridad y permisos.

## Arquitectura prevista

- Cloudflare Workers: backend de la aplicación.
- Cloudflare D1: base de datos multinegocio.
- Firebase Authentication: acceso con cuentas Google.
- Cloudinary: fotografías optimizadas.
- Google Calendar: sincronización de citas.

El proyecto BarberControl original permanece independiente.
