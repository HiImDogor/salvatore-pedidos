# Activación segura de pedidos y Telegram

Estos cambios dejan de crear y leer pedidos directamente desde el navegador. Antes de publicar la nueva web, activa el backend en Supabase.

## 1. Rotar el token de Telegram

En BotFather, usa `/revoke` para el bot actual y genera un token nuevo. El anterior quedó expuesto en una versión previa del frontend y no debe volver a utilizarse.

## 2. Aplicar la migración SQL

En **Supabase Dashboard → SQL Editor**, ejecuta completo [supabase-migration-secure-orders.sql](supabase-migration-secure-orders.sql).

La migración:

- impide que visitantes lean datos de pedidos;
- impide inserciones directas desde el navegador;
- conserva la lectura para administradores autenticados;
- crea una operación transaccional para orden + ítems;
- aplica un límite básico de 5 intentos por IP cada 5 minutos.

## 3. Configurar y desplegar la Edge Function

Instala e inicia sesión en la CLI de Supabase, enlaza el proyecto y define secretos. Sustituye los valores entre comillas:

```powershell
supabase login
supabase link --project-ref dwohhuplwizywaucftcp
supabase secrets set TELEGRAM_BOT_TOKEN="TOKEN_NUEVO" TELEGRAM_CHAT_ID="837662009" ALLOWED_ORIGINS="https://tu-dominio.cl,http://localhost:3000" RATE_LIMIT_SALT="cadena-larga-aleatoria"
supabase functions deploy create-order --no-verify-jwt
```

`ALLOWED_ORIGINS` debe contener el dominio público exacto donde se publique la web. No uses `*`.

## 4. Verificación antes de publicar

1. Cierra sesión en el panel y confirma que no puedes leer pedidos desde la consola del navegador.
2. Inicia sesión con un usuario de `admin_users` y verifica que el panel muestra comandas.
3. Genera un pedido de prueba: debe guardarse, aparecer en administración y llegar a Telegram con el botón de WhatsApp.
4. Intenta alterar el precio en DevTools: la Edge Function debe ignorarlo y calcular el total real.
