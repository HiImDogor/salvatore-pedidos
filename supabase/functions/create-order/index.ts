import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type IncomingItem = {
  productId?: string;
  quantity?: number;
  extras?: string[];
  notes?: string;
};

type CatalogItem = {
  name: string;
  price: number;
  world: 'pizza' | 'waffle';
  allowedExtras: string[];
};

const EXTRA_PRICE = 500;
const DELIVERY_COST = 1000;
const MAX_ITEMS_PER_ORDER = 30;
const MAX_TEXT_LENGTH = 500;

const PIZZA_EXTRAS = [
  'Extra Mozzarella', 'Extra Pepperoni', 'Champiñones', 'Tocino',
  'Aceitunas Negras', 'Cebolla', 'Tomate fresco', 'Albahaca'
];
const WAFFLE_EXTRAS = ['Extra salsa de chocolate', 'Chispas de chocolate', 'Extra manjar'];

const CATALOG: Record<string, CatalogItem> = {
  margarita: { name: 'Margarita', price: 6500, world: 'pizza', allowedExtras: PIZZA_EXTRAS },
  jamon: { name: 'Jamón & Champiñón', price: 7000, world: 'pizza', allowedExtras: PIZZA_EXTRAS },
  napolitana: { name: 'Napolitana', price: 7500, world: 'pizza', allowedExtras: PIZZA_EXTRAS },
  pepperoni: { name: 'Pepperoni', price: 7500, world: 'pizza', allowedExtras: PIZZA_EXTRAS },
  capricciosa: { name: 'Capricciosa', price: 8000, world: 'pizza', allowedExtras: PIZZA_EXTRAS },
  longaniza: { name: 'Longaniza', price: 7500, world: 'pizza', allowedExtras: PIZZA_EXTRAS },
  pesto: { name: 'Pesto', price: 7500, world: 'pizza', allowedExtras: PIZZA_EXTRAS },
  bbq: { name: 'BBQ', price: 7500, world: 'pizza', allowedExtras: PIZZA_EXTRAS },
  waffle: { name: 'Waffle relleno de manjar', price: 1000, world: 'waffle', allowedExtras: WAFFLE_EXTRAS },
  pepsi: { name: 'Pepsi', price: 1000, world: 'pizza', allowedExtras: [] },
  bilz: { name: 'Bilz', price: 1000, world: 'pizza', allowedExtras: [] },
  pap: { name: 'Pap', price: 1000, world: 'pizza', allowedExtras: [] },
  kem: { name: 'Kem Xtreme', price: 1000, world: 'pizza', allowedExtras: [] },
  seven: { name: '7Up', price: 1000, world: 'pizza', allowedExtras: [] },
  zero: { name: 'Pepsi Zero', price: 1000, world: 'pizza', allowedExtras: [] }
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function response(body: Record<string, unknown>, status: number, corsHeaders: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...corsHeaders } });
}

function text(value: unknown, limit = MAX_TEXT_LENGTH) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]!));
}

async function hash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function formatCLP(value: number) {
  return `$${value.toLocaleString('es-CL')}`;
}

