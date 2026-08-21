/**
 * Salvatore Pizzas & Waffles — Client Application
 * Handles menu rendering, cart management, customization modals, world switching,
 * real-time availability sync, and WhatsApp checkout generation.
 */

// ==========================================================================
// 1. CONSTANTS & PRODUCT CATALOG
// ==========================================================================

const MONEY_FORMATTER = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0
});

const money = value => MONEY_FORMATTER.format(value);

const PRODUCTS = [
  // Pizzas
  {
    id: 'margarita',
    name: 'Margarita',
    price: 6500,
    description: 'Pomodoro, mozzarella, albahaca fresca y aceite de oliva.',
    icon: '🍕',
    type: 'pizza',
    image: 'assets/pizza_margarita.jpg',
    badge: 'Favorita'
  },
  {
    id: 'jamon',
    name: 'Jamón & Champiñón',
    price: 7000,
    description: 'Pomodoro, mozzarella, jamón pierna y champiñones laminados.',
    icon: '🍕',
    type: 'pizza',
    image: '',
    badge: 'Clásica'
  },
  {
    id: 'napolitana',
    name: 'Napolitana',
    price: 7500,
    description: 'Pomodoro, mozzarella, jamón, tomate fresco, aceitunas negras y orégano.',
    icon: '🍕',
    type: 'pizza',
    image: '',
    badge: 'Tradicional'
  },
  {
    id: 'pepperoni',
    name: 'Pepperoni',
    price: 7500,
    description: 'Pomodoro, mozzarella y pepperoni americano crujiente.',
    icon: '🍕',
    type: 'pizza',
    image: '',
    badge: 'Muy pedida'
  },
  {
    id: 'capricciosa',
    name: 'Capricciosa',
    price: 8000,
    description: 'Pomodoro, mozzarella, jamón pierna, champiñón, aceitunas y alcachofa.',
    icon: '🍕',
    type: 'pizza',
    image: '',
    badge: 'Especial'
  },
  {
    id: 'longaniza',
    name: 'Longaniza',
    price: 7500,
    description: 'Pomodoro, mozzarella, longaniza artesanal y cebolla caramelizada.',
    icon: '🍕',
    type: 'pizza',
    image: '',
    badge: 'De la casa'
  },
  {
    id: 'pesto',
    name: 'Pesto',
    price: 7500,
    description: 'Pomodoro, mozzarella, salsa pesto de albahaca, champiñón y oliva.',
    icon: '🍕',
    type: 'pizza',
    image: '',
    badge: 'Fresca'
  },
  {
    id: 'bbq',
    name: 'BBQ',
    price: 7500,
    description: 'Salsa BBQ ahumada, mozzarella, tocino crocante y cebolla.',
    icon: '🍕',
    type: 'pizza',
    image: '',
    badge: 'Intensa'
  },

  // Waffles
  {
    id: 'waffle',
    name: 'Waffle relleno de manjar',
    price: 1000,
    description: 'Pancito waffle horneado al momento, relleno de manjar artesanal y salsa de chocolate semiamargo.',
    icon: '🧇',
    type: 'waffle',
    image: '',
    badge: 'Recién horneado'
  },

  // Bebidas
  { id: 'pepsi', name: 'Pepsi', price: 1000, description: 'Lata 350 ml bien helada', icon: '🥤', type: 'drink', image: '', badge: '350 ml' },
  { id: 'bilz', name: 'Bilz', price: 1000, description: 'Lata 350 ml bien helada', icon: '🥤', type: 'drink', image: '', badge: '350 ml' },
  { id: 'pap', name: 'Pap', price: 1000, description: 'Lata 350 ml bien helada', icon: '🥤', type: 'drink', image: '', badge: '350 ml' },
  { id: 'kem', name: 'Kem Xtreme', price: 1000, description: 'Lata 350 ml bien helada', icon: '🥤', type: 'drink', image: '', badge: '350 ml' },
  { id: 'seven', name: '7Up', price: 1000, description: 'Lata 350 ml bien helada', icon: '🥤', type: 'drink', image: '', badge: '350 ml' },
  { id: 'zero', name: 'Pepsi Zero', price: 1000, description: 'Lata 350 ml sin azúcar', icon: '🥤', type: 'drink', image: '', badge: 'Sin azúcar' }
];

