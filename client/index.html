require('dotenv').config();
const express      = require('express');
const path         = require('path');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const jwt          = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const licLimiter = rateLimit({ windowMs: 15*60*1000, max: 20 });
const admLimiter = rateLimit({ windowMs: 15*60*1000, max: 30 });

function genKey() {
  const s = () => Math.random().toString(36).substring(2,7).toUpperCase();
  return `CVITE-${s()}-${s()}-${s()}`;
}

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ ok:false, error:'Non autorisé' });
  try { jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'secret'); next(); }
  catch { res.status(401).json({ ok:false, error:'Session expirée' }); }
}

async function logEvent(clientId, event, detail=null, ip=null) {
  await supabase.from('license_events').insert({ client_id:clientId, event, detail, ip });
}

app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use('/', express.static(path.join(__dirname, '../client')));

// ── VÉRIFICATION LICENCE ──
app.post('/api/license/check', licLimiter, async (req, res) => {
  const { key } = req.body;
  const ip = getIp(req);
  if (!key) return res.json({ ok:false, status:'invalid', message:'Clé manquante' });

  const { data: client } = await supabase
    .from('clients').select('*')
    .eq('license_key', key.trim().toUpperCase()).single();

  if (!client) return res.json({ ok:false, status:'invalid', message:'Clé invalide. Vérifiez et réessayez.' });

  await supabase.from('clients').update({
    last_check: new Date().toISOString(), last_ip: ip,
    login_count: (client.login_count||0)+1
  }).eq('id', client.id);

  if (client.blocked) {
    await logEvent(client.id, 'blocked_attempt', null, ip);
    return res.json({ ok:false, status:'blocked', message: client.block_reason || 'Accès désactivé. Contactez votre prestataire.' });
  }

  if (client.expires_at && new Date() > new Date(client.expires_at)) {
    await logEvent(client.id, 'expired_attempt', null, ip);
    return res.json({ ok:false, status:'expired', message:'Licence expirée. Contactez votre prestataire.' });
  }

  await logEvent(client.id, 'check_ok', null, ip);
  const exp = client.expires_at ? new Date(client.expires_at) : null;
  const daysLeft = exp ? Math.ceil((exp - new Date()) / 86400000) : null;

  return res.json({
    ok:true, status:'active',
    client: { name:client.name, company:client.company, plan:client.plan, daysLeft, expiresAt:client.expires_at },
    message: daysLeft !== null
      ? (daysLeft <= 7 ? `⚠️ Expire dans ${daysLeft} jour(s)` : `✅ Licence active — ${daysLeft} jours restants`)
      : '✅ Licence active'
  });
});

