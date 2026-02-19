/**
 * ╔══════════════════════════════════════════════════════╗
 * ║         CVite Pro — Serveur Principal               ║
 * ║  API REST + Gestion des licences en temps réel      ║
 * ╚══════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const express      = require('express');
const path         = require('path');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const jwt          = require('jsonwebtoken');
const bcrypt       = require('bcryptjs');
const { v4: uuid } = require('uuid');
const Database     = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 3000;

// ══════════════════════════════
//  BASE DE DONNÉES SQLITE
// ══════════════════════════════
const db = new Database(process.env.DB_PATH || './db/cvite.db');
db.pragma('journal_mode = WAL');

// Création des tables
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    company     TEXT,
    plan        TEXT DEFAULT 'monthly',
    status      TEXT DEFAULT 'trial',
    license_key TEXT UNIQUE NOT NULL,
    created_at  TEXT DEFAULT (datetime('now')),
    expires_at  TEXT,
    blocked     INTEGER DEFAULT 0,
    block_reason TEXT,
    last_check  TEXT,
    last_ip     TEXT,
    login_count INTEGER DEFAULT 0,
    notes       TEXT
  );

  CREATE TABLE IF NOT EXISTS license_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   TEXT NOT NULL,
    event       TEXT NOT NULL,
    detail      TEXT,
    ip          TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token       TEXT PRIMARY KEY,
    created_at  TEXT DEFAULT (datetime('now')),
    expires_at  TEXT NOT NULL
  );
`);

// ══════════════════════════════
//  MIDDLEWARES
// ══════════════════════════════
app.use(helmet({
  contentSecurityPolicy: false, // Désactivé pour servir les fichiers HTML avec scripts inline
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting — protège contre les attaques brute force
const licLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { ok: false, error: 'Trop de tentatives. Réessayez dans 15 minutes.' }
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { ok: false, error: 'Trop de requêtes.' }
});

// ══════════════════════════════
//  HELPERS
// ══════════════════════════════
function genKey() {
  const seg = () => Math.random().toString(36).substring(2, 7).toUpperCase();
  return `CVITE-${seg()}-${seg()}-${seg()}`;
}

function logEvent(clientId, event, detail = null, ip = null) {
  db.prepare(`INSERT INTO license_events (client_id, event, detail, ip) VALUES (?,?,?,?)`)
    .run(clientId, event, detail, ip);
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Non autorisé' });
  }
  const token = auth.slice(7);
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Session expirée' });
  }
}

// ══════════════════════════════
//  SERVIR LES FICHIERS STATIQUES
// ══════════════════════════════
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use('/', express.static(path.join(__dirname, '../client')));

// ══════════════════════════════════════════════════
//  API LICENCE — Utilisée par le logiciel client
// ══════════════════════════════════════════════════

/**
 * POST /api/license/check
 * Vérifie la validité d'une licence en temps réel
 * Appelé à chaque ouverture du logiciel
 */
app.post('/api/license/check', licLimiter, (req, res) => {
  const { key } = req.body;
  const ip = getClientIp(req);

  if (!key) return res.json({ ok: false, status: 'invalid', message: 'Clé manquante' });

  const client = db.prepare(`SELECT * FROM clients WHERE license_key = ?`).get(key.trim().toUpperCase());

  if (!client) {
    return res.json({ ok: false, status: 'invalid', message: 'Clé d\'activation invalide. Vérifiez et réessayez.' });
  }

  // Mettre à jour dernier check + IP
  db.prepare(`UPDATE clients SET last_check = datetime('now'), last_ip = ?, login_count = login_count + 1 WHERE id = ?`)
    .run(ip, client.id);

  // 1. Bloqué ?
  if (client.blocked) {
    logEvent(client.id, 'blocked_attempt', 'Tentative sur compte bloqué', ip);
    return res.json({
      ok: false,
      status: 'blocked',
      message: client.block_reason || 'Votre accès a été désactivé par l\'administrateur. Contactez votre prestataire.'
    });
  }

  // 2. Expiré ?
  if (client.expires_at) {
    const exp = new Date(client.expires_at);
    if (new Date() > exp) {
      logEvent(client.id, 'expired_attempt', 'Tentative sur licence expirée', ip);
      return res.json({
        ok: false,
        status: 'expired',
        message: 'Votre licence a expiré. Contactez votre prestataire pour renouveler.'
      });
    }
  }

  // 3. Valide !
  logEvent(client.id, 'check_ok', null, ip);

  const exp       = client.expires_at ? new Date(client.expires_at) : null;
  const daysLeft  = exp ? Math.ceil((exp - new Date()) / 86400000) : null;

  return res.json({
    ok: true,
    status: 'active',
    client: {
      name:     client.name,
      company:  client.company,
      plan:     client.plan,
      daysLeft: daysLeft,
      expiresAt: client.expires_at,
    },
    message: daysLeft !== null
      ? (daysLeft <= 7 ? `⚠️ Votre licence expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}` : `✅ Licence active — ${daysLeft} jours restants`)
      : '✅ Licence active'
  });
});

