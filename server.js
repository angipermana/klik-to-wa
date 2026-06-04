const express = require('express');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { Client } = require('@notionhq/client');
const db = require('./database');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set secure: true in production with HTTPS
}));

// Admin password hash cache
let adminPasswordHash = '';
bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin', 10, (err, hash) => {
  if (err) console.error('Error hashing password:', err);
  else adminPasswordHash = hash;
});

// Middleware for admin auth
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// --- AUTH API ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === (process.env.ADMIN_USERNAME || 'admin')) {
    const match = await bcrypt.compare(password, adminPasswordHash);
    if (match) {
      req.session.userId = 1; // dummy user id
      return res.json({ success: true });
    }
  }
  res.status(401).json({ error: 'Invalid username or password' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (req.session.userId) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

// --- ADMIN API ---
app.get('/api/admin/settings', requireAuth, (req, res) => {
  const settings = db.prepare('SELECT * FROM settings LIMIT 1').get();
  res.json(settings || {});
});

app.post('/api/admin/settings', requireAuth, (req, res) => {
  const { notion_token, notion_database_id, wa_template } = req.body;
  const stmt = db.prepare('UPDATE settings SET notion_token = ?, notion_database_id = ?, wa_template = ?');
  stmt.run(notion_token, notion_database_id, wa_template);
  res.json({ success: true });
});

app.get('/api/admin/cs', requireAuth, (req, res) => {
  const csList = db.prepare('SELECT * FROM cs_numbers ORDER BY id ASC').all();
  res.json(csList);
});

app.post('/api/admin/cs', requireAuth, (req, res) => {
  const { name, phone_number, is_active } = req.body;
  const stmt = db.prepare('INSERT INTO cs_numbers (name, phone_number, is_active) VALUES (?, ?, ?)');
  const info = stmt.run(name, phone_number, is_active ? 1 : 0);
  res.json({ success: true, id: info.lastInsertRowid });
});

app.put('/api/admin/cs/:id', requireAuth, (req, res) => {
  const { name, phone_number, is_active } = req.body;
  const { id } = req.params;
  const stmt = db.prepare('UPDATE cs_numbers SET name = ?, phone_number = ?, is_active = ? WHERE id = ?');
  stmt.run(name, phone_number, is_active ? 1 : 0, id);
  res.json({ success: true });
});

app.delete('/api/admin/cs/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM cs_numbers WHERE id = ?');
  stmt.run(id);
  res.json({ success: true });
});

app.get('/api/admin/leads', requireAuth, (req, res) => {
  const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 100').all();
  res.json(leads);
});

app.put('/api/admin/leads/:id', requireAuth, (req, res) => {
  const { customer_name, customer_phone, product, assigned_cs, sync_status } = req.body;
  const { id } = req.params;
  const stmt = db.prepare('UPDATE leads SET customer_name = ?, customer_phone = ?, product = ?, assigned_cs = ?, sync_status = ? WHERE id = ?');
  stmt.run(customer_name, customer_phone, product, assigned_cs, sync_status, id);
  res.json({ success: true });
});

app.delete('/api/admin/leads/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM leads WHERE id = ?');
  stmt.run(id);
  res.json({ success: true });
});

// --- PUBLIC API ---
app.post('/api/leads', (req, res) => {
  const { customer_name, customer_phone, product } = req.body;
  
  if (!customer_name || !customer_phone || !product) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Formatting phone (08 -> 628)
  let formattedPhone = customer_phone.trim();
  if (formattedPhone.startsWith('08')) {
    formattedPhone = '62' + formattedPhone.substring(1);
  } else if (formattedPhone.startsWith('8')) {
    formattedPhone = '62' + formattedPhone;
  }
  
  // Remove non-numeric chars
  formattedPhone = formattedPhone.replace(/\D/g, '');

  // Get active CS numbers
  const activeCs = db.prepare('SELECT * FROM cs_numbers WHERE is_active = 1 ORDER BY id ASC').all();
  
  if (activeCs.length === 0) {
    return res.status(500).json({ error: 'No active CS available' });
  }

  // Get settings for rotator
  const settings = db.prepare('SELECT * FROM settings LIMIT 1').get();
  let currentIndex = settings.current_index || 0;
  
  // Rotator Logic
  const targetIndex = currentIndex % activeCs.length;
  const selectedCs = activeCs[targetIndex];
  
  // Update index
  db.prepare('UPDATE settings SET current_index = ?').run(currentIndex + 1);
  
  // Save Lead to DB
  const insertLeadStmt = db.prepare('INSERT INTO leads (customer_name, customer_phone, product, assigned_cs) VALUES (?, ?, ?, ?)');
  const info = insertLeadStmt.run(customer_name, formattedPhone, product, selectedCs.phone_number);
  const leadId = info.lastInsertRowid;
  
  // Async send to notion
  sendToNotion(leadId, customer_name, formattedPhone, product, selectedCs.name, settings);

  // Prepare WA Link
  let waTemplate = settings.wa_template;
  waTemplate = waTemplate.replace(/{nama}/g, customer_name).replace(/{produk}/g, product);
  const encodedText = encodeURIComponent(waTemplate);
  const waUrl = `https://wa.me/${selectedCs.phone_number}?text=${encodedText}`;

  res.json({ success: true, redirectUrl: waUrl });
});

async function sendToNotion(leadId, name, phone, product, csName, settings) {
  if (!settings.notion_token || !settings.notion_database_id) {
    console.log('Notion not configured, skipping sync.');
    return;
  }
  
  const notion = new Client({ auth: settings.notion_token });
  try {
    await notion.pages.create({
      parent: { database_id: settings.notion_database_id },
      properties: {
        "Tanggal Masuk": { title: [{ text: { content: new Date().toLocaleString('id-ID') } }] },
        "Nama": { rich_text: [{ text: { content: name } }] },
        "No. WhatsApp": { phone_number: phone },
        "Produk Pilihan": { rich_text: [{ text: { content: product } }] },
        "Nama CS": { select: { name: csName } }
      }
    });
    db.prepare("UPDATE leads SET sync_status = 'SUCCESS' WHERE id = ?").run(leadId);
  } catch (error) {
    console.error('Error syncing to Notion:', error.message);
    db.prepare("UPDATE leads SET sync_status = 'FAILED' WHERE id = ?").run(leadId);
  }
}

app.listen(port, () => {
  console.log(`LeadFlow WA running at http://localhost:${port}`);
});
