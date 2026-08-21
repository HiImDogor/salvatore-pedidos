/**
 * Salvatore Pizzas & Waffles — Production & Inventory Planner
 * Handles stock calculations, ingredient targets, purchasing recommendations, and Supabase sync.
 */

const $ = s => document.querySelector(s);
const client = window.salvatoreSupabase;

let items = [];
let showMissingOnly = false;

const UNITS = ['unidades', 'kg', 'g', 'litros', 'ml', 'paquetes'];

// Helper formatting functions
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const parseNumeric = value => Math.max(0, Number(value) || 0);

const formatNumber = value => new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 2
}).format(value);

const renderUnitOptions = currentUnit => {
  const options = UNITS.includes(currentUnit) ? UNITS : [currentUnit, ...UNITS];
  return `
    <select data-field="unit">
      ${options.map(unit => `
        <option value="${escapeHtml(unit)}" ${unit === currentUnit ? 'selected' : ''}>
          ${escapeHtml(unit)}
        </option>
      `).join('')}
    </select>
  `;
};

function calculateMissing(item) {
  return Math.max(0, parseNumeric(item.target) - parseNumeric(item.stock));
}

function showToast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2600);
}

function showLoginError(message) {
  const el = $('#loginError');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function getDatabaseErrorMessage(error, actionContext) {
  if (error.code === '23505') return 'Ese ingrediente ya existe en este mundo.';
  if (error.code === '42501') return 'Tu cuenta no tiene permiso para modificar la planificación.';
  if (error.code === '42P01') return 'Falta ejecutar la migración de planificación en Supabase.';
  if (error.code === '23514') return 'Revisa que los valores ingresados sean válidos.';
  return `${actionContext}: ${error.message || 'error desconocido'}`;
}

// Rendering
function renderWorldInventory(world) {
  const container = $(`#${world}List`);
  if (!container) return;

  const worldItems = items.filter(item => item.world === world);
  container.querySelector('.inventory-table, .empty-inventory')?.remove();

  if (!worldItems.length) {
    container.insertAdjacentHTML('beforeend', '<p class="empty-inventory">Aún no hay ingredientes en esta lista.</p>');
    return;
  }

  const tableHtml = `
    <table class="inventory-table">
      <thead>
        <tr>
          <th>Ingrediente</th>
          <th>Meta para producir</th>
          <th>En stock</th>
          <th>Unidad</th>
          <th>Comprar</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${worldItems.map(item => {
          const missing = calculateMissing(item);
          return `
            <tr data-id="${item.id}" class="${missing ? 'needs-stock' : 'is-ready'}">
              <td class="item-name">${escapeHtml(item.name)}</td>
              <td data-label="Meta para producir">
                <input data-field="target" type="number" min="0" step="0.01" value="${item.target}" />
              </td>
              <td data-label="En stock">
                <input data-field="stock" type="number" min="0" step="0.01" value="${item.stock}" />
              </td>
              <td data-label="Unidad">${renderUnitOptions(item.unit)}</td>
              <td data-label="Comprar" class="buy-amount ${missing ? '' : 'ok'}">
                ${missing ? `${formatNumber(missing)} ${escapeHtml(item.unit)}` : 'Listo'}
              </td>
              <td>
                <button class="remove-item" data-remove="${item.id}" type="button">Quitar</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  container.insertAdjacentHTML('beforeend', tableHtml);
}

function applyFilter() {
  document.querySelectorAll('tr.is-ready').forEach(row => {
    row.hidden = showMissingOnly;
  });
  document.querySelectorAll('.filter-button').forEach(button => {
    button.classList.toggle('active', button.dataset.filter === (showMissingOnly ? 'missing' : 'all'));
  });
}

function renderAll() {
  const pendingCount = items.filter(item => calculateMissing(item) > 0).length;
  renderWorldInventory('pizza');
  renderWorldInventory('waffle');

  const pendingCountEl = $('#pendingCount');
  const missingFilterCountEl = $('#missingFilterCount');
  if (pendingCountEl) pendingCountEl.textContent = pendingCount;
  if (missingFilterCountEl) missingFilterCountEl.textContent = pendingCount;

  applyFilter();
}

async function loadItemsFromDatabase() {
  if (!client) return;
  const { data, error } = await client
    .from('production_inventory_items')
    .select('id,world,name,unit,target,stock,position')
    .order('world')
    .order('position')
    .order('name');

  if (error) throw error;
  items = data || [];
  renderAll();
}

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

async function showPlannerPanel() {
  const isAdmin = await verifyAdminRole();
  if (!isAdmin) {
    await client.auth.signOut();
    showLoginError('Este usuario no tiene permisos de administración.');
    return;
  }

  $('#loginView')?.classList.add('hidden');
  $('#plannerView')?.classList.remove('hidden');

  try {
    await loadItemsFromDatabase();
  } catch (error) {
    showToast('Falta ejecutar la migración de planificación en Supabase.');
  }
}

// Event Listeners
$('#loginForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  button.disabled = true;
  button.textContent = 'Ingresando...';

  const data = new FormData(form);
  const { error } = await client.auth.signInWithPassword({
    email: data.get('email'),
    password: data.get('password')
  });

  button.disabled = false;
  button.textContent = 'Ingresar';

  if (error) return showLoginError('Correo o contraseña incorrectos.');
  await showPlannerPanel();
});

