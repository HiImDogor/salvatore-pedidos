/**
 * Salvatore Pizzas & Waffles — Admin & Live Orders Dashboard
 * Handles authentication, live kitchen queue, full order history, analytics, CSV export, and availability controls.
 */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const client = window.salvatoreSupabase;

const DEFAULT_AVAILABILITY = {
  status: 'available',
  wait: '25–35 min',
  note: ''
};

const MONEY = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0
});

const formatMoney = val => MONEY.format(val);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
}[char]));

let worlds = {
  pizza: { ...DEFAULT_AVAILABILITY },
  waffle: { ...DEFAULT_AVAILABILITY }
};

let orders = [];
let currentLiveFilter = 'active';

// ==========================================================================
// 1. HELPERS & UI TOAST
// ==========================================================================

function isFromCurrentShift(isoDateStr) {
  if (!isoDateStr) return false;
  const orderTime = new Date(isoDateStr).getTime();
  const now = Date.now();
  // Los pedidos de las últimas 18 horas pertenecen al turno operativo actual
  return (now - orderTime) < (18 * 60 * 60 * 1000);
}

function showToast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

function showLoginError(message) {
  const el = $('#loginError');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) + ' · ' +
         date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ==========================================================================
// 2. DATA FETCHING & REALTIME
// ==========================================================================

async function loadOrders() {
  if (!client) return;

  const ordersContainer = $('#ordersList');
  const historyContainer = $('#historyOrdersList');

  try {
    const { data: fetchedOrders, error } = await client
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error al cargar pedidos:', error);
      if (error.code === '42P01') {
        const errorHtml = `
          <div class="empty-state">
            <p><b>Aún no has creado la tabla de pedidos en Supabase.</b></p>
            <small>Ejecuta el script <code>supabase-migration-orders.sql</code> en el SQL Editor de Supabase para activar esta función.</small>
          </div>
        `;
        if (ordersContainer) ordersContainer.innerHTML = errorHtml;
        if (historyContainer) historyContainer.innerHTML = errorHtml;
        return;
      }
      throw error;
    }

    orders = fetchedOrders || [];
    renderLiveOrders();
    renderHistoryOrders();
    updateLiveOrderStats();
  } catch (err) {
    console.error('Error al obtener pedidos:', err);
    if (ordersContainer) ordersContainer.innerHTML = '<p class="empty-state">No se pudieron cargar las comandas.</p>';
    if (historyContainer) historyContainer.innerHTML = '<p class="empty-state">No se pudo cargar el historial.</p>';
  }
}

function initOrdersRealtime() {
  if (!client) return;

  try {
    client
      .channel('orders_dashboard_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          loadOrders();
        }
      )
      .subscribe();
  } catch (e) {
    console.warn('Realtime de pedidos no iniciado:', e);
  }
}

// ==========================================================================
// 3. TAB 1: LIVE ORDERS (COMANDAS EN VIVO)
// ==========================================================================

function updateLiveOrderStats() {
  const shiftOrders = orders.filter(o => isFromCurrentShift(o.created_at));

  const pending = shiftOrders.filter(o => o.status === 'pending').length;
  const preparing = shiftOrders.filter(o => o.status === 'preparing').length;
  const ready = shiftOrders.filter(o => o.status === 'ready').length;
  const activeTotal = pending + preparing + ready;

  const totalSalesToday = shiftOrders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const pendingBadge = $('#pendingOrdersBadge');
  const activeCountEl = $('#activeOrdersCount');
  const statPending = $('#statPendingCount');
  const statPreparing = $('#statPreparingCount');
  const statReady = $('#statReadyCount');
  const statSales = $('#statTotalSales');

  if (pendingBadge) pendingBadge.textContent = activeTotal;
  if (activeCountEl) activeCountEl.textContent = activeTotal;
  if (statPending) statPending.textContent = pending;
  if (statPreparing) statPreparing.textContent = preparing;
  if (statReady) statReady.textContent = ready;
  if (statSales) statSales.textContent = formatMoney(totalSalesToday);
}