// ── LOGIN ADMIN ──
app.post('/api/admin/login', admLimiter, (req, res) => {
  if (req.body.password !== (process.env.ADMIN_PASSWORD || 'admin123'))
    return res.status(401).json({ ok:false, error:'Mot de passe incorrect' });
  const token = jwt.sign({ role:'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn:'8h' });
  res.json({ ok:true, token });
});

// ── LISTE CLIENTS ──
app.get('/api/admin/clients', requireAdmin, async (req, res) => {
  const { data } = await supabase.from('clients').select('*').order('created_at', { ascending:false });
  res.json({ ok:true, clients: data||[] });
});

// ── CRÉER CLIENT ──
app.post('/api/admin/clients', requireAdmin, async (req, res) => {
  const { name, email, company, plan, days, notes } = req.body;
  if (!name || !email) return res.status(400).json({ ok:false, error:'Nom et email obligatoires' });
  const id  = uuid();
  const key = genKey();
  const exp = days ? new Date(Date.now() + parseInt(days)*86400000).toISOString() : null;
  const { data, error } = await supabase.from('clients').insert({
    id, name, email:email.toLowerCase(), company:company||null,
    plan:plan||'yearly', status:'active', license_key:key,
    expires_at:exp, notes:notes||null, blocked:false, login_count:0
  }).select().single();
  if (error) return res.status(400).json({ ok:false, error: error.message.includes('unique') ? 'Email déjà enregistré' : 'Erreur serveur' });
  await logEvent(id, 'created', `Plan: ${plan}`, null);
  res.json({ ok:true, client:data });
});

// ── BLOQUER ──
app.put('/api/admin/clients/:id/block', requireAdmin, async (req, res) => {
  const { reason } = req.body;
  await supabase.from('clients').update({ blocked:true, block_reason:reason||'Accès révoqué' }).eq('id', req.params.id);
  await logEvent(req.params.id, 'blocked', reason, null);
  res.json({ ok:true, message:'Client bloqué' });
});

// ── DÉBLOQUER ──
app.put('/api/admin/clients/:id/unblock', requireAdmin, async (req, res) => {
  const exp = req.body.days ? new Date(Date.now() + parseInt(req.body.days)*86400000).toISOString() : null;
  await supabase.from('clients').update({ blocked:false, block_reason:null, status:'active', ...(exp?{expires_at:exp}:{}) }).eq('id', req.params.id);
  await logEvent(req.params.id, 'unblocked', null, null);
  res.json({ ok:true, message:'Client réactivé' });
});

// ── PROLONGER ──
app.put('/api/admin/clients/:id/extend', requireAdmin, async (req, res) => {
  const { days } = req.body;
  if (!days || parseInt(days)<1) return res.status(400).json({ ok:false, error:'Jours invalide' });
  const { data:client } = await supabase.from('clients').select('expires_at').eq('id', req.params.id).single();
  const base = (client?.expires_at && new Date(client.expires_at) > new Date()) ? new Date(client.expires_at) : new Date();
  const newExp = new Date(base.getTime() + parseInt(days)*86400000).toISOString();
  await supabase.from('clients').update({ expires_at:newExp, status:'active', blocked:false }).eq('id', req.params.id);
  await logEvent(req.params.id, 'extended', `+${days} jours`, null);
  res.json({ ok:true, message:`Prolongé jusqu'au ${new Date(newExp).toLocaleDateString('fr-FR')}` });
});

// ── NOUVELLE CLÉ ──
app.put('/api/admin/clients/:id/renew-key', requireAdmin, async (req, res) => {
  const newKey = genKey();
  await supabase.from('clients').update({ license_key:newKey }).eq('id', req.params.id);
  await logEvent(req.params.id, 'key_renewed', null, null);
  res.json({ ok:true, newKey, message:'Nouvelle clé générée' });
});

// ── SUPPRIMER ──
app.delete('/api/admin/clients/:id', requireAdmin, async (req, res) => {
  await supabase.from('license_events').delete().eq('client_id', req.params.id);
  await supabase.from('clients').delete().eq('id', req.params.id);
  res.json({ ok:true, message:'Client supprimé' });
});

// ── HISTORIQUE ──
app.get('/api/admin/clients/:id/events', requireAdmin, async (req, res) => {
  const { data } = await supabase.from('license_events').select('*')
    .eq('client_id', req.params.id).order('created_at', { ascending:false }).limit(100);
  res.json({ ok:true, events:data||[] });
});

// ── STATS ──
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const { data:clients } = await supabase.from('clients').select('*');
  const now = new Date();
  const total   = clients?.length||0;
  const blocked = clients?.filter(c=>c.blocked).length||0;
  const expired = clients?.filter(c=>!c.blocked&&c.expires_at&&new Date(c.expires_at)<now).length||0;
  const active  = total-blocked-expired;
  const yesterday = new Date(now-86400000).toISOString();
  const { data:events } = await supabase.from('license_events').select('*').eq('event','check_ok').gte('created_at', yesterday);
  res.json({ ok:true, stats:{ total, active, blocked, expired, checks_today:events?.length||0 } });
});

app.listen(PORT, () => console.log(`✅ CVite Pro démarré sur le port ${PORT}`));
module.exports = app;