const PIZZA_EXTRAS = [
  'Extra Mozzarella',
  'Extra Pepperoni',
  'Champiñones',
  'Tocino',
  'Aceitunas Negras',
  'Cebolla',
  'Tomate fresco',
  'Albahaca'
];

const WAFFLE_EXTRAS = [
  'Extra salsa de chocolate',
  'Chispas de chocolate',
  'Extra manjar'
];

// ==========================================================================
// 2. STATE MANAGEMENT
// ==========================================================================

const DEFAULT_AVAILABILITY = {
  status: 'available',
  wait: '25–35 min',
  note: ''
};

let state = {
  cart: loadStoredCart(),
  selectedProduct: null,
  quantity: 1,
  activeWorld: 'pizza',
  availabilityByWorld: loadStoredAvailability()
};

function loadStoredCart() {
  try {
    const raw = localStorage.getItem('salvatore-cart');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error al leer carrito:', e);
    return [];
  }
}

function loadStoredAvailability() {
  try {
    const raw = localStorage.getItem('salvatore-availability-worlds');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error al leer disponibilidad local:', e);
  }
  return {
    pizza: { ...DEFAULT_AVAILABILITY },
    waffle: { ...DEFAULT_AVAILABILITY }
  };
}

function persistCart() {
  try {
    localStorage.setItem('salvatore-cart', JSON.stringify(state.cart));
  } catch (e) {
    console.error('Error al guardar carrito:', e);
  }
  renderCart();
}

function persistAvailability() {
  try {
    localStorage.setItem('salvatore-availability-worlds', JSON.stringify(state.availabilityByWorld));
  } catch (e) {
    console.error('Error al guardar disponibilidad:', e);
  }
}

// ==========================================================================
// 3. DOM HELPERS & SELECTORS
// ==========================================================================

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const getProductById = id => PRODUCTS.find(p => p.id === id);

// ==========================================================================
// 4. MENU RENDERING & CARD COMPONENTS
// ==========================================================================

function renderProductVisual(product, variant = '') {
  if (product.image) {
    return `
      <div class="card-visual with-photo ${variant}">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
        <span class="card-badge">${product.badge || 'Artesanal'}</span>
      </div>
    `;
  }
  return `
    <div class="card-visual ${variant}">
      <span>${product.icon}</span>
      <span class="card-badge">${product.badge || (product.type === 'pizza' ? 'Artesanal' : product.type === 'waffle' ? 'Dulce' : 'Helada')}</span>
    </div>
  `;
}