function renderLiveOrders() {
  const container = $('#ordersList');
  if (!container) return;

  const shiftOrders = orders.filter(o => isFromCurrentShift(o.created_at));
  let list = shiftOrders;

  if (currentLiveFilter === 'active') {
    list = shiftOrders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status));
  } else if (currentLiveFilter === 'all_today') {
    list = shiftOrders;
  } else {
    list = shiftOrders.filter(o => o.status === currentLiveFilter);
  }

  if (!list.length) {
    const emptyMsg = currentLiveFilter === 'active'
      ? '¡Cocina al día! No hay comandas pendientes por preparar o entregar. 🍕✨'
      : `No hay pedidos con el filtro "${currentLiveFilter}" en este turno.`;
    container.innerHTML = `<p class="empty-state">${emptyMsg}</p>`;
    return;
  }

  container.innerHTML = list.map(renderOrderCardHtml).join('');
}

// ==========================================================================
// 4. TAB 2: ORDER HISTORY & ADVANCED SEARCH / SORT
// ==========================================================================

function getFilteredHistory() {
  const searchQuery = ($('#histSearchInput')?.value || '').toLowerCase().trim();
  const sortMode = $('#histSortSelect')?.value || 'id_desc';
  const dateRange = $('#histDateSelect')?.value || 'all';
  const statusFilter = $('#histStatusSelect')?.value || 'all';
  const worldFilter = $('#histWorldSelect')?.value || 'all';

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  let result = orders.filter(order => {
    // Search query
    if (searchQuery) {
      const matchId = String(order.id).includes(searchQuery);
      const matchName = (order.client_name || '').toLowerCase().includes(searchQuery);
      const matchPhone = (order.client_phone || '').toLowerCase().includes(searchQuery);
      const matchAddress = (order.delivery_address || '').toLowerCase().includes(searchQuery);
      if (!matchId && !matchName && !matchPhone && !matchAddress) return false;
    }

    // Date range
    if (dateRange === 'today') {
      if (!(order.created_at || '').startsWith(todayStr)) return false;
    } else if (dateRange === 'week') {
      if (new Date(order.created_at) < sevenDaysAgo) return false;
    } else if (dateRange === 'month') {
      if (new Date(order.created_at) < thirtyDaysAgo) return false;
    }

    // Status filter
    if (statusFilter === 'delivered' && order.status !== 'delivered') return false;
    if (statusFilter === 'active' && !['pending', 'preparing', 'ready'].includes(order.status)) return false;
    if (statusFilter === 'cancelled' && order.status !== 'cancelled') return false;

    // World filter
    if (worldFilter !== 'all' && order.world !== worldFilter) return false;

    return true;
  });

  // Sorting
  result.sort((a, b) => {
    if (sortMode === 'id_desc') return b.id - a.id;
    if (sortMode === 'id_asc') return a.id - b.id;
    if (sortMode === 'total_desc') return Number(b.total || 0) - Number(a.total || 0);
    if (sortMode === 'total_asc') return Number(a.total || 0) - Number(b.total || 0);
    return 0;
  });

  return result;
}

function renderHistoryOrders() {
  const container = $('#historyOrdersList');
  if (!container) return;

  const filtered = getFilteredHistory();

  // Update summary stats
  const totalCount = filtered.length;
  const totalAmount = filtered
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const avgTicket = totalCount > 0 ? totalAmount / totalCount : 0;

  const countEl = $('#histTotalCount');
  const amountEl = $('#histTotalAmount');
  const avgEl = $('#histAverageTicket');

  if (countEl) countEl.textContent = `${totalCount} pedidos`;
  if (amountEl) amountEl.textContent = formatMoney(totalAmount);
  if (avgEl) avgEl.textContent = formatMoney(avgTicket);

  if (!filtered.length) {
    container.innerHTML = '<p class="empty-state">No se encontraron pedidos con los filtros aplicados.</p>';
    return;
  }

  container.innerHTML = filtered.map(renderOrderCardHtml).join('');
}

