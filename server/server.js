const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));
const productsById = new Map(products.map((p) => [p.id, p]));

if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, '[]');
}

// session-id -> { productId: quantity }
const carts = new Map();

function getSessionId(req, res) {
  let sessionId = req.headers['x-session-id'];
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  res.setHeader('x-session-id', sessionId);
  return sessionId;
}

function getCart(sessionId) {
  if (!carts.has(sessionId)) {
    carts.set(sessionId, new Map());
  }
  return carts.get(sessionId);
}

function cartToResponse(cart) {
  const items = [];
  let total = 0;
  for (const [productId, quantity] of cart.entries()) {
    const product = productsById.get(productId);
    if (!product) continue;
    const subtotal = product.price * quantity;
    total += subtotal;
    items.push({ ...product, quantity, subtotal });
  }
  return { items, total: Math.round(total * 100) / 100 };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/products', (req, res) => {
  res.json(products);
});

app.get('/api/cart', (req, res) => {
  const sessionId = getSessionId(req, res);
  res.json(cartToResponse(getCart(sessionId)));
});

app.post('/api/cart', (req, res) => {
  const sessionId = getSessionId(req, res);
  const { productId, quantity = 1 } = req.body || {};

  if (!productId || !productsById.has(productId)) {
    return res.status(400).json({ error: 'Unbekanntes Produkt.' });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Ungültige Menge.' });
  }

  const cart = getCart(sessionId);
  cart.set(productId, (cart.get(productId) || 0) + quantity);
  res.json(cartToResponse(cart));
});

app.put('/api/cart/:productId', (req, res) => {
  const sessionId = getSessionId(req, res);
  const { productId } = req.params;
  const { quantity } = req.body || {};

  if (!productsById.has(productId)) {
    return res.status(404).json({ error: 'Unbekanntes Produkt.' });
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return res.status(400).json({ error: 'Ungültige Menge.' });
  }

  const cart = getCart(sessionId);
  if (quantity === 0) {
    cart.delete(productId);
  } else {
    cart.set(productId, quantity);
  }
  res.json(cartToResponse(cart));
});

app.delete('/api/cart/:productId', (req, res) => {
  const sessionId = getSessionId(req, res);
  const cart = getCart(sessionId);
  cart.delete(req.params.productId);
  res.json(cartToResponse(cart));
});

app.post('/api/checkout', (req, res) => {
  const sessionId = getSessionId(req, res);
  const cart = getCart(sessionId);

  if (cart.size === 0) {
    return res.status(400).json({ error: 'Warenkorb ist leer.' });
  }

  const { name, email, address } = req.body || {};
  if (!name || !email || !address) {
    return res.status(400).json({ error: 'Name, E-Mail und Adresse sind erforderlich.' });
  }

  const { items, total } = cartToResponse(cart);
  const order = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    customer: { name, email, address },
    items,
    total,
  };

  const orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8'));
  orders.push(order);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));

  cart.clear();

  res.json({ order });
});

app.listen(PORT, () => {
  console.log(`ABYSSE Parfums Server läuft auf http://localhost:${PORT}`);
});