// ══════════════════════════════════════════
//  API ADMIN — Protégée par JWT
// ══════════════════════════════════════════

/**
 * POST /api/admin/login
 * Connexion admin
 */
app.post('/api/admin/login', adminLimiter, (req, res) => {
  const { password } = req.body;
  const adminPwd = process.env.ADMIN_PASSWORD || 'admin123';

  if (password !== adminPwd) {
    return res.status(401).json({ ok: false, error: 'Mot de passe incorrect' });
  }

  const token = jwt.sign(
    { role: 'admin' },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '8h' }
  );

  res.json({ ok: true, token });
});

/**
 * GET /api/admin/clients
 * Liste tous les clients
 */
app.get('/api/admin/clients', requireAdmin, (req, res) => {
  const clients = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM license_events WHERE client_id = c.id) as event_count,
      (SELECT created_at FROM license_events WHERE client_id = c.id ORDER BY created_at DESC LIMIT 1) as last_event
    FROM clients c
    ORDER BY c.created_at DESC
  `).all();
  res.json({ ok: true, clients });
});

/**
 * POST /api/admin/clients
 * Créer un nouveau client / licence
 */
app.post('/api/admin/clients', requireAdmin, (req, res) => {
  const { name, email, company, plan, days, notes } = req.body;

  if (!name || !email) {
    return res.status(400).json({ ok: false, error: 'Nom et email obligatoires' });
  }

  const id  = uuid();
  const key = genKey();
  const exp = days ? new Date(Date.now() + parseInt(days) * 86400000).toISOString() : null;

  try {
    db.prepare(`
      INSERT INTO clients (id, name, email, company, plan, status, license_key, expires_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, email.toLowerCase(), company || null, plan || 'monthly', 'active', key, exp, notes || null);

    logEvent(id, 'created', `Licence créée par admin. Plan: ${plan || 'monthly'}`, null);
    const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
    res.json({ ok: true, client });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({ ok: false, error: 'Cet email est déjà enregistré' });
    }
    res.status(500).json({ ok: false, error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/admin/clients/:id/block
 * Bloquer un client immédiatement
 */
app.put('/api/admin/clients/:id/block', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
  if (!client) return res.status(404).json({ ok: false, error: 'Client introuvable' });

  db.prepare(`UPDATE clients SET blocked = 1, block_reason = ? WHERE id = ?`)
    .run(reason || 'Accès révoqué par l\'administrateur', id);

  logEvent(id, 'blocked', reason || 'Bloqué par admin', null);
  res.json({ ok: true, message: `${client.name} bloqué avec succès` });
});

/**
 * PUT /api/admin/clients/:id/unblock
 * Débloquer un client
 */
app.put('/api/admin/clients/:id/unblock', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { days } = req.body;

  const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
  if (!client) return res.status(404).json({ ok: false, error: 'Client introuvable' });

  const exp = days
    ? new Date(Date.now() + parseInt(days) * 86400000).toISOString()
    : client.expires_at;

  db.prepare(`UPDATE clients SET blocked = 0, block_reason = null, status = 'active', expires_at = ? WHERE id = ?`)
    .run(exp, id);

  logEvent(id, 'unblocked', `Débloqué par admin. Nouveau délai: ${days || 'inchangé'} jours`, null);
  res.json({ ok: true, message: `${client.name} réactivé avec succès` });
});