function renderOrderCardHtml(order) {
  const statusLabels = {
    pending: '🟡 Pendiente',
    preparing: '🟠 En preparación',
    ready: '🟢 Listo / En camino',
    delivered: '✔️ Entregado',
    cancelled: '❌ Cancelado'
  };

  const deliveryLabels = {
    pickup: 'Retiro en local (Gratis)',
    delivery: 'Delivery a domicilio ($1.000)',
    urban: 'Delivery ($1.000)',
    lomas: 'Delivery ($1.000)'
  };

  const paymentLabels = {
    cash: '💵 Efectivo',
    transfer: '🏦 Transferencia'
  };

  const items = order.order_items || [];
  const phoneClean = (order.client_phone || '').replace(/\D/g, '');
  const clientName = escapeHtml(order.client_name);
  const clientPhone = escapeHtml(order.client_phone);
  const deliveryAddress = escapeHtml(order.delivery_address);
  const orderNotes = escapeHtml(order.notes);

  return `
    <article class="order-card status-${order.status}" data-order-id="${order.id}">
      <header class="order-header">
        <div class="order-meta">
          <h3>Pedido #${order.id} · ${clientName}</h3>
          <p>
            ${formatDate(order.created_at)} · 
            <a href="tel:${phoneClean}">📞 ${clientPhone}</a> ·
            <a href="https://wa.me/${phoneClean}" target="_blank" rel="noreferrer">💬 WhatsApp</a>
          </p>
        </div>
        <span class="order-status-badge ${order.status}">${statusLabels[order.status] || order.status}</span>
      </header>

      <div class="order-details-grid">
        <div>
          <b>Tipo de Entrega</b>
          <span>${deliveryLabels[order.delivery_type] || escapeHtml(order.delivery_type)}${deliveryAddress ? ` (${deliveryAddress})` : ''}</span>
        </div>
        <div>
          <b>Medio de Pago</b>
          <span>${paymentLabels[order.payment_method] || order.payment_method}</span>
        </div>
        ${order.notes ? `
          <div style="grid-column: 1 / -1;">
            <b>Notas del cliente</b>
            <span>${orderNotes}</span>
          </div>
        ` : ''}
      </div>

      <div class="order-items-box">
        <b>Detalle del Pedido (${items.length} ítems)</b>
        ${items.map(item => `
          <div class="order-item-row">
            <div>
              <strong>${item.quantity}x ${escapeHtml(item.product_name)}</strong>
              ${item.extras?.length ? `<small>+ ${escapeHtml(item.extras.join(', '))}</small>` : ''}
              ${item.notes ? `<small>Nota: ${escapeHtml(item.notes)}</small>` : ''}
            </div>
            <span>${formatMoney(item.total_price || item.unit_price * item.quantity)}</span>
          </div>
        `).join('')}
      </div>

      <footer class="order-footer">
        <div class="order-total-price">
          Total: ${formatMoney(order.total)}
        </div>
        <div class="order-actions">
          <select class="order-status-select" data-status-change="${order.id}">
            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>🟡 Pendiente</option>
            <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>🟠 En preparación</option>
            <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>🟢 Listo</option>
            <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>✔️ Entregado</option>
            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>❌ Cancelado</option>
          </select>
          <button class="delete-order-btn" data-cancel-order="${order.id}" type="button" title="Cancelar pedido">Cancelar</button>
        </div>
      </footer>
    </article>
  `;
}

async function updateOrderStatus(orderId, newStatus) {
  if (!client) return;

  const { error } = await client
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) {
    showToast('No se pudo actualizar el estado del pedido.');
    return;
  }

  const order = orders.find(o => String(o.id) === String(orderId));
  if (order) order.status = newStatus;

  renderLiveOrders();
  renderHistoryOrders();
  updateLiveOrderStats();
  const labels = {
    pending: '🟡 Pendiente',
    preparing: '🟠 En preparación',
    ready: '🟢 Listo para entrega',
    delivered: '✔️ Entregado (archivado de comandas activas)',
    cancelled: '❌ Cancelado'
  };

  showToast(`Pedido #${orderId} ➔ ${labels[newStatus] || newStatus}`);
}

async function deleteOrder(orderId) {
  if (!client) return;

  const order = orders.find(o => String(o.id) === String(orderId));
  const clientInfo = order ? ` (${order.client_name} · ${formatMoney(order.total)})` : '';

  if (!confirm(`¿Eliminar permanentemente el Pedido #${orderId}${clientInfo}?\n\nEsta acción no se puede deshacer.`)) {
    return;
  }

  const { error } = await client
    .from('orders')
    .delete()
    .eq('id', orderId);

  if (error) {
    console.error('Error al eliminar pedido:', error);
    showToast('No se pudo eliminar el pedido. Revisa permisos.');
    return;
  }

  orders = orders.filter(o => String(o.id) !== String(orderId));
  renderLiveOrders();
  renderHistoryOrders();
  updateLiveOrderStats();
  showToast(`Pedido #${orderId} eliminado del historial.`);
}

// ==========================================================================
// 5. EXPORT CSV (EXCEL)
// ==========================================================================