function renderProductCard(product) {
  return `
    <article class="card ${product.type}-card" data-product-id="${product.id}">
      ${renderProductVisual(product)}
      <div class="card-body">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="card-footer">
          <span class="price">${money(product.price)}</span>
          <button class="add-button" type="button" data-add="${product.id}" aria-label="Personalizar y agregar ${product.name}">
            Agregar
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderMenuGrids() {
  // Pizzas
  const pizzaGrid = $('#pizzaGrid');
  if (pizzaGrid) {
    pizzaGrid.innerHTML = PRODUCTS.filter(p => p.type === 'pizza').map(renderProductCard).join('');
  }

  // Waffles
  const waffleGrid = $('#waffleGrid');
  const waffleProduct = PRODUCTS.find(p => p.id === 'waffle');
  if (waffleGrid && waffleProduct) {
    waffleGrid.innerHTML = `
      ${renderProductCard(waffleProduct)}
      <article class="card upcoming">
        <div class="card-visual">✨</div>
        <div class="card-body">
          <h3>Próximamente</h3>
          <p>Más sabores dulces para acompañar tus tardes.</p>
        </div>
      </article>
    `;
  }

  // Drinks
  const drinkGrid = $('#drinkGrid');
  if (drinkGrid) {
    drinkGrid.innerHTML = PRODUCTS.filter(p => p.type === 'drink').map(renderProductCard).join('');
  }
}

// ==========================================================================
// 5. PRODUCT MODAL & CUSTOMIZATION
// ==========================================================================

function openProductModal(productId) {
  state.selectedProduct = getProductById(productId);
  if (!state.selectedProduct) return;

  state.quantity = 1;
  const product = state.selectedProduct;
  const extras = product.type === 'pizza' ? PIZZA_EXTRAS : product.type === 'waffle' ? WAFFLE_EXTRAS : [];
  
  const notePlaceholder = product.type === 'waffle'
    ? 'Ej. sin salsa de chocolate, con extra manjar...'
    : 'Ej. bien dorada, sin orégano...';

  const noteField = product.type === 'drink'
    ? ''
    : `<label class="modal-note">Instrucciones especiales
         <textarea id="productNote" placeholder="${notePlaceholder}"></textarea>
       </label>`;

  const modalHeader = product.image
    ? `<div class="modal-product-header with-photo">
         <button class="close product-close" data-close="productModal" aria-label="Cerrar producto" type="button">×</button>
         <img src="${product.image}" alt="${product.name}" />
       </div>`
    : `<div class="modal-product-header">
         <button class="close product-close" data-close="productModal" aria-label="Cerrar producto" type="button">×</button>
         <span>${product.icon}</span>
       </div>`;

  $('#modalContent').innerHTML = `
    ${modalHeader}
    <div class="product-modal-content">
      <h2 id="modalTitle">${product.name}</h2>
      <p class="price">${money(product.price)}</p>
      <p class="description">${product.description}</p>
      
      ${extras.length ? `
        <fieldset>
          <legend>Hazlo a tu gusto <small>(+$500 c/u)</small></legend>
          <div class="extras">
            ${extras.map(extra => `
              <label>
                <input type="checkbox" value="${extra}" />
                ${extra}
              </label>
            `).join('')}
          </div>
        </fieldset>
      ` : ''}

      ${noteField}

      <div class="quantity-row">
        <b>Cantidad</b>
        <div class="quantity">
          <button id="decrease" type="button" aria-label="Disminuir">−</button>
          <output id="quantity">1</output>
          <button id="increase" type="button" aria-label="Aumentar">+</button>
        </div>
      </div>

      <button id="confirmAdd" class="primary-button full" type="button">
        Agregar · <span id="modalTotal">${money(product.price)}</span>
      </button>
    </div>
  `;

  $('#productModal').classList.remove('hidden');
}

function updateModalTotal() {
  if (!state.selectedProduct) return;
  const checkedExtras = $$('#modalContent input[type=checkbox]:checked').length;
  const unitPrice = state.selectedProduct.price + (checkedExtras * 500);
  const total = unitPrice * state.quantity;

  const qtyOutput = $('#quantity');
  const modalTotal = $('#modalTotal');
  if (qtyOutput) qtyOutput.textContent = state.quantity;
  if (modalTotal) modalTotal.textContent = money(total);
}

function addProductToCart() {
  if (!state.selectedProduct) return;
  
  const extras = $$('#modalContent input[type=checkbox]:checked').map(cb => cb.value).sort();
  const note = $('#productNote')?.value.trim() || '';
  const unitPrice = state.selectedProduct.price + (extras.length * 500);

  // Buscar si ya existe el mismo ítem con idénticos extras y notas
  const existingItem = state.cart.find(item => {
    const sameName = item.name === state.selectedProduct.name;
    const sameNote = (item.note || '') === note;
    const sameExtras = JSON.stringify([...(item.extras || [])].sort()) === JSON.stringify(extras);
    return sameName && sameNote && sameExtras;
  });

  if (existingItem) {
    existingItem.qty += state.quantity;
  } else {
    state.cart.push({
      name: state.selectedProduct.name,
      icon: state.selectedProduct.icon,
      unit: unitPrice,
      extras,
      note,
      qty: state.quantity
    });
  }

  persistCart();
  closeModal('productModal');
  openCart();
  showToast('¡Agregado a tu pedido! 🍕');
}

// ==========================================================================
// 6. CART DRAWER & CALCULATIONS
// ==========================================================================

function getCartTotal() {
  return state.cart.reduce((sum, item) => sum + (item.unit * item.qty), 0);
}

function getDeliveryCost() {
  const selectedDelivery = document.querySelector('input[name=delivery]:checked')?.value || 'pickup';
  const costs = { pickup: 0, delivery: 1000, urban: 1000, lomas: 1000 };
  return costs[selectedDelivery] ?? (selectedDelivery === 'pickup' ? 0 : 1000);
}

function updateCheckoutTotal() {
  const totalEl = $('#checkoutTotal');
  if (totalEl) {
    totalEl.textContent = money(getCartTotal() + getDeliveryCost());
  }
}

function renderCart() {
  const itemsWrap = $('#cartItems');
  const emptyWrap = $('#cartEmpty');
  const countEl = $('#cartCount');
  const subtotalEl = $('#cartSubtotal');

  const totalQty = state.cart.reduce((sum, item) => sum + item.qty, 0);
  if (countEl) countEl.textContent = totalQty;
  if (subtotalEl) subtotalEl.textContent = money(getCartTotal());

  if (emptyWrap) emptyWrap.classList.toggle('hidden', state.cart.length > 0);

  if (itemsWrap) {
    itemsWrap.innerHTML = state.cart.map((item, index) => `
      <div class="cart-item">
        <span class="cart-item-icon">${item.icon}</span>
        <div class="cart-item-info">
          <b>${item.name}</b>
          <small>${item.extras.length ? item.extras.join(', ') : ''}${item.note ? ` · ${item.note}` : ''}</small>
          <strong>${money(item.unit * item.qty)}</strong>
        </div>
        <div class="cart-item-actions">
          <button type="button" data-minus="${index}" aria-label="Restar una unidad">−</button>
          <span>${item.qty}</span>
          <button type="button" data-plus="${index}" aria-label="Sumar una unidad">+</button>
          <button type="button" data-remove="${index}" aria-label="Eliminar del carrito">×</button>
        </div>
      </div>
    `).join('');
  }
}

function openCart() {
  $('#cartDrawer')?.classList.add('open');
  $('#drawerShade')?.classList.add('open');
  $('#cartDrawer')?.setAttribute('aria-hidden', 'false');
}

function closeCart() {
  $('#cartDrawer')?.classList.remove('open');
  $('#drawerShade')?.classList.remove('open');
  $('#cartDrawer')?.setAttribute('aria-hidden', 'true');
}

function closeModal(modalId) {
  const modal = $('#' + modalId);
  if (modal) modal.classList.add('hidden');
}

function closeAllModals() {
  $$('.overlay').forEach(modal => modal.classList.add('hidden'));
  closeCart();
}

// ==========================================================================
// 7. AVAILABILITY & REALTIME SUPABASE SYNC
// ==========================================================================

function getActiveAvailability() {
  return state.availabilityByWorld[state.activeWorld] || state.availabilityByWorld.pizza || DEFAULT_AVAILABILITY;
}

function renderAvailability() {
  const availability = getActiveAvailability();
  const banner = $('#availabilityBanner');
  const icon = $('#availabilityIcon');
  const title = $('#availabilityTitle');
  const detail = $('#availabilityDetail');

  const labels = {
    available: 'Pedidos disponibles',
    busy: 'Alta demanda',
    closed: 'Cupos agotados'
  };

  if (banner) banner.className = `availability-banner ${availability.status}`;
  if (icon) icon.textContent = availability.status === 'available' ? '●' : availability.status === 'busy' ? '◐' : '×';
  if (title) title.textContent = labels[availability.status] || 'Pedidos disponibles';
  
  if (detail) {
    if (availability.status === 'closed') {
      detail.textContent = availability.note || 'No estamos recibiendo pedidos por ahora';
    } else {
      detail.textContent = `Tiempo estimado: ${availability.wait}${availability.note ? ` · ${availability.note}` : ''}`;
    }
  }
}

async function loadRemoteAvailability() {
  if (!window.salvatoreSupabase) return;

  try {
    const { data, error } = await window.salvatoreSupabase
      .from('store_availability')
      .select('pizza_status,pizza_wait,pizza_note,waffle_status,waffle_wait,waffle_note')
      .eq('id', 1)
      .single();

    if (!error && data) {
      state.availabilityByWorld = {
        pizza: {
          status: data.pizza_status || 'available',
          wait: data.pizza_wait || '25–35 min',
          note: data.pizza_note || ''
        },
        waffle: {
          status: data.waffle_status || 'available',
          wait: data.waffle_wait || '25–35 min',
          note: data.waffle_note || ''
        }
      };
      persistAvailability();
      renderAvailability();
    }
  } catch (e) {
    console.warn('No fue posible sincronizar disponibilidad remota:', e);
  }
}

function initRealtimeAvailability() {
  if (!window.salvatoreSupabase) return;

  try {
    window.salvatoreSupabase
      .channel('store_availability_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'store_availability', filter: 'id=eq.1' },
        payload => {
          if (payload.new) {
            const data = payload.new;
            state.availabilityByWorld = {
              pizza: {
                status: data.pizza_status || data.status || 'available',
                wait: data.pizza_wait || data.wait || '25–35 min',
                note: data.pizza_note || data.note || ''
              },
              waffle: {
                status: data.waffle_status || 'available',
                wait: data.waffle_wait || '25–35 min',
                note: data.waffle_note || ''
              }
            };
            persistAvailability();
            renderAvailability();
          }
        }
      )
      .subscribe();
  } catch (e) {
    console.warn('Realtime subscription not supported or failed to initialize:', e);
  }
}

// ==========================================================================
// 8. WORLD SWITCHING & PORTAL
// ==========================================================================

function setWorld(world) {
  const isPizza = world === 'pizza';
  const isAll = world === 'all';
  const isWaffle = world === 'waffle';

  state.activeWorld = isWaffle ? 'waffle' : 'pizza';

  document.body.classList.remove('pizza-world', 'waffle-world', 'all-world');
  document.body.classList.add(`${world}-world`);

  // Header updates
  const logo = $('#headerLogo');
  if (logo) {
    logo.src = isWaffle ? 'assets/salvatore-waffle-logo.jpg' : 'assets/salvatore-pizza-logo.png';
    logo.alt = isWaffle ? 'Logo Salvatore Waffle' : 'Logo Salvatore Pizza';
  }

  const brand = $('#headerBrand');
  if (brand) brand.textContent = isAll ? 'Salvatore' : isPizza ? 'Salvatore Pizza' : 'Salvatore Waffle';

  const subtitle = $('#headerSubtitle');
  if (subtitle) subtitle.textContent = isAll ? 'Pizzas & Waffles' : isPizza ? 'Artesanales & Calidad' : 'Calientitos & Suaves';

  // Hero updates
  const eyebrow = $('#heroEyebrow');
  if (eyebrow) {
    eyebrow.textContent = isAll
      ? 'Pizzas artesanales · Waffles · Mulchén'
      : isPizza
      ? 'Pizzas artesanales · Mulchén'
      : 'Waffles horneados al momento · Mulchén';
  }

  const heroTitle = $('#heroTitle');
  if (heroTitle) {
    heroTitle.innerHTML = isAll
      ? 'Todo lo bueno<br /><em>en un solo pedido.</em>'
      : isPizza
      ? 'El sabor que<br /><em>te hace volver.</em>'
      : 'Un momento dulce<br /><em>para sonreír.</em>';
  }

  const heroDesc = $('#heroDescription');
  if (heroDesc) {
    heroDesc.textContent = isAll
      ? 'Revisa nuestras pizzas y waffles disponibles para combinar a tu gusto.'
      : isPizza
      ? 'Masa hecha a mano, ingredientes frescos y mucho sabor en cada porción.'
      : 'Waffles suaves, recién horneados, rellenos de manjar y bañados en chocolate.';
  }

  const heroFood = $('#heroFood');
  if (heroFood) heroFood.textContent = isWaffle ? '🧇' : '🍕';

  const heroPrice = $('#heroPrice');
  if (heroPrice) {
    heroPrice.innerHTML = isWaffle ? 'desde<br /><b>$1.000</b>' : 'desde<br /><b>$6.500</b>';
  }

  renderAvailability();
}

function startPortal(section) {
  const world = section === 'waffles' ? 'waffle' : section === 'all' ? 'all' : 'pizza';
  setWorld(world);
  $('#welcome')?.classList.add('out');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// 9. TOAST & NOTIFICATIONS
// ==========================================================================

function showToast(message) {
  const toastEl = $('#toast');
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// ==========================================================================
// 10. EVENT LISTENERS & DELEGATION
// ==========================================================================

document.addEventListener('click', event => {
  const target = event.target;

  // Add product button
  const addBtn = target.closest('[data-add]');
  if (addBtn) {
    openProductModal(addBtn.dataset.add);
    return;
  }

  // Close modals
  const closeBtn = target.closest('[data-close]');
  if (closeBtn) {
    closeModal(closeBtn.dataset.close);
    return;
  }

  // Quantity controls in modal
  if (target.id === 'increase') {
    state.quantity++;
    updateModalTotal();
    return;
  }

  if (target.id === 'decrease' && state.quantity > 1) {
    state.quantity--;
    updateModalTotal();
    return;
  }

  // Confirm add in modal
  if (target.id === 'confirmAdd') {
    addProductToCart();
    return;
  }

  // Cart item increment/decrement/removal
  if (target.matches('[data-plus]')) {
    const idx = parseInt(target.dataset.plus, 10);
    if (state.cart[idx]) {
      state.cart[idx].qty++;
      persistCart();
    }
    return;
  }

  if (target.matches('[data-minus]')) {
    const idx = parseInt(target.dataset.minus, 10);
    if (state.cart[idx]) {
      if (state.cart[idx].qty > 1) {
        state.cart[idx].qty--;
      }
      persistCart();
    }
    return;
  }

  if (target.matches('[data-remove]')) {
    const idx = parseInt(target.dataset.remove, 10);
    if (state.cart[idx]) {
      state.cart.splice(idx, 1);
      persistCart();
    }
    return;
  }

  // Cart drawer open/close
  if (target.closest('#cartButton')) {
    openCart();
    return;
  }

  if (target.closest('#closeCart') || target.id === 'drawerShade') {
    closeCart();
    return;
  }

  // Checkout modal trigger
  if (target.closest('#checkoutButton')) {
    if (!state.cart.length) {
      showToast('Agrega algo rico antes de continuar.');
      return;
    }
    const currentAvailability = getActiveAvailability();
    if (currentAvailability.status === 'closed') {
      showToast('Por ahora los cupos están agotados.');
      return;
    }
    closeCart();
    $('#checkoutModal')?.classList.remove('hidden');
    updateCheckoutTotal();
    return;
  }

  // Copy bank info
  if (target.closest('#copyBank')) {
    navigator.clipboard.writeText(
      'Banco Estado\nCuenta RUT: 20322788\nRUT: 20.322.788-4\nCarlos Borquez Vidal\ncarlosmbv2000@gmail.com'
    );
    showToast('Datos bancarios copiados al portapapeles.');
    return;
  }

  // Welcome portal buttons
  const portalBtn = target.closest('.portal');
  if (portalBtn) {
    startPortal(portalBtn.dataset.start);
    return;
  }

  // Change world button
  if (target.closest('#changeWorld')) {
    $('#welcome')?.classList.remove('out');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
});

// Modal checkbox changes
document.addEventListener('change', event => {
  if (event.target.closest('#modalContent')) {
    updateModalTotal();
  }

  if (event.target.name === 'delivery') {
    const delivery = event.target.value;
    const addressWrap = $('#addressWrap');
    if (addressWrap) {
      addressWrap.classList.toggle('hidden', delivery === 'pickup');
      const input = addressWrap.querySelector('input');
      if (input) input.required = delivery !== 'pickup';
    }
    updateCheckoutTotal();
  }

  if (event.target.name === 'payment') {
    const bankInfo = $('#bankInfo');
    if (bankInfo) {
      bankInfo.classList.toggle('hidden', event.target.value !== 'transfer');
    }
  }
});

// Keyboard accessibility: Escape key closes active overlay
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeAllModals();
  }
});

// Checkout Form Submission (Supabase Order Save + WhatsApp generation)
$('#checkoutForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector('button[type=submit]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando pedido...';
  }

  const data = new FormData(form);
  const paymentMethod = data.get('payment') === 'cash' ? 'Efectivo' : 'Transferencia bancaria';
  
  const deliveryNames = {
    pickup: 'Retiro en local (Campillo 920)',
    delivery: 'Delivery a domicilio ($1.000)',
    urban: 'Delivery a domicilio ($1.000)',
    lomas: 'Delivery a domicilio ($1.000)'
  };
  const deliveryType = data.get('delivery') || 'pickup';
  const deliveryText = deliveryNames[deliveryType] || 'Retiro en local';

  const clientName = (data.get('name') || '').trim();
  const clientPhone = (data.get('phone') || '').trim();
  const deliveryAddress = (data.get('address') || '').trim();
  const orderNotes = (data.get('notes') || '').trim();
  const subtotal = getCartTotal();
  const deliveryCost = getDeliveryCost();
  const grandTotal = subtotal + deliveryCost;

  let orderId = null;

  // 1. Intentar registrar el pedido en Supabase
  if (window.salvatoreSupabase) {
    try {
      const orderPayload = {
        client_name: clientName,
        client_phone: clientPhone,
        delivery_type: deliveryType,
        delivery_address: deliveryAddress,
        payment_method: data.get('payment') || 'cash',
        notes: orderNotes,
        subtotal: subtotal,
        delivery_cost: deliveryCost,
        total: grandTotal,
        world: state.activeWorld || 'pizza',
        status: 'pending'
      };

      const { data: createdOrder, error: orderError } = await window.salvatoreSupabase
        .from('orders')
        .insert(orderPayload)
        .select('id')
        .single();

      if (orderError) {
        console.error('Error al registrar pedido en Supabase:', orderError);
      } else if (createdOrder?.id) {
        orderId = createdOrder.id;

        const itemsPayload = state.cart.map(item => ({
          order_id: orderId,
          product_name: item.name,
          quantity: item.qty,
          unit_price: item.unit,
          total_price: item.unit * item.qty,
          extras: item.extras || [],
          notes: item.note || ''
        }));

        const { error: itemsError } = await window.salvatoreSupabase.from('order_items').insert(itemsPayload);
        if (itemsError) {
          console.error('Error al registrar ítems del pedido en Supabase:', itemsError);
        }
      }
    } catch (err) {
      console.error('Excepción al registrar pedido en Supabase:', err);
    }
  }

  // 2. Construir mensaje de WhatsApp
  const orderLines = state.cart.map(item => 
    `• ${item.qty}x ${item.name}${item.extras.length ? ` (+ ${item.extras.join(', ')})` : ''}${item.note ? ` [Nota: ${item.note}]` : ''} — ${money(item.unit * item.qty)}`
  ).join('\n');

  const currentAvailability = getActiveAvailability();
  const orderIdHeader = orderId ? `*N° de Pedido:* #${orderId}\n\n` : '';

  const fullMessage = `¡Hola Salvatore! Quiero hacer este pedido:\n\n` +
    orderIdHeader +
    `${orderLines}\n\n` +
    `*Cliente:* ${clientName}\n` +
    `*Teléfono:* ${clientPhone}\n` +
    `*Entrega:* ${deliveryText}${deliveryAddress ? `\n*Dirección:* ${deliveryAddress}` : ''}\n` +
    `*Tiempo estimado:* ${currentAvailability.wait}\n` +
    `*Pago:* ${paymentMethod}${orderNotes ? `\n*Notas:* ${orderNotes}` : ''}\n\n` +
    `*Subtotal:* ${money(subtotal)}\n` +
    `*Total:* ${money(grandTotal)}`;

  // 3. Limpiar carrito y cerrar modal
  state.cart = [];
  persistCart();
  closeModal('checkoutModal');
  showToast('¡Pedido registrado! Abriendo WhatsApp... 🍕');

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Pedir por WhatsApp <span>↗</span>';
  }

  const whatsappUrl = `https://wa.me/56950602621?text=${encodeURIComponent(fullMessage)}`;
  window.open(whatsappUrl, '_blank');
});

// In-client quick availability form (if opened by staff)
$('#availabilityForm')?.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.target);
  const currentWorld = state.activeWorld;
  
  state.availabilityByWorld[currentWorld] = {
    status: data.get('availability'),
    wait: data.get('wait'),
    note: data.get('availabilityNote').trim()
  };

  persistAvailability();
  renderAvailability();
  closeModal('availabilityModal');
  showToast('Estado de disponibilidad actualizado.');
});

// ==========================================================================
// 11. INITIALIZATION
// ==========================================================================

renderMenuGrids();
renderCart();
renderAvailability();
loadRemoteAvailability();
initRealtimeAvailability();
setInterval(loadRemoteAvailability, 60000);