/**
 * PUT /api/admin/clients/:id/extend
 * Prolonger une licence
 */
app.put('/api/admin/clients/:id/extend', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { days } = req.body;

  if (!days || parseInt(days) < 1) {
    return res.status(400).json({ ok: false, error: 'Nombre de jours invalide' });
  }

  const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
  if (!client) return res.status(404).json({ ok: false, error: 'Client introuvable' });

  // Prolonger depuis maintenant ou depuis l'expiration actuelle si dans le futur
  const base = (client.expires_at && new Date(client.expires_at) > new Date())
    ? new Date(client.expires_at)
    : new Date();
  const newExp = new Date(base.getTime() + parseInt(days) * 86400000).toISOString();

  db.prepare(`UPDATE clients SET expires_at = ?, status = 'active', blocked = 0 WHERE id = ?`)
    .run(newExp, id);

  logEvent(id, 'extended', `Prolongé de ${days} jours. Nouvelle expiration: ${newExp}`, null);
  res.json({ ok: true, message: `Licence prolongée jusqu'au ${new Date(newExp).toLocaleDateString('fr-FR')}` });
});

/**
 * PUT /api/admin/clients/:id/renew-key
 * Régénérer la clé d'activation
 */
app.put('/api/admin/clients/:id/renew-key', requireAdmin, (req, res) => {
  const { id } = req.params;

  const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
  if (!client) return res.status(404).json({ ok: false, error: 'Client introuvable' });

  const newKey = genKey();
  db.prepare(`UPDATE clients SET license_key = ? WHERE id = ?`).run(newKey, id);
  logEvent(id, 'key_renewed', 'Clé régénérée par admin', null);

  res.json({ ok: true, newKey, message: 'Nouvelle clé générée' });
});

/**
 * DELETE /api/admin/clients/:id
 * Supprimer un client
 */
app.delete('/api/admin/clients/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare(`DELETE FROM license_events WHERE client_id = ?`).run(id);
  db.prepare(`DELETE FROM clients WHERE id = ?`).run(id);
  res.json({ ok: true, message: 'Client supprimé' });
});

/**
 * GET /api/admin/clients/:id/events
 * Historique d'un client
 */
app.get('/api/admin/clients/:id/events', requireAdmin, (req, res) => {
  const events = db.prepare(`
    SELECT * FROM license_events WHERE client_id = ?
    ORDER BY created_at DESC LIMIT 100
  `).all(req.params.id);
  res.json({ ok: true, events });
});

/**
 * GET /api/admin/stats
 * Statistiques globales
 */
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const stats = {
    total:    db.prepare(`SELECT COUNT(*) as n FROM clients`).get().n,
    active:   db.prepare(`SELECT COUNT(*) as n FROM clients WHERE blocked = 0 AND (expires_at IS NULL OR expires_at > datetime('now'))`).get().n,
    blocked:  db.prepare(`SELECT COUNT(*) as n FROM clients WHERE blocked = 1`).get().n,
    expired:  db.prepare(`SELECT COUNT(*) as n FROM clients WHERE blocked = 0 AND expires_at < datetime('now')`).get().n,
    checks_today: db.prepare(`SELECT COUNT(*) as n FROM license_events WHERE event = 'check_ok' AND created_at > datetime('now', '-1 day')`).get().n,
  };
  res.json({ ok: true, stats });
});

// ══════════════════════════════
//  DÉMARRAGE
// ══════════════════════════════
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║     CVite Pro — Serveur démarré       ║
  ║     http://localhost:${PORT}             ║
  ║     Admin : http://localhost:${PORT}/admin ║
  ╚═══════════════════════════════════════╝
  `);
});

module.exports = app;