function exportOrdersToCsv() {
  const filtered = getFilteredHistory();
  if (!filtered.length) {
    showToast('No hay pedidos para exportar.');
    return;
  }

  const headers = [
    'N° Pedido',
    'Fecha y Hora',
    'Cliente',
    'Teléfono',
    'Tipo Entrega',
    'Dirección',
    'Medio Pago',
    'Notas',
    'Subtotal',
    'Delivery',
    'Total',
    'Estado',
    'Detalle Productos'
  ];

  const rows = filtered.map(order => {
    const itemsSummary = (order.order_items || [])
      .map(i => `${i.quantity}x ${i.product_name}${i.extras?.length ? ` (+${i.extras.join('/')})` : ''}`)
      .join(' | ');

    return [
      order.id,
      new Date(order.created_at).toLocaleString('es-CL'),
      `"${(order.client_name || '').replace(/"/g, '""')}"`,
      `"${order.client_phone || ''}"`,
      order.delivery_type,
      `"${(order.delivery_address || '').replace(/"/g, '""')}"`,
      order.payment_method,
      `"${(order.notes || '').replace(/"/g, '""')}"`,
      order.subtotal,
      order.delivery_cost,
      order.total,
      order.status,
      `"${itemsSummary.replace(/"/g, '""')}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `salvatore_pedidos_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Reporte CSV descargado con éxito.');
}

// ==========================================================================
// 6. AVAILABILITY SETTINGS
// ==========================================================================

function getSelectedWorld() {
  return $('#availabilityForm')?.world.value || 'pizza';
}

function getActiveAvailability() {
  const current = getSelectedWorld();
  return worlds[current === 'waffle' ? 'waffle' : 'pizza'] || DEFAULT_AVAILABILITY;
}

function renderPreview() {
  const availability = getActiveAvailability();
  const labels = {
    available: 'Pedidos disponibles',
    busy: 'Alta demanda',
    closed: 'Cupos agotados'
  };

  const banner = $('#previewBanner');
  if (banner) banner.className = `preview-banner ${availability.status}`;

  const icon = $('#previewIcon');
  if (icon) icon.textContent = availability.status === 'available' ? '●' : availability.status === 'busy' ? '◐' : '×';

  const title = $('#previewTitle');
  if (title) title.textContent = labels[availability.status] || 'Pedidos disponibles';

  const detail = $('#previewDetail');
  if (detail) {
    detail.textContent = availability.status === 'closed'
      ? (availability.note || 'No estamos recibiendo pedidos por ahora')
      : `Tiempo estimado: ${availability.wait}${availability.note ? ` · ${availability.note}` : ''}`;
  }
}

function populateAvailabilityForm() {
  const form = $('#availabilityForm');
  if (!form) return;
  const availability = getActiveAvailability();
  form.availability.value = availability.status;
  form.wait.value = availability.wait;
  form.availabilityNote.value = availability.note;
}

function parseWorldRecord(data, world) {
  return {
    status: data[`${world}_status`] || data.status || DEFAULT_AVAILABILITY.status,
    wait: data[`${world}_wait`] || data.wait || DEFAULT_AVAILABILITY.wait,
    note: data[`${world}_note`] ?? data.note ?? DEFAULT_AVAILABILITY.note
  };
}

async function loadAvailability() {
  if (!client) return;
  const { data, error } = await client
    .from('store_availability')
    .select('pizza_status,pizza_wait,pizza_note,waffle_status,waffle_wait,waffle_note')
    .eq('id', 1)
    .single();

  if (error) throw error;
  worlds = {
    pizza: parseWorldRecord(data, 'pizza'),
    waffle: parseWorldRecord(data, 'waffle')
  };
  populateAvailabilityForm();
  renderPreview();
}

// ==========================================================================
// 7. AUTH & PANEL LIFECYCLE
// ==========================================================================

async function verifyAdminRole() {
  if (!client) return false;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;

  const { data, error } = await client
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return !error && !!data;
}

async function showAdminPanel() {
  const isAdmin = await verifyAdminRole();
  if (!isAdmin) {
    await client.auth.signOut();
    showLoginError('Este usuario no tiene permisos de administración.');
    return;
  }

  $('#loginView')?.classList.add('hidden');
  $('#adminView')?.classList.remove('hidden');

  try {
    await loadOrders();
    initOrdersRealtime();
    await loadAvailability();
  } catch (error) {
    showToast('Falta ejecutar las migraciones en Supabase.');
  }
}

// ==========================================================================
// 8. EVENT LISTENERS
// ==========================================================================

// Tabs switching
$$('.tab-button').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab-button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const tab = btn.dataset.tab;
    $('#tabOrders')?.classList.toggle('hidden', tab !== 'orders');
    $('#tabHistory')?.classList.toggle('hidden', tab !== 'history');
    $('#tabAvailability')?.classList.toggle('hidden', tab !== 'availability');

    if (tab === 'history') {
      renderHistoryOrders();
    }
  });
});

