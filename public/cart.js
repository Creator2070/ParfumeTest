/* Warenkorb-Logik: spricht mit dem Express-Backend (/api/*) */

const SESSION_KEY = 'abysse-session-id';

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': getSessionId(),
      ...(options.headers || {}),
    },
  });
  const newSessionId = res.headers.get('x-session-id');
  if (newSessionId) localStorage.setItem(SESSION_KEY, newSessionId);

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ein Fehler ist aufgetreten.');
  return data;
}

const euro = (n) => `${n.toFixed(2).replace('.', ',')} €`;

const cartToggle = document.getElementById('cart-toggle');
const cartOverlay = document.getElementById('cart-overlay');
const cartDrawer = document.getElementById('cart-drawer');
const cartClose = document.getElementById('cart-close');
const cartItemsEl = document.getElementById('cart-items');
const cartTotalEl = document.getElementById('cart-total');
const cartCountEl = document.getElementById('cart-count');

const checkoutOverlay = document.getElementById('checkout-overlay');
const checkoutOpen = document.getElementById('checkout-open');
const checkoutClose = document.getElementById('checkout-close');
const checkoutForm = document.getElementById('checkout-form');
const checkoutSummary = document.getElementById('checkout-summary');
const checkoutSuccess = document.getElementById('checkout-success');
const checkoutDone = document.getElementById('checkout-done');
const orderIdEl = document.getElementById('order-id');

let currentCart = { items: [], total: 0 };

function renderCart() {
  const { items, total } = currentCart;
  cartCountEl.textContent = items.reduce((sum, i) => sum + i.quantity, 0);
  cartTotalEl.textContent = euro(total);

  if (items.length === 0) {
    cartItemsEl.innerHTML = '<p class="cart-empty">Dein Warenkorb ist leer.</p>';
    return;
  }

  cartItemsEl.innerHTML = items.map((item) => `
    <div class="cart-item" data-id="${item.id}">
      <div>
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">${euro(item.price)} / Stück</div>
        <div class="cart-item-qty">
          <button class="qty-decrease" aria-label="Menge verringern">&minus;</button>
          <span>${item.quantity}</span>
          <button class="qty-increase" aria-label="Menge erhöhen">+</button>
        </div>
        <button class="cart-item-remove">Entfernen</button>
      </div>
      <div class="cart-item-price">${euro(item.subtotal)}</div>
    </div>
  `).join('');
}

async function refreshCart() {
  currentCart = await api('/api/cart');
  renderCart();
}

async function addToCart(productId) {
  currentCart = await api('/api/cart', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity: 1 }),
  });
  renderCart();
  openCart();
}

async function setQuantity(productId, quantity) {
  currentCart = await api(`/api/cart/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });
  renderCart();
}

async function removeItem(productId) {
  currentCart = await api(`/api/cart/${productId}`, { method: 'DELETE' });
  renderCart();
}

function openCart() {
  cartDrawer.classList.add('open');
  cartOverlay.classList.add('open');
}
function closeCart() {
  cartDrawer.classList.remove('open');
  cartOverlay.classList.remove('open');
}

function openCheckout() {
  if (currentCart.items.length === 0) return;
  checkoutSummary.innerHTML = currentCart.items
    .map((i) => `${i.quantity} × ${i.name} — ${euro(i.subtotal)}`)
    .join('<br>') + `<br><strong>Gesamt: ${euro(currentCart.total)}</strong>`;
  checkoutForm.hidden = false;
  checkoutSuccess.hidden = true;
  checkoutOverlay.classList.add('open');
}
function closeCheckout() {
  checkoutOverlay.classList.remove('open');
}

cartToggle.addEventListener('click', openCart);
cartClose.addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);

checkoutOpen.addEventListener('click', () => {
  closeCart();
  openCheckout();
});
checkoutClose.addEventListener('click', closeCheckout);
checkoutDone.addEventListener('click', () => {
  closeCheckout();
});

cartItemsEl.addEventListener('click', (e) => {
  const row = e.target.closest('.cart-item');
  if (!row) return;
  const productId = row.dataset.id;
  const item = currentCart.items.find((i) => i.id === productId);

  if (e.target.classList.contains('qty-increase')) {
    setQuantity(productId, item.quantity + 1);
  } else if (e.target.classList.contains('qty-decrease')) {
    setQuantity(productId, item.quantity - 1);
  } else if (e.target.classList.contains('cart-item-remove')) {
    removeItem(productId);
  }
});

document.querySelectorAll('.add-to-cart').forEach((btn) => {
  btn.addEventListener('click', () => addToCart(btn.dataset.productId));
});

checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(checkoutForm);
  try {
    const { order } = await api('/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.get('name'),
        email: formData.get('email'),
        address: formData.get('address'),
      }),
    });
    checkoutForm.hidden = true;
    checkoutSuccess.hidden = false;
    orderIdEl.textContent = `Bestellnummer: ${order.id}`;
    await refreshCart();
  } catch (err) {
    alert(err.message);
  }
});

refreshCart();