async function notifyTelegram(order: Record<string, unknown>, items: Record<string, unknown>[]) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
  if (!botToken || !chatId) return;

  try {
    const phone = String(order.client_phone ?? '').replace(/\D/g, '');
    const delivery = order.delivery_type === 'pickup'
      ? 'Retiro en local (Campillo 920)'
      : `Delivery a domicilio<br/><b>Dirección:</b> ${escapeHtml(String(order.delivery_address || 'Sin dirección indicada'))}`;
    const payment = order.payment_method === 'cash' ? 'Efectivo' : 'Transferencia bancaria';
    const lines = items.map(item => {
      const extras = Array.isArray(item.extras) && item.extras.length
        ? `<br/>↳ <b>Extras:</b> ${escapeHtml(item.extras.join(', '))}`
        : '';
      const notes = item.notes ? `<br/>↳ <b>Nota:</b> ${escapeHtml(String(item.notes))}` : '';
      return `• ${item.quantity}x <b>${escapeHtml(String(item.product_name))}</b> — ${formatCLP(Number(item.total_price))}${extras}${notes}`;
    }).join('\n');
    const instructions = order.notes ? `\n<b>Instrucciones:</b> ${escapeHtml(String(order.notes))}` : '';

    const message = [
      `🚨 <b>¡NUEVO PEDIDO SALVATORE #${order.id}!</b> 🚨`, '',
      `<b>Cliente:</b> ${escapeHtml(String(order.client_name))}`,
      `<b>Teléfono:</b> ${escapeHtml(String(order.client_phone))}`,
      `<b>Entrega:</b> ${delivery}`,
      `<b>Pago:</b> ${payment}${instructions}`, '',
      '<b>PRODUCTOS</b>', lines, '',
      `<b>TOTAL A PAGAR: ${formatCLP(Number(order.total))}</b>`
    ].join('\n');

    const payload: Record<string, unknown> = { chat_id: chatId, text: message, parse_mode: 'HTML' };
    if (phone) {
      payload.reply_markup = {
        inline_keyboard: [[{ text: '💬 Contactar al Cliente por WhatsApp', url: `https://wa.me/${phone}` }]]
      };
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(payload)
    });
    if (!telegramResponse.ok) console.error('Telegram notification failed', await telegramResponse.text());
  } catch (error) {
    console.error('Telegram notification failed', error);
  }
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
  const isAllowedOrigin = allowedOrigins.includes(origin);
  const corsHeaders = isAllowedOrigin
    ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    : {};

  if (request.method === 'OPTIONS') {
    return isAllowedOrigin ? new Response('ok', { headers: corsHeaders }) : response({ error: 'Origen no permitido.' }, 403, corsHeaders);
  }
  if (request.method !== 'POST' || !isAllowedOrigin) return response({ error: 'Solicitud no permitida.' }, 403, corsHeaders);

  try {
    const body = await request.json();
    const clientName = text(body.clientName, 100);
    const clientPhone = text(body.clientPhone, 30);
    const deliveryType = text(body.deliveryType, 20);
    const deliveryAddress = text(body.deliveryAddress, 250);
    const paymentMethod = text(body.paymentMethod, 20);
    const notes = text(body.notes);
    const incomingItems = Array.isArray(body.items) ? body.items as IncomingItem[] : [];

    if (!clientName || !/^\+?[\d\s()-]{8,30}$/.test(clientPhone)) throw new Error('Ingresa un nombre y teléfono válidos.');
    if (!['pickup', 'delivery'].includes(deliveryType)) throw new Error('Selecciona un tipo de entrega válido.');
    if (deliveryType === 'delivery' && !deliveryAddress) throw new Error('Ingresa la dirección de entrega.');
    if (!['cash', 'transfer'].includes(paymentMethod)) throw new Error('Selecciona un medio de pago válido.');
    if (!incomingItems.length || incomingItems.length > MAX_ITEMS_PER_ORDER) throw new Error('El pedido debe incluir entre 1 y 30 productos.');

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      { auth: { persistSession: false } }
    );
    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateSalt = Deno.env.get('RATE_LIMIT_SALT') || '';
    const { data: isAllowed, error: rateError } = await serviceClient.rpc('claim_order_rate_limit', {
      p_rate_key: await hash(`${rateSalt}:${forwardedFor}`)
    });
    if (rateError) throw rateError;
    if (!isAllowed) return response({ error: 'Has enviado demasiados intentos. Espera unos minutos e inténtalo nuevamente.' }, 429, corsHeaders);

    const normalizedItems = incomingItems.map(rawItem => {
      const product = CATALOG[rawItem.productId || ''];
      const quantity = Number(rawItem.quantity);
      const extras = Array.isArray(rawItem.extras) ? [...new Set(rawItem.extras)].filter(extra => product?.allowedExtras.includes(extra)) : [];
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Uno de los productos del pedido no es válido.');
      const unitPrice = product.price + extras.length * EXTRA_PRICE;
      return {
        product_name: product.name,
        quantity,
        unit_price: unitPrice,
        total_price: unitPrice * quantity,
        extras,
        notes: text(rawItem.notes, 250),
        world: product.world
      };
    });
    const worlds = new Set(normalizedItems.map(item => item.world));
    const { data: availability, error: availabilityError } = await serviceClient
      .from('store_availability')
      .select('pizza_status, waffle_status')
      .eq('id', 1)
      .single();
    if (availabilityError) throw availabilityError;
    if ((worlds.has('pizza') && availability.pizza_status === 'closed') || (worlds.has('waffle') && availability.waffle_status === 'closed')) {
      return response({ error: 'Por ahora no estamos recibiendo pedidos para uno de los productos seleccionados.' }, 409, corsHeaders);
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.total_price, 0);
    const deliveryCost = deliveryType === 'delivery' ? DELIVERY_COST : 0;
    const total = subtotal + deliveryCost;
    const world = worlds.size > 1 ? 'all' : normalizedItems[0].world;
    const orderData = {
      client_name: clientName, client_phone: clientPhone, delivery_type: deliveryType,
      delivery_address: deliveryAddress, payment_method: paymentMethod, notes,
      subtotal, delivery_cost: deliveryCost, total, world
    };
    const { data: orderId, error: orderError } = await serviceClient.rpc('create_secure_order', {
      p_client_name: clientName, p_client_phone: clientPhone, p_delivery_type: deliveryType,
      p_delivery_address: deliveryAddress, p_payment_method: paymentMethod, p_notes: notes,
      p_subtotal: subtotal, p_delivery_cost: deliveryCost, p_total: total, p_world: world,
      p_items: normalizedItems.map(({ world: _world, ...item }) => item)
    });
    if (orderError) throw orderError;

    const notification = notifyTelegram({ id: orderId, ...orderData }, normalizedItems);
    // No retrasa la confirmación del cliente; el runtime mantiene viva la tarea en segundo plano.
    EdgeRuntime.waitUntil(notification);

    return response({ orderId, subtotal, deliveryCost, total }, 201, corsHeaders);
  } catch (error) {
    console.error('create-order failed', error);
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'No fue posible registrar el pedido.';
    return response({ error: message }, 400, corsHeaders);
  }
});