// Live filter chips
$$('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    $$('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentLiveFilter = chip.dataset.orderFilter;
    renderLiveOrders();
  });
});

// History search & filters triggers
$('#histSearchInput')?.addEventListener('input', () => renderHistoryOrders());
$('#histSortSelect')?.addEventListener('change', () => renderHistoryOrders());
$('#histDateSelect')?.addEventListener('change', () => renderHistoryOrders());
$('#histStatusSelect')?.addEventListener('change', () => renderHistoryOrders());
$('#histWorldSelect')?.addEventListener('change', () => renderHistoryOrders());
$('#exportCsvBtn')?.addEventListener('click', () => exportOrdersToCsv());

// Refresh button
$('#refreshOrdersBtn')?.addEventListener('click', () => {
  loadOrders();
  showToast('Comandas actualizadas.');
});

// Status dropdown change in orders
document.addEventListener('change', event => {
  const select = event.target.closest('[data-status-change]');
  if (select) {
    const orderId = select.dataset.statusChange;
    updateOrderStatus(orderId, select.value);
  }
});

// Cancel order click (the history is retained for auditing and support)
document.addEventListener('click', event => {
  const cancelBtn = event.target.closest('[data-cancel-order]');
  if (cancelBtn) {
    const orderId = cancelBtn.dataset.cancelOrder;
    if (confirm(`¿Cancelar el Pedido #${orderId}? Se conservará en el historial.`)) {
      updateOrderStatus(orderId, 'cancelled');
    }
  }
});

// Login form
$('#loginForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  button.disabled = true;
  button.textContent = 'Ingresando...';
  $('#loginError')?.classList.add('hidden');

  const data = new FormData(form);
  const { error } = await client.auth.signInWithPassword({
    email: data.get('email'),
    password: data.get('password')
  });

  button.disabled = false;
  button.textContent = 'Ingresar';

  if (error) {
    return showLoginError('Correo o contraseña incorrectos.');
  }

  await showAdminPanel();
});

// Availability form
$('#availabilityForm')?.world.addEventListener('change', () => {
  populateAvailabilityForm();
  renderPreview();
});

$('#availabilityForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  const data = new FormData(form);
  const target = data.get('world');

  const nextState = {
    status: data.get('availability'),
    wait: data.get('wait'),
    note: data.get('availabilityNote').trim()
  };

  const updatePayload = {
    updated_at: new Date().toISOString()
  };

  const targetWorlds = target === 'both' ? ['pizza', 'waffle'] : [target];
  for (const world of targetWorlds) {
    worlds[world] = nextState;
    updatePayload[`${world}_status`] = nextState.status;
    updatePayload[`${world}_wait`] = nextState.wait;
    updatePayload[`${world}_note`] = nextState.note;
  }

  button.disabled = true;
  button.textContent = 'Guardando...';

  const { error } = await client
    .from('store_availability')
    .update(updatePayload)
    .eq('id', 1);

  button.disabled = false;
  button.textContent = 'Guardar cambios';

  if (error) {
    return showToast('No fue posible guardar el cambio.');
  }

  renderPreview();
  showToast(target === 'both' ? 'Estado actualizado para Pizzas y Waffles.' : `Estado actualizado para ${target === 'pizza' ? 'Pizzas' : 'Waffles'}.`);
});

// Logout
$('#logoutButton')?.addEventListener('click', async () => {
  await client.auth.signOut();
  $('#adminView')?.classList.add('hidden');
  $('#loginView')?.classList.remove('hidden');
  $('#loginForm')?.reset();
});

// Init Session
if (!client) {
  showLoginError('Falta la configuración de Supabase.');
} else {
  client.auth.getSession().then(({ data: { session } }) => {
    if (session) showAdminPanel();
  });
}