// Live stock input handler
document.addEventListener('input', event => {
  const input = event.target.closest('[data-field]');
  if (!input) return;

  const row = input.closest('tr');
  const item = items.find(val => String(val.id) === row.dataset.id);
  if (!item) return;

  item[input.dataset.field] = input.dataset.field === 'unit' ? input.value : parseNumeric(input.value);

  const missing = calculateMissing(item);
  const output = row.querySelector('.buy-amount');
  const pendingCount = items.filter(val => calculateMissing(val) > 0).length;

  row.className = missing ? 'needs-stock' : 'is-ready';
  if (output) {
    output.className = `buy-amount ${missing ? '' : 'ok'}`;
    output.textContent = missing ? `${formatNumber(missing)} ${item.unit}` : 'Listo';
  }

  const pendingCountEl = $('#pendingCount');
  const missingFilterCountEl = $('#missingFilterCount');
  if (pendingCountEl) pendingCountEl.textContent = pendingCount;
  if (missingFilterCountEl) missingFilterCountEl.textContent = pendingCount;

  applyFilter();
});

document.addEventListener('change', event => {
  const input = event.target.closest('select[data-field="unit"]');
  if (!input) return;

  const row = input.closest('tr');
  const item = items.find(val => String(val.id) === row.dataset.id);
  if (!item) return;

  item.unit = input.value;
  const missing = calculateMissing(item);
  const output = row.querySelector('.buy-amount');
  if (output) {
    output.className = `buy-amount ${missing ? '' : 'ok'}`;
    output.textContent = missing ? `${formatNumber(missing)} ${item.unit}` : 'Listo';
  }
});

document.addEventListener('click', event => {
  const filterBtn = event.target.closest('[data-filter]');
  if (!filterBtn) return;
  showMissingOnly = filterBtn.dataset.filter === 'missing';
  applyFilter();
});

// Batch Save
$('#saveInventory')?.addEventListener('click', async () => {
  const button = $('#saveInventory');
  button.disabled = true;
  button.textContent = 'Guardando...';

  const updates = items.map(item =>
    client.from('production_inventory_items').update({
      target: parseNumeric(item.target),
      stock: parseNumeric(item.stock),
      unit: (item.unit || '').trim() || 'unidades',
      updated_at: new Date().toISOString()
    }).eq('id', item.id)
  );

  const results = await Promise.all(updates);
  button.disabled = false;
  button.textContent = 'Guardar planificación';

  if (results.some(res => res.error)) {
    return showToast('No se pudieron guardar todos los cambios.');
  }

  await loadItemsFromDatabase();
  showToast('Planificación guardada con éxito.');
});

$('#saveInventoryBottom')?.addEventListener('click', () => $('#saveInventory')?.click());

// Add item
$('#addItemForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = (data.get('name') || '').trim();
  const button = form.querySelector('button');

  button.disabled = true;
  button.textContent = 'Agregando...';

  const { error } = await client.from('production_inventory_items').insert({
    world: data.get('world'),
    name,
    unit: data.get('unit'),
    target: parseNumeric(data.get('target')),
    stock: parseNumeric(data.get('stock')),
    position: items.filter(item => item.world === data.get('world')).length + 1
  });

  button.disabled = false;
  button.textContent = 'Agregar a la lista';

  if (error) return showToast(getDatabaseErrorMessage(error, 'No se pudo agregar el ingrediente'));

  form.reset();
  await loadItemsFromDatabase();
  showToast('Ingrediente agregado a la lista.');
});

// Remove item
document.addEventListener('click', async event => {
  const removeBtn = event.target.closest('[data-remove]');
  if (!removeBtn) return;

  const item = items.find(val => String(val.id) === removeBtn.dataset.remove);
  if (!item || !confirm(`¿Quitar ${item.name} de la lista de compras?`)) return;

  const { error } = await client
    .from('production_inventory_items')
    .delete()
    .eq('id', item.id);

  if (error) return showToast('No se pudo quitar el ingrediente.');

  items = items.filter(val => val.id !== item.id);
  renderAll();
  showToast('Ingrediente quitado.');
});

$('#logoutButton')?.addEventListener('click', async () => {
  await client.auth.signOut();
  $('#plannerView')?.classList.add('hidden');
  $('#loginView')?.classList.remove('hidden');
  $('#loginForm')?.reset();
});

// Check Session on load
if (!client) {
  showLoginError('Falta la configuración de Supabase.');
} else {
  client.auth.getSession().then(({ data: { session } }) => {
    if (session) showPlannerPanel();
  });
}
