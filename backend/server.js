const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');


// ── BANCAS DEFAULT ────────────────────────────────────────────────────────────
const BANCAS_DEFAULT = ['CESPE/CEBRASPE', 'FGV', 'FCC', 'VUNESP', 'FUNRIO', 'IBFC', 'QUADRIX'];

function ensureBancasDefault(userId) {
  const insert = db.prepare('INSERT OR IGNORE INTO bancas (user_id, nome) VALUES (?, ?)');
  for (const nome of BANCAS_DEFAULT) {
    insert.run(userId, nome);
  }
}

// ── HELPERS DE DATA (fuso de Brasília UTC-3) ──────────────────────────────────
function getBrasiliaDate() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}

function getBrasiliaISO() {
  return getBrasiliaDate().toISOString().slice(0, 10);
}

function getMondayBrasilia() {
  const brasilia = getBrasiliaDate();
  const day = brasilia.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  brasilia.setUTCDate(brasilia.getUTCDate() + diff);
  return brasilia.toISOString().slice(0, 10);
}

const app = express();
const PORT = process.env.PORT || 3000;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET || 'hiperfoco-session-secret';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ── PASSPORT ──────────────────────────────────────────────────────────────────
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: BASE_URL + '/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
  try {
    let user = db.prepare('SELECT * FROM usuarios WHERE google_id = ?').get(profile.id);
    if (!user) {
      const info = db.prepare('INSERT INTO usuarios (google_id, nome, email, foto) VALUES (?, ?, ?, ?)').run(
        profile.id,
        profile.displayName || '',
        profile.emails?.[0]?.value || '',
        profile.photos?.[0]?.value || ''
      );
      user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(info.lastInsertRowid);
    }
    ensureBancasDefault(user.id);
    return done(null, user);
  } catch(e) {
    return done(e);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  done(null, user || false);
});

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 dias
}));
app.use(passport.initialize());
app.use(passport.session());

// Middleware de autenticação para rotas de API
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Não autenticado' });
}

// Static files públicos (login page)
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));
app.use('/fonts', express.static(path.join(__dirname, '../frontend/fonts')));

// ── AUTH ROUTES ───────────────────────────────────────────────────────────────
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?erro=1' }),
  (req, res) => res.redirect('/')
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/login'));
});

app.get('/auth/me', (req, res) => {
  if (req.isAuthenticated()) {
    ensureBancasDefault(req.user.id);
    res.json({ autenticado: true, usuario: { id: req.user.id, nome: req.user.nome, email: req.user.email, foto: req.user.foto } });
  } else {
    res.json({ autenticado: false });
  }
});

// ── PÁGINAS ───────────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/');
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── API CONFIG ────────────────────────────────────────────────────────────────
app.get('/api/config/:key', requireAuth, (req, res) => {
  const key = req.params.key;
  const row = db.prepare('SELECT value FROM app_config WHERE user_id=? AND key=?').get(req.user.id, key);
  // Compatibilidade: se buscar plano_alvo e não achar, tenta a chave legada
  if (!row && key === 'plano_alvo') {
    const legacy = db.prepare('SELECT value FROM app_config WHERE user_id=? AND key=?').get(req.user.id, 'concurso_alvo');
    return res.json({ value: legacy ? legacy.value : null });
  }
  res.json({ value: row ? row.value : null });
});
app.post('/api/config/:key', requireAuth, (req, res) => {
  const { value } = req.body;
  const key = req.params.key;
  db.prepare('INSERT OR REPLACE INTO app_config (user_id, key, value) VALUES (?, ?, ?)').run(req.user.id, key, value);
  // Mantém a chave legada sincronizada durante período de transição
  if (key === 'plano_alvo') {
    db.prepare('INSERT OR REPLACE INTO app_config (user_id, key, value) VALUES (?, ?, ?)').run(req.user.id, 'concurso_alvo', value);
  }
  res.json({ ok: true });
});

// ── BANCAS ────────────────────────────────────────────────────────────────────
app.get('/api/bancas', requireAuth, (req, res) => {
  const bancas = db.prepare('SELECT * FROM bancas WHERE user_id=? ORDER BY nome').all(req.user.id);
  res.json(bancas);
});
app.post('/api/bancas', requireAuth, (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  try {
    const info = db.prepare('INSERT OR IGNORE INTO bancas (user_id, nome) VALUES (?, ?)').run(req.user.id, nome.trim());
    const banca = db.prepare('SELECT * FROM bancas WHERE user_id=? AND nome=?').get(req.user.id, nome.trim());
    res.json(banca);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});
app.delete('/api/bancas/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM bancas WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── DISCIPLINAS ───────────────────────────────────────────────────────────────
app.get('/api/disciplinas', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM disciplinas WHERE user_id=? ORDER BY nome').all(req.user.id));
});
app.post('/api/disciplinas', requireAuth, (req, res) => {
  const { nome, estrategia='', teoria_material='', teoria_link='', resumo_tipo='', resumo_descricao='', resumo_link='' } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
  // Proteção contra duplicata
  const existe = db.prepare('SELECT id FROM disciplinas WHERE user_id=? AND LOWER(nome)=LOWER(?)').get(req.user.id, nome);
  if (existe) return res.status(409).json({ error: 'Já existe uma disciplina com este nome' });
  const info = db.prepare('INSERT INTO disciplinas (user_id,nome,meta_acerto,estrategia,teoria_material,teoria_link,resumo_tipo,resumo_descricao,resumo_link) VALUES (?,?,75,?,?,?,?,?,?)').run(req.user.id,nome,estrategia,teoria_material,teoria_link,resumo_tipo,resumo_descricao,resumo_link);
  res.json({ id: info.lastInsertRowid, nome });
});
app.put('/api/disciplinas/:id', requireAuth, (req, res) => {
  const { nome, estrategia='', teoria_material='', teoria_link='', resumo_tipo='', resumo_descricao='', resumo_link='', nivel_conhecimento=null } = req.body;
  db.prepare('UPDATE disciplinas SET nome=?,estrategia=?,teoria_material=?,teoria_link=?,resumo_tipo=?,resumo_descricao=?,resumo_link=?,nivel_conhecimento=? WHERE id=? AND user_id=?').run(nome,estrategia,teoria_material,teoria_link,resumo_tipo,resumo_descricao,resumo_link,nivel_conhecimento,req.params.id,req.user.id);
  res.json({ ok: true });
});
app.delete('/api/disciplinas/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM disciplinas WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── ASSUNTOS ──────────────────────────────────────────────────────────────────
app.get('/api/assuntos', requireAuth, (req, res) => {
  const { disciplina_id } = req.query;
  if (disciplina_id) {
    res.json(db.prepare('SELECT * FROM assuntos WHERE disciplina_id=? ORDER BY ordem,codigo,nome').all(disciplina_id));
  } else {
    res.json(db.prepare('SELECT a.*,d.nome as disciplina_nome FROM assuntos a JOIN disciplinas d ON a.disciplina_id=d.id WHERE d.user_id=? ORDER BY d.nome,a.ordem,a.codigo,a.nome').all(req.user.id));
  }
});
app.post('/api/assuntos', requireAuth, (req, res) => {
  const { nome, disciplina_id, parent_id=null, codigo='' } = req.body;
  if (!nome || !disciplina_id) return res.status(400).json({ error: 'Nome e disciplina obrigatórios' });
  // Ordem = último da lista (pai ou raiz)
  const maxOrdem = db.prepare('SELECT MAX(ordem) as m FROM assuntos WHERE disciplina_id=? AND parent_id IS ?').get(disciplina_id, parent_id || null);
  const ordem = (maxOrdem.m || 0) + 1;
  const info = db.prepare('INSERT INTO assuntos (nome,disciplina_id,parent_id,codigo,ordem) VALUES (?,?,?,?,?)').run(nome,disciplina_id,parent_id||null,codigo,ordem);
  res.json({ id: info.lastInsertRowid, nome, disciplina_id, parent_id, codigo, ordem });
});
app.post('/api/assuntos/importar', requireAuth, (req, res) => {
  const { disciplina_id, texto } = req.body;
  if (!disciplina_id || !texto) return res.status(400).json({ error: 'Dados obrigatórios' });
  const lines = texto.split('\n').map(l => l.trim()).filter(l => l && !l.toLowerCase().startsWith('hierarquia'));
  const inserted = [];
  const parentMap = {};
  db.transaction(() => {
    let ordemRaiz = db.prepare('SELECT MAX(ordem) as m FROM assuntos WHERE disciplina_id=? AND parent_id IS NULL').get(disciplina_id).m || 0;
    const ordemMap = {};
    for (const line of lines) {
      const parts = line.split('\t');
      let codigo = '', nome = '';
      if (parts.length >= 2) { codigo = parts[0].trim(); nome = parts[1].trim(); }
      else { nome = parts[0].trim(); }
      if (!nome) continue;
      // Remove o código do início do nome se ele vier colado
      nome = nome.replace(/^\d[\d.]*\s+/, '').trim();
      let parent_id = null;
      if (codigo && codigo.includes('.')) {
        const parentCodigo = codigo.substring(0, codigo.lastIndexOf('.'));
        parent_id = parentMap[parentCodigo] || null;
      }
      // Ordem dentro do grupo (raiz ou dentro do pai)
      const key = parent_id || 'root';
      ordemMap[key] = (ordemMap[key] || (parent_id ? 0 : ordemRaiz)) + 1;
      const ordem = ordemMap[key];
      // Salva só o nome, sem o código
      const info = db.prepare('INSERT INTO assuntos (nome,disciplina_id,parent_id,codigo,ordem) VALUES (?,?,?,?,?)').run(nome,disciplina_id,parent_id,codigo,ordem);
      if (codigo) parentMap[codigo] = info.lastInsertRowid;
      inserted.push({ id: info.lastInsertRowid, nome, codigo, parent_id, ordem });
    }
  })();
  res.json({ inserted: inserted.length, assuntos: inserted });
});
app.put('/api/assuntos/reordenar', requireAuth, (req, res) => {
  const { itens } = req.body;
  const upd = db.prepare('UPDATE assuntos SET ordem=?,parent_id=? WHERE id=?');
  db.transaction(() => { for (const i of itens) upd.run(i.ordem, i.parent_id||null, i.id); })();
  res.json({ ok: true });
});
// Endpoint do modal "Editar assuntos": salva lista completa (nova/atualizada) de uma vez
app.put('/api/assuntos/reordenar-completo', requireAuth, (req, res) => {
  const { disciplina_id, itens } = req.body;
  if (!disciplina_id || !Array.isArray(itens)) return res.status(400).json({ error: 'Dados inválidos' });
  db.transaction(() => {
    // Deleta todos e reinsere em ordem para simplificar
    // (manter IDs existentes, criar novos para id=null)
    const idMap = {}; // mapeamento de ids temporários negativos → ids reais
    for (const it of itens) {
      if (it.id && it.id > 0) {
        // Atualiza existente
        const realParent = it.parent_id ? (idMap[it.parent_id] || it.parent_id) : null;
        db.prepare('UPDATE assuntos SET nome=?,ordem=?,parent_id=? WHERE id=? AND disciplina_id=?').run(it.nome, it.ordem, realParent, it.id, disciplina_id);
        idMap[it.id] = it.id;
      } else {
        // Novo assunto
        const realParent = it.parent_id ? (idMap[it.parent_id] || null) : null;
        const info = db.prepare('INSERT INTO assuntos (nome, disciplina_id, parent_id, ordem) VALUES (?,?,?,?)').run(it.nome, disciplina_id, realParent, it.ordem);
        if (it.id) idMap[it.id] = info.lastInsertRowid;
      }
    }
  })();
  res.json({ ok: true });
});
app.put('/api/assuntos/:id', requireAuth, (req, res) => {
  const { nome, disciplina_id, codigo='', parent_id } = req.body;
  if (nome !== undefined) {
    db.prepare('UPDATE assuntos SET nome=?,codigo=?,parent_id=? WHERE id=?').run(nome, codigo, parent_id||null, req.params.id);
  }
  if (disciplina_id !== undefined) {
    db.prepare('UPDATE assuntos SET disciplina_id=? WHERE id=?').run(disciplina_id, req.params.id);
  }
  res.json({ ok: true });
});
app.delete('/api/assuntos/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM assuntos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── CONCURSOS ─────────────────────────────────────────────────────────────────
app.get('/api/concursos', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM concursos WHERE user_id=? ORDER BY nome').all(req.user.id));
});
app.get('/api/concursos/:id', requireAuth, (req, res) => {
  const concurso = db.prepare('SELECT * FROM concursos WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!concurso) return res.status(404).json({ error: 'Não encontrado' });
  const disciplinas = db.prepare('SELECT cd.*,d.nome as disciplina_nome FROM concurso_disciplinas cd JOIN disciplinas d ON cd.disciplina_id=d.id WHERE cd.concurso_id=? ORDER BY cd.prova,d.nome').all(req.params.id);
  const assuntos = db.prepare('SELECT ca.assunto_id,a.nome,a.disciplina_id,a.parent_id,a.codigo FROM concurso_assuntos ca JOIN assuntos a ON ca.assunto_id=a.id WHERE ca.concurso_id=?').all(req.params.id);
  res.json({ ...concurso, disciplinas, assuntos });
});
app.post('/api/concursos', requireAuth, (req, res) => {
  const { nome, banca='', data_prova='', disciplinas=[], assuntos=[] } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
  const id = db.transaction(() => {
    const info = db.prepare('INSERT INTO concursos (user_id,nome,banca,data_prova) VALUES (?,?,?,?)').run(req.user.id,nome,banca,data_prova);
    const cid = info.lastInsertRowid;
    for (const d of disciplinas) db.prepare('INSERT OR IGNORE INTO concurso_disciplinas (concurso_id,disciplina_id,num_questoes,peso,prova) VALUES (?,?,?,?,?)').run(cid,d.disciplina_id,d.num_questoes||0,d.peso||1,d.prova||'');
    for (const aid of assuntos) db.prepare('INSERT OR IGNORE INTO concurso_assuntos (concurso_id,assunto_id) VALUES (?,?)').run(cid,aid);
    return cid;
  })();
  res.json({ id });
});
app.put('/api/concursos/:id', requireAuth, (req, res) => {
  const { nome, banca, data_prova, disciplinas=[], assuntos=[] } = req.body;
  db.transaction(() => {
    db.prepare('UPDATE concursos SET nome=?,banca=?,data_prova=? WHERE id=? AND user_id=?').run(nome,banca,data_prova,req.params.id,req.user.id);
    db.prepare('DELETE FROM concurso_disciplinas WHERE concurso_id=?').run(req.params.id);
    db.prepare('DELETE FROM concurso_assuntos WHERE concurso_id=?').run(req.params.id);
    for (const d of disciplinas) db.prepare('INSERT INTO concurso_disciplinas (concurso_id,disciplina_id,num_questoes,peso,prova) VALUES (?,?,?,?,?)').run(req.params.id,d.disciplina_id,d.num_questoes||0,d.peso||1,d.prova||'');
    for (const aid of assuntos) db.prepare('INSERT INTO concurso_assuntos (concurso_id,assunto_id) VALUES (?,?)').run(req.params.id,aid);
  })();
  res.json({ ok: true });
});
app.delete('/api/concursos/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM concursos WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── SESSÕES ───────────────────────────────────────────────────────────────────
app.get('/api/sessoes', requireAuth, (req, res) => {
  const { concurso_id, disciplina_id, banca, data_inicio, data_fim, assunto_id } = req.query;
  let where = ['s.user_id=?'], params = [req.user.id];
  if (concurso_id) { where.push('s.concurso_id=?'); params.push(concurso_id); }
  if (disciplina_id) { where.push('s.disciplina_id=?'); params.push(disciplina_id); }
  if (banca) { where.push('s.banca=?'); params.push(banca); }
  if (data_inicio) { where.push('s.data>=?'); params.push(data_inicio); }
  if (data_fim) { where.push('s.data<=?'); params.push(data_fim); }
  let assuntoJoin = '';
  if (assunto_id) { assuntoJoin = 'JOIN sessao_assuntos sa_f ON sa_f.sessao_id=s.id AND sa_f.assunto_id=?'; params.unshift(assunto_id); where.unshift('s.user_id=?'); params.unshift(req.user.id); where.shift(); }
  const rows = db.prepare(`SELECT s.*,d.nome as disciplina_nome,c.nome as concurso_nome FROM sessoes s LEFT JOIN disciplinas d ON s.disciplina_id=d.id LEFT JOIN concursos c ON s.concurso_id=c.id ${assuntoJoin} WHERE ${where.join(' AND ')} ORDER BY s.data DESC,s.created_at DESC`).all(...params);
  const result = rows.map(s => {
    const assuntos = db.prepare('SELECT a.id,a.nome,a.codigo FROM sessao_assuntos sa JOIN assuntos a ON sa.assunto_id=a.id WHERE sa.sessao_id=?').all(s.id);
    return { ...s, assuntos };
  });
  res.json(result);
});
app.get('/api/sessoes/:id', requireAuth, (req, res) => {
  const s = db.prepare('SELECT s.*,d.nome as disciplina_nome,c.nome as concurso_nome FROM sessoes s LEFT JOIN disciplinas d ON s.disciplina_id=d.id LEFT JOIN concursos c ON s.concurso_id=c.id WHERE s.id=? AND s.user_id=?').get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Não encontrado' });
  const assuntos = db.prepare('SELECT a.id,a.nome,a.codigo FROM sessao_assuntos sa JOIN assuntos a ON sa.assunto_id=a.id WHERE sa.sessao_id=?').all(s.id);
  res.json({ ...s, assuntos });
});
app.post('/api/sessoes', requireAuth, (req, res) => {
  const {
    data, concurso_id, disciplina_id, tipo,
    total_questoes=0, acertos=0, banca='', nota_liquida=null, ranking='',
    controle_emocional=null, gestao_tempo=null, observacoes='', assunto_ids=[],
    questoes_feitas=0, questoes_acertadas=0, tempo_gasto=null, como_foi='',
    planejamento_id=null, ciclo_item_id=null
  } = req.body;
  if (!data || !disciplina_id || !tipo) return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  // Campos novos têm precedência; fallback para campos legados
  const qFeitas = questoes_feitas || total_questoes || 0;
  const qAcertadas = questoes_acertadas || acertos || 0;
  const id = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO sessoes
        (user_id,data,concurso_id,disciplina_id,tipo,
         total_questoes,acertos,banca,nota_liquida,ranking,
         controle_emocional,gestao_tempo,observacoes,
         questoes_feitas,questoes_acertadas,tempo_gasto,como_foi)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      req.user.id, data, concurso_id||null, disciplina_id, tipo,
      qFeitas, qAcertadas, banca, nota_liquida, ranking,
      controle_emocional, gestao_tempo, observacoes,
      qFeitas, qAcertadas, tempo_gasto, como_foi
    );
    const sid = info.lastInsertRowid;
    for (const aid of assunto_ids) {
      try { db.prepare('INSERT INTO sessao_assuntos (sessao_id,assunto_id) VALUES (?,?)').run(sid, aid); } catch(e){}
    }
    // Marca ciclo_item como realizado, se fornecido
    if (ciclo_item_id) {
      db.prepare('UPDATE ciclo_itens SET realizado=1 WHERE id=? AND user_id=?').run(ciclo_item_id, req.user.id);
    }
    // Adiciona banca ao catálogo do usuário se nova
    if (banca && banca.trim()) {
      db.prepare('INSERT OR IGNORE INTO bancas (user_id, nome) VALUES (?, ?)').run(req.user.id, banca.trim());
    }
    return sid;
  })();
  res.json({ id });
});
app.put('/api/sessoes/:id', requireAuth, (req, res) => {
  const {
    data, concurso_id, disciplina_id, tipo,
    total_questoes, acertos, banca, nota_liquida, ranking,
    controle_emocional, gestao_tempo, observacoes, assunto_ids=[],
    questoes_feitas, questoes_acertadas, tempo_gasto, como_foi
  } = req.body;
  const qFeitas = questoes_feitas !== undefined ? questoes_feitas : (total_questoes || 0);
  const qAcertadas = questoes_acertadas !== undefined ? questoes_acertadas : (acertos || 0);
  db.transaction(() => {
    db.prepare(`
      UPDATE sessoes SET
        data=?,concurso_id=?,disciplina_id=?,tipo=?,
        total_questoes=?,acertos=?,banca=?,nota_liquida=?,ranking=?,
        controle_emocional=?,gestao_tempo=?,observacoes=?,
        questoes_feitas=?,questoes_acertadas=?,tempo_gasto=?,como_foi=?
      WHERE id=? AND user_id=?
    `).run(
      data, concurso_id||null, disciplina_id, tipo,
      qFeitas, qAcertadas, banca, nota_liquida, ranking,
      controle_emocional, gestao_tempo, observacoes,
      qFeitas, qAcertadas, tempo_gasto, como_foi,
      req.params.id, req.user.id
    );
    db.prepare('DELETE FROM sessao_assuntos WHERE sessao_id=?').run(req.params.id);
    for (const aid of assunto_ids) {
      try { db.prepare('INSERT INTO sessao_assuntos (sessao_id,assunto_id) VALUES (?,?)').run(req.params.id, aid); } catch(e){}
    }
    if (banca && banca.trim()) {
      db.prepare('INSERT OR IGNORE INTO bancas (user_id, nome) VALUES (?, ?)').run(req.user.id, banca.trim());
    }
  })();
  res.json({ ok: true });
});
app.delete('/api/sessoes/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessoes WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// /api/historico redirecionado para /api/sessoes para não quebrar clientes existentes
app.get('/api/historico', requireAuth, (req, res, next) => {
  req.url = '/api/sessoes' + (Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '');
  next('route');
});

// ── DASHBOARD STATS ───────────────────────────────────────────────────────────
app.get('/api/stats/dashboard', requireAuth, (req, res) => {
  const { concurso_id, banca, data_inicio, data_fim } = req.query;
  let where = ["s.tipo IN ('questoes','simulado')", 's.user_id=?'], params = [req.user.id];
  if (concurso_id) { where.push('s.concurso_id=?'); params.push(concurso_id); }
  if (banca) { where.push('s.banca=?'); params.push(banca); }
  if (data_inicio) { where.push('s.data>=?'); params.push(data_inicio); }
  if (data_fim) { where.push('s.data<=?'); params.push(data_fim); }
  const wc = 'WHERE '+where.join(' AND ');
  const overall = db.prepare(`SELECT COUNT(*) as total_sessoes,SUM(total_questoes) as total_questoes,SUM(acertos) as total_acertos FROM sessoes s ${wc}`).get(...params);
  const disciplinaRows = db.prepare(`SELECT d.id,d.nome,d.meta_acerto,SUM(s.total_questoes) as total_questoes,SUM(s.acertos) as total_acertos FROM disciplinas d LEFT JOIN sessoes s ON s.disciplina_id=d.id AND ${where.join(' AND ')} WHERE d.user_id=? GROUP BY d.id ORDER BY d.nome`).all(...params, req.user.id);
  let concursoDiscs = [];
  if (concurso_id) concursoDiscs = db.prepare('SELECT disciplina_id,num_questoes,peso,prova FROM concurso_disciplinas WHERE concurso_id=?').all(concurso_id);
  const totalPontos = concursoDiscs.reduce((s,d) => s+(d.num_questoes*d.peso),0);
  const disciplinas = disciplinaRows.map(d => {
    const cd = concursoDiscs.find(c => c.disciplina_id===d.id);
    const pontos = cd ? cd.num_questoes*cd.peso : 0;
    const pct_peso = cd&&totalPontos>0 ? ((pontos/totalPontos)*100).toFixed(1) : null;
    const pct_acerto = d.total_questoes>0 ? ((d.total_acertos/d.total_questoes)*100).toFixed(1) : null;
    const pct_avanco = cd&&cd.num_questoes>0 ? Math.min(100,((d.total_questoes/cd.num_questoes)*100)).toFixed(1) : null;
    return { ...d, pct_peso, pct_acerto, pct_avanco, num_questoes_edital: cd?cd.num_questoes:null, prova: cd?cd.prova:null, na_meta: pct_acerto!==null&&parseFloat(pct_acerto)>=d.meta_acerto };
  });
  const pct_acerto_geral = overall.total_questoes>0 ? ((overall.total_acertos/overall.total_questoes)*100).toFixed(1) : null;
  let pct_avanco_edital = null;
  if (concurso_id) { const te=concursoDiscs.reduce((s,d)=>s+d.num_questoes,0); const tf=disciplinas.reduce((s,d)=>s+(d.total_questoes||0),0); if(te>0) pct_avanco_edital=Math.min(100,((tf/te)*100)).toFixed(1); }
  const hoje = getBrasiliaDate(); const ds = hoje.getDay()===0?6:hoje.getDay()-1;
  const isSA = new Date(hoje); isSA.setDate(hoje.getDate()-ds); isSA.setHours(0,0,0,0);
  const isSAnt = new Date(isSA); isSAnt.setDate(isSA.getDate()-7);
  const fsSAnt = new Date(isSA); fsSAnt.setDate(isSA.getDate()-1);
  const isMesA = new Date(hoje.getFullYear(),hoje.getMonth(),1);
  const isMesAnt = new Date(hoje.getFullYear(),hoje.getMonth()-1,1);
  const fMesAnt = new Date(hoje.getFullYear(),hoje.getMonth(),0);
  const fmt = d=>d.toISOString().slice(0,10);
  const sA = db.prepare("SELECT SUM(total_questoes) as q,SUM(acertos) as a FROM sessoes WHERE user_id=? AND tipo IN ('questoes','simulado') AND data>=?").get(req.user.id,fmt(isSA));
  const sAnt = db.prepare("SELECT SUM(total_questoes) as q,SUM(acertos) as a FROM sessoes WHERE user_id=? AND tipo IN ('questoes','simulado') AND data>=? AND data<=?").get(req.user.id,fmt(isSAnt),fmt(fsSAnt));
  const mA = db.prepare("SELECT SUM(total_questoes) as q,SUM(acertos) as a FROM sessoes WHERE user_id=? AND tipo IN ('questoes','simulado') AND data>=?").get(req.user.id,fmt(isMesA));
  const mAnt = db.prepare("SELECT SUM(total_questoes) as q,SUM(acertos) as a FROM sessoes WHERE user_id=? AND tipo IN ('questoes','simulado') AND data>=? AND data<=?").get(req.user.id,fmt(isMesAnt),fmt(fMesAnt));
  res.json({ total_questoes:overall.total_questoes||0, total_acertos:overall.total_acertos||0, pct_acerto_geral, disciplinas_na_meta:disciplinas.filter(d=>d.na_meta).length, total_disciplinas:disciplinas.length, pct_avanco_edital, disciplinas, semana_atual:{questoes:sA.q||0,acertos:sA.a||0}, semana_anterior:{questoes:sAnt.q||0,acertos:sAnt.a||0}, mes_atual:{questoes:mA.q||0,acertos:mA.a||0}, mes_anterior:{questoes:mAnt.q||0,acertos:mAnt.a||0} });
});

// ── STATS DISCIPLINA ──────────────────────────────────────────────────────────
app.get('/api/stats/disciplina/:id', requireAuth, (req, res) => {
  const { concurso_id, banca, data_inicio, data_fim } = req.query;
  const disc_id = req.params.id;
  let where = ["s.tipo IN ('questoes','simulado')","s.disciplina_id=?","s.user_id=?"], params = [disc_id,req.user.id];
  if (concurso_id) { where.push('s.concurso_id=?'); params.push(concurso_id); }
  if (banca) { where.push('s.banca=?'); params.push(banca); }
  if (data_inicio) { where.push('s.data>=?'); params.push(data_inicio); }
  if (data_fim) { where.push('s.data<=?'); params.push(data_fim); }
  const disc = db.prepare('SELECT * FROM disciplinas WHERE id=? AND user_id=?').get(disc_id,req.user.id);
  if (!disc) return res.status(404).json({ error: 'Não encontrado' });
  const overall = db.prepare(`SELECT SUM(total_questoes) as total_questoes,SUM(acertos) as total_acertos FROM sessoes s WHERE ${where.join(' AND ')}`).get(...params);
  const allAssuntos = db.prepare('SELECT * FROM assuntos WHERE disciplina_id=? ORDER BY codigo,nome').all(disc_id);
  const statsRows = db.prepare(`SELECT sa.assunto_id,SUM(s.total_questoes) as tq,SUM(s.acertos) as ta FROM sessao_assuntos sa JOIN sessoes s ON sa.sessao_id=s.id WHERE ${where.join(' AND ')} GROUP BY sa.assunto_id`).all(...params);
  const assuntoStats = {}; statsRows.forEach(r => { assuntoStats[r.assunto_id]={tq:r.tq,ta:r.ta}; });
  const concursoAssuntos = concurso_id ? db.prepare('SELECT assunto_id FROM concurso_assuntos WHERE concurso_id=?').all(concurso_id).map(r=>r.assunto_id) : [];
  const allConcursoAssuntos = db.prepare('SELECT ca.assunto_id,c.nome as concurso_nome FROM concurso_assuntos ca JOIN concursos c ON ca.concurso_id=c.id WHERE c.user_id=?').all(req.user.id);
  const filhosMap = {}; allAssuntos.forEach(a => { if(a.parent_id){if(!filhosMap[a.parent_id])filhosMap[a.parent_id]=[];filhosMap[a.parent_id].push(a);} });
  const assuntos = allAssuntos.filter(a=>!a.parent_id).map(a => {
    const s=assuntoStats[a.id]||{tq:0,ta:0};
    const pct_acerto=s.tq>0?((s.ta/s.tq)*100).toFixed(1):null;
    const no_edital=concursoAssuntos.length===0||concursoAssuntos.includes(a.id);
    const tags=allConcursoAssuntos.filter(ca=>ca.assunto_id===a.id).map(ca=>ca.concurso_nome);
    const filhos=(filhosMap[a.id]||[]).map(f=>{const sf=assuntoStats[f.id]||{tq:0,ta:0};const pf=sf.tq>0?((sf.ta/sf.tq)*100).toFixed(1):null;return{...f,total_questoes:sf.tq,total_acertos:sf.ta,pct_acerto:pf,na_meta:pf!==null&&parseFloat(pf)>=disc.meta_acerto};});
    return {...a,total_questoes:s.tq,total_acertos:s.ta,pct_acerto,no_edital,na_meta:pct_acerto!==null&&parseFloat(pct_acerto)>=disc.meta_acerto,tags,filhos};
  });
  const pct_acerto=overall.total_questoes>0?((overall.total_acertos/overall.total_questoes)*100).toFixed(1):null;
  let cdInfo=null; if(concurso_id) cdInfo=db.prepare('SELECT * FROM concurso_disciplinas WHERE concurso_id=? AND disciplina_id=?').get(concurso_id,disc_id);
  const pct_avanco=cdInfo&&cdInfo.num_questoes>0?Math.min(100,((overall.total_questoes/cdInfo.num_questoes)*100)).toFixed(1):null;
  const sessoes=db.prepare('SELECT s.*,c.nome as concurso_nome FROM sessoes s LEFT JOIN concursos c ON s.concurso_id=c.id WHERE s.disciplina_id=? AND s.user_id=? ORDER BY s.data DESC,s.created_at DESC').all(disc_id,req.user.id).map(s=>{const assuntos=db.prepare('SELECT a.id,a.nome,a.codigo FROM sessao_assuntos sa JOIN assuntos a ON sa.assunto_id=a.id WHERE sa.sessao_id=?').all(s.id);return{...s,assuntos};});
  res.json({disciplina:disc,total_questoes:overall.total_questoes||0,total_acertos:overall.total_acertos||0,pct_acerto,pct_avanco,num_questoes_edital:cdInfo?cdInfo.num_questoes:null,assuntos_na_meta:assuntos.filter(a=>a.na_meta).length,assuntos,sessoes});
});

// ── STATS SEMANA ──────────────────────────────────────────────────────────────
app.get('/api/stats/semana', requireAuth, (req, res) => {
  const semana = getMondayBrasilia();
  const fmt=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${dd}`;};
  const isSA = new Date(semana + 'T00:00:00');
  const cicloItens=db.prepare('SELECT * FROM ciclo_itens WHERE user_id=? AND semana_inicio=?').all(req.user.id,semana);
  const sess=db.prepare("SELECT SUM(total_questoes) as q,SUM(acertos) as a FROM sessoes WHERE user_id=? AND tipo IN ('questoes','simulado') AND data>=?").get(req.user.id,semana);
  const fimSemDate = new Date(isSA.getTime()+6*86400000); const fimSem=`${fimSemDate.getFullYear()}-${String(fimSemDate.getMonth()+1).padStart(2,'0')}-${String(fimSemDate.getDate()).padStart(2,'0')}`;
  const planT=db.prepare('SELECT COUNT(*) as total,SUM(concluida) as feitas FROM plan_tarefas pt JOIN plan_disciplinas pd ON pt.plan_disciplina_id=pd.id JOIN planejamentos p ON pd.planejamento_id=p.id WHERE p.user_id=? AND pt.data_execucao>=? AND pt.data_execucao<=?').get(req.user.id,semana,fimSem);
  res.json({tarefas_ciclo:cicloItens.length,tarefas_ciclo_feitas:cicloItens.filter(i=>i.realizado).length,tarefas_plan:planT.total||0,tarefas_plan_feitas:planT.feitas||0,questoes_feitas:sess.q||0,acertos:sess.a||0,pct_desempenho:sess.q>0?((sess.a/sess.q)*100).toFixed(1):null});
});

// ── CICLO ─────────────────────────────────────────────────────────────────────
app.get('/api/ciclo', requireAuth, (req, res) => {
  const { semana } = req.query;
  if (!semana) return res.status(400).json({ error: 'Semana obrigatória' });
  const config = db.prepare('SELECT cc.*,d.nome as disciplina_nome FROM ciclo_config cc JOIN disciplinas d ON cc.disciplina_id=d.id WHERE cc.user_id=? AND cc.semana_inicio=?').all(req.user.id,semana);
  const itens = db.prepare('SELECT ci.*,d.nome as disciplina_nome FROM ciclo_itens ci JOIN disciplinas d ON ci.disciplina_id=d.id WHERE ci.user_id=? AND ci.semana_inicio=? ORDER BY ci.dia_semana,ci.ordem').all(req.user.id,semana).map(item=>{
    let assuntos=[];
    if(item.assunto_ids){const ids=item.assunto_ids.split(',').filter(Boolean).map(Number);if(ids.length>0)assuntos=db.prepare(`SELECT id,nome,codigo FROM assuntos WHERE id IN (${ids.map(()=>'?').join(',')})`).all(...ids);}
    return{...item,assuntos};
  });
  res.json({config,itens});
});
app.get('/api/ciclo/semanas', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT DISTINCT semana_inicio FROM ciclo_itens WHERE user_id=? ORDER BY semana_inicio DESC').all(req.user.id).map(r=>r.semana_inicio));
});
app.post('/api/ciclo/gerar', requireAuth, (req, res) => {
  const { semana, sessoes, config={} } = req.body;
  if (!semana || !sessoes) return res.status(400).json({ error: 'Dados obrigatórios' });
  db.transaction(() => {
    db.prepare('DELETE FROM ciclo_config WHERE user_id=? AND semana_inicio=?').run(req.user.id, semana);
    db.prepare('DELETE FROM ciclo_itens WHERE user_id=? AND semana_inicio=?').run(req.user.id, semana);
    // Salva configuração global do ciclo
    if (config.horas_semana !== undefined) {
      db.prepare(`
        INSERT INTO ciclo_config (user_id,disciplina_id,sessoes_por_semana,semana_inicio,horas_semana,dias_estudo,inicio_semana,duracao_ciclo)
        VALUES (?,0,0,?,?,?,?,?)
        ON CONFLICT DO NOTHING
      `).run(req.user.id, semana, config.horas_semana||null,
             JSON.stringify(config.dias_estudo||[]),
             config.inicio_semana||'segunda',
             config.duracao_ciclo||7);
    }
    const configMap = {};
    for (const s of sessoes) { if (!configMap[s.disciplina_id]) configMap[s.disciplina_id] = 0; configMap[s.disciplina_id]++; }
    for (const [did, count] of Object.entries(configMap)) {
      db.prepare('INSERT INTO ciclo_config (user_id,disciplina_id,sessoes_por_semana,semana_inicio) VALUES (?,?,?,?)').run(req.user.id, did, count, semana);
    }
    sessoes.forEach((s, idx) => {
      const aids = Array.isArray(s.assunto_ids) ? s.assunto_ids.join(',') : (s.assunto_ids || '');
      db.prepare(`
        INSERT INTO ciclo_itens
          (user_id,semana_inicio,ordem,dia_semana,disciplina_id,assunto_ids,tipo,tempo_estimado,descricao,
           quantidade_questoes,link_caderno,comando,hiperdica,numero,plan_tarefa_id,realizado,adiado)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0)
      `).run(
        req.user.id, semana, idx+1, s.dia_semana??null, s.disciplina_id, aids,
        s.tipo||'', s.tempo_estimado||60, s.descricao||'',
        s.quantidade_questoes||0, s.link_caderno||'', s.comando||'', s.hiperdica||'',
        s.numero||idx+1, s.plan_tarefa_id||null
      );
    });
  })();
  res.json({ ok: true });
});
app.post('/api/ciclo/duplicar', requireAuth, (req, res) => {
  const { semana_origem, semana_destino } = req.body;
  db.transaction(() => {
    db.prepare('DELETE FROM ciclo_config WHERE user_id=? AND semana_inicio=?').run(req.user.id,semana_destino);
    db.prepare('DELETE FROM ciclo_itens WHERE user_id=? AND semana_inicio=?').run(req.user.id,semana_destino);
    const configs=db.prepare('SELECT * FROM ciclo_config WHERE user_id=? AND semana_inicio=?').all(req.user.id,semana_origem);
    for(const c of configs)db.prepare('INSERT INTO ciclo_config (user_id,disciplina_id,sessoes_por_semana,semana_inicio) VALUES (?,?,?,?)').run(req.user.id,c.disciplina_id,c.sessoes_por_semana,semana_destino);
    const itens = db.prepare('SELECT * FROM ciclo_itens WHERE user_id=? AND semana_inicio=?').all(req.user.id, semana_origem);
    for (const i of itens) {
      db.prepare(`
        INSERT INTO ciclo_itens
          (user_id,semana_inicio,ordem,dia_semana,disciplina_id,assunto_ids,tipo,tempo_estimado,descricao,
           quantidade_questoes,link_caderno,comando,hiperdica,numero,plan_tarefa_id,realizado,adiado)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0)
      `).run(
        req.user.id, semana_destino, i.ordem, i.dia_semana, i.disciplina_id, i.assunto_ids,
        i.tipo, i.tempo_estimado, i.descricao,
        i.quantidade_questoes||0, i.link_caderno||'', i.comando||'', i.hiperdica||'',
        i.numero||i.ordem, i.plan_tarefa_id||null
      );
    }
  })();
  res.json({ok:true});
});
app.put('/api/ciclo/item/:id', requireAuth, (req, res) => {
  const {
    realizado, adiado, ordem, dia_semana, assunto_ids, tipo, tempo_estimado, descricao,
    quantidade_questoes, link_caderno, comando, hiperdica, numero
  } = req.body;
  if (realizado !== undefined) db.prepare('UPDATE ciclo_itens SET realizado=? WHERE id=? AND user_id=?').run(realizado?1:0, req.params.id, req.user.id);
  if (adiado !== undefined) db.prepare('UPDATE ciclo_itens SET adiado=? WHERE id=? AND user_id=?').run(adiado?1:0, req.params.id, req.user.id);
  if (ordem !== undefined) db.prepare('UPDATE ciclo_itens SET ordem=? WHERE id=? AND user_id=?').run(ordem, req.params.id, req.user.id);
  if (dia_semana !== undefined) db.prepare('UPDATE ciclo_itens SET dia_semana=? WHERE id=? AND user_id=?').run(dia_semana, req.params.id, req.user.id);
  if (assunto_ids !== undefined) db.prepare('UPDATE ciclo_itens SET assunto_ids=? WHERE id=? AND user_id=?').run(Array.isArray(assunto_ids)?assunto_ids.join(','):assunto_ids, req.params.id, req.user.id);
  if (tipo !== undefined) db.prepare('UPDATE ciclo_itens SET tipo=? WHERE id=? AND user_id=?').run(tipo, req.params.id, req.user.id);
  if (tempo_estimado !== undefined) db.prepare('UPDATE ciclo_itens SET tempo_estimado=? WHERE id=? AND user_id=?').run(tempo_estimado, req.params.id, req.user.id);
  if (descricao !== undefined) db.prepare('UPDATE ciclo_itens SET descricao=? WHERE id=? AND user_id=?').run(descricao, req.params.id, req.user.id);
  if (quantidade_questoes !== undefined) db.prepare('UPDATE ciclo_itens SET quantidade_questoes=? WHERE id=? AND user_id=?').run(quantidade_questoes, req.params.id, req.user.id);
  if (link_caderno !== undefined) db.prepare('UPDATE ciclo_itens SET link_caderno=? WHERE id=? AND user_id=?').run(link_caderno, req.params.id, req.user.id);
  if (comando !== undefined) db.prepare('UPDATE ciclo_itens SET comando=? WHERE id=? AND user_id=?').run(comando, req.params.id, req.user.id);
  if (hiperdica !== undefined) db.prepare('UPDATE ciclo_itens SET hiperdica=? WHERE id=? AND user_id=?').run(hiperdica, req.params.id, req.user.id);
  if (numero !== undefined) db.prepare('UPDATE ciclo_itens SET numero=? WHERE id=? AND user_id=?').run(numero, req.params.id, req.user.id);
  res.json({ ok: true });
});
app.delete('/api/ciclo/item/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM ciclo_itens WHERE id=? AND user_id=?').run(req.params.id,req.user.id);
  res.json({ok:true});
});
app.put('/api/ciclo/reordenar', requireAuth, (req, res) => {
  const { itens } = req.body;
  const upd = db.prepare('UPDATE ciclo_itens SET ordem=?,dia_semana=? WHERE id=? AND user_id=?');
  db.transaction(() => { for (const i of itens) upd.run(i.ordem, i.dia_semana??null, i.id, req.user.id); })();
  res.json({ ok: true });
});

// ── VIRADAS DE CICLO ──────────────────────────────────────────────────────────
app.get('/api/ciclo/viradas', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM ciclo_viradas WHERE user_id=? ORDER BY data_virada DESC').all(req.user.id));
});
app.post('/api/ciclo/virada', requireAuth, (req, res) => {
  const { data_virada, tarefas_concluidas=0, tarefas_nao_concluidas=0 } = req.body;
  if (!data_virada) return res.status(400).json({ error: 'data_virada obrigatória' });
  const info = db.prepare('INSERT INTO ciclo_viradas (user_id,data_virada,tarefas_concluidas,tarefas_nao_concluidas) VALUES (?,?,?,?)').run(req.user.id, data_virada, tarefas_concluidas, tarefas_nao_concluidas);
  res.json({ id: info.lastInsertRowid });
});

// ── CICLO CONFIG GLOBAL ───────────────────────────────────────────────────────
app.get('/api/ciclo/config-global', requireAuth, (req, res) => {
  // Busca a config global (disciplina_id=0) da semana mais recente
  const cfg = db.prepare("SELECT * FROM ciclo_config WHERE user_id=? AND disciplina_id=0 ORDER BY semana_inicio DESC LIMIT 1").get(req.user.id);
  res.json(cfg || {});
});
app.put('/api/ciclo/config-global', requireAuth, (req, res) => {
  const { horas_semana, dias_estudo, inicio_semana, duracao_ciclo } = req.body;
  const semana = getMondayBrasilia();
  // Upsert: remove a config global existente desta semana e reinsere
  db.prepare("DELETE FROM ciclo_config WHERE user_id=? AND disciplina_id=0 AND semana_inicio=?").run(req.user.id, semana);
  db.prepare("INSERT INTO ciclo_config (user_id,disciplina_id,sessoes_por_semana,semana_inicio,horas_semana,dias_estudo,inicio_semana,duracao_ciclo) VALUES (?,0,0,?,?,?,?,?)").run(
    req.user.id, semana, horas_semana||null, JSON.stringify(dias_estudo||[]), inicio_semana||'segunda', duracao_ciclo||7
  );
  res.json({ ok: true });
});

// ── PLANEJAMENTOS ─────────────────────────────────────────────────────────────
app.get('/api/planejamentos', requireAuth, (req, res) => {
  const rows=db.prepare('SELECT p.*,c.nome as concurso_nome FROM planejamentos p LEFT JOIN concursos c ON p.concurso_id=c.id WHERE p.user_id=? ORDER BY p.created_at DESC').all(req.user.id);
  res.json(rows.map(p=>{
    const discs=db.prepare('SELECT COUNT(*) as total FROM plan_disciplinas WHERE planejamento_id=?').get(p.id);
    const tarefas=db.prepare('SELECT COUNT(*) as total,SUM(concluida) as feitas FROM plan_tarefas pt JOIN plan_disciplinas pd ON pt.plan_disciplina_id=pd.id WHERE pd.planejamento_id=?').get(p.id);
    return{...p,total_disciplinas:discs.total,total_tarefas:tarefas.total||0,tarefas_feitas:tarefas.feitas||0};
  }));
});
app.get('/api/planejamentos/:id', requireAuth, (req, res) => {
  const p=db.prepare('SELECT p.*,c.nome as concurso_nome FROM planejamentos p LEFT JOIN concursos c ON p.concurso_id=c.id WHERE p.id=? AND p.user_id=?').get(req.params.id,req.user.id);
  if(!p) return res.status(404).json({error:'Não encontrado'});
  const disciplinas=db.prepare('SELECT pd.*,d.nome as disciplina_nome FROM plan_disciplinas pd JOIN disciplinas d ON pd.disciplina_id=d.id WHERE pd.planejamento_id=? ORDER BY pd.prova,d.nome').all(req.params.id).map(d=>{
    const assuntos=db.prepare('SELECT pa.assunto_id,a.nome,a.codigo,a.parent_id FROM plan_assuntos pa JOIN assuntos a ON pa.assunto_id=a.id WHERE pa.plan_disciplina_id=? ORDER BY a.codigo,a.nome').all(d.id);
    const tarefas = db.prepare('SELECT * FROM plan_tarefas WHERE plan_disciplina_id=? ORDER BY numero,ordem,created_at').all(d.id).map(t => {
      const tIds = t.assunto_ids ? t.assunto_ids.split(',').filter(Boolean).map(Number) : [];
      const tAssuntos = tIds.length > 0
        ? db.prepare(`SELECT id,nome,codigo,parent_id,ordem FROM assuntos WHERE id IN (${tIds.map(()=>'?').join(',')}) ORDER BY ordem,codigo`).all(...tIds)
        : [];
      return { ...t, assuntos: tAssuntos };
    });
    return { ...d, assuntos, tarefas };
  });
  res.json({...p,disciplinas});
});
app.post('/api/planejamentos', requireAuth, (req, res) => {
  const { nome, data_prova='' } = req.body;
  if(!nome) return res.status(400).json({error:'Nome obrigatório'});
  // Cria concurso automaticamente com o mesmo nome do planejamento
  const id = db.transaction(() => {
    const concursoInfo = db.prepare('INSERT INTO concursos (user_id,nome,banca,data_prova) VALUES (?,?,?,?)').run(req.user.id, nome, '', data_prova);
    const concurso_id = concursoInfo.lastInsertRowid;
    const planInfo = db.prepare('INSERT INTO planejamentos (user_id,nome,concurso_id,data_prova) VALUES (?,?,?,?)').run(req.user.id, nome, concurso_id, data_prova);
    return { plan_id: planInfo.lastInsertRowid, concurso_id };
  })();
  res.json({ id: id.plan_id, concurso_id: id.concurso_id });
});
app.put('/api/planejamentos/:id', requireAuth, (req, res) => {
  const { nome, concurso_id, data_prova='' } = req.body;
  db.transaction(() => {
    db.prepare('UPDATE planejamentos SET nome=?,data_prova=? WHERE id=? AND user_id=?').run(nome, data_prova, req.params.id, req.user.id);
    // Atualiza concurso vinculado se existir
    if (concurso_id) {
      db.prepare('UPDATE concursos SET nome=?,data_prova=? WHERE id=? AND user_id=?').run(nome, data_prova, concurso_id, req.user.id);
    } else {
      // Tenta achar concurso pelo plano
      const plan = db.prepare('SELECT concurso_id FROM planejamentos WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
      if (plan && plan.concurso_id) {
        db.prepare('UPDATE concursos SET nome=?,data_prova=? WHERE id=? AND user_id=?').run(nome, data_prova, plan.concurso_id, req.user.id);
      }
    }
  })();
  res.json({ok:true});
});
app.delete('/api/planejamentos/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM planejamentos WHERE id=? AND user_id=?').run(req.params.id,req.user.id);
  res.json({ok:true});
});
app.post('/api/planejamentos/:id/disciplinas', requireAuth, (req, res) => {
  const { disciplinas } = req.body;
  const plan = db.prepare('SELECT concurso_id FROM planejamentos WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  db.transaction(() => {
    for(const d of disciplinas) {
      db.prepare('INSERT OR REPLACE INTO plan_disciplinas (planejamento_id,disciplina_id,prova,peso,num_questoes) VALUES (?,?,?,?,?)').run(req.params.id, d.disciplina_id, d.prova||'', d.peso||1, d.num_questoes||0);
      // Sincroniza com concurso_disciplinas para o dashboard funcionar
      if (plan && plan.concurso_id) {
        db.prepare('INSERT OR REPLACE INTO concurso_disciplinas (concurso_id,disciplina_id,num_questoes,peso,prova) VALUES (?,?,?,?,?)').run(plan.concurso_id, d.disciplina_id, d.num_questoes||0, d.peso||1, d.prova||'');
      }
    }
  })();
  res.json({ok:true});
});
app.put('/api/plan-disciplinas/:id', requireAuth, (req, res) => {
  const { prova, peso, num_questoes, meta_questoes=null, meta_pct=null, banca='' } = req.body;
  db.prepare('UPDATE plan_disciplinas SET prova=?,peso=?,num_questoes=?,meta_questoes=?,meta_pct=?,banca=? WHERE id=?').run(prova||'',peso||1,num_questoes||0,meta_questoes,meta_pct,banca,req.params.id);
  res.json({ok:true});
});
app.delete('/api/plan-disciplinas/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM plan_disciplinas WHERE id=?').run(req.params.id);
  res.json({ok:true});
});
app.post('/api/plan-disciplinas/:id/assuntos', requireAuth, (req, res) => {
  const { assunto_ids } = req.body;
  db.transaction(()=>{db.prepare('DELETE FROM plan_assuntos WHERE plan_disciplina_id=?').run(req.params.id);for(const aid of assunto_ids){try{db.prepare('INSERT INTO plan_assuntos (plan_disciplina_id,assunto_id) VALUES (?,?)').run(req.params.id,aid);}catch(e){}}})();
  res.json({ok:true});
});
app.post('/api/plan-disciplinas/:id/tarefas', requireAuth, (req, res) => {
  const {
    assunto_ids=[], fonte='', link_caderno='', o_que_fazer='', data_execucao='', tipo='',
    tempo_estimado=60, quantidade_questoes=0, comando='', hiperdica='', observacao=''
  } = req.body;
  const maxOrdem = db.prepare('SELECT MAX(ordem) as m FROM plan_tarefas WHERE plan_disciplina_id=?').get(req.params.id);
  const ordem = (maxOrdem.m || 0) + 1;
  const maxNum = db.prepare('SELECT MAX(numero) as m FROM plan_tarefas WHERE plan_disciplina_id=?').get(req.params.id);
  const numero = (maxNum.m || 0) + 1;
  const info = db.prepare(`
    INSERT INTO plan_tarefas
      (plan_disciplina_id,assunto_ids,fonte,link_caderno,o_que_fazer,data_execucao,ordem,tipo,
       tempo_estimado,quantidade_questoes,comando,hiperdica,numero,observacao)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(req.params.id, assunto_ids.join(','), fonte, link_caderno, o_que_fazer||comando, data_execucao, ordem, tipo,
         tempo_estimado, quantidade_questoes, comando, hiperdica, numero, observacao);
  res.json({ id: info.lastInsertRowid, numero });
});
app.put('/api/plan-tarefas/reordenar', requireAuth, (req, res) => {
  const { itens } = req.body; // [{id, ordem}]
  const upd = db.prepare('UPDATE plan_tarefas SET ordem=? WHERE id=?');
  db.transaction(() => { for (const i of itens) upd.run(i.ordem, i.id); })();
  res.json({ ok: true });
});
app.put('/api/plan-tarefas/:id', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM plan_tarefas WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Não encontrado' });
  const {
    assunto_ids, fonte, link_caderno, o_que_fazer, data_execucao, concluida, tipo,
    tempo_estimado, quantidade_questoes, comando, hiperdica, observacao
  } = req.body;
  db.prepare(`
    UPDATE plan_tarefas SET
      assunto_ids=?,fonte=?,link_caderno=?,o_que_fazer=?,data_execucao=?,concluida=?,tipo=?,
      tempo_estimado=?,quantidade_questoes=?,comando=?,hiperdica=?,observacao=?
    WHERE id=?
  `).run(
    assunto_ids !== undefined ? assunto_ids.join(',') : t.assunto_ids,
    fonte !== undefined ? fonte : t.fonte,
    link_caderno !== undefined ? link_caderno : t.link_caderno,
    o_que_fazer !== undefined ? o_que_fazer : t.o_que_fazer,
    data_execucao !== undefined ? data_execucao : t.data_execucao,
    concluida !== undefined ? (concluida ? 1 : 0) : t.concluida,
    tipo !== undefined ? tipo : (t.tipo || ''),
    tempo_estimado !== undefined ? tempo_estimado : (t.tempo_estimado || 60),
    quantidade_questoes !== undefined ? quantidade_questoes : (t.quantidade_questoes || 0),
    comando !== undefined ? comando : (t.comando || ''),
    hiperdica !== undefined ? hiperdica : (t.hiperdica || ''),
    observacao !== undefined ? observacao : (t.observacao || ''),
    req.params.id
  );
  res.json({ ok: true });
});
app.delete('/api/plan-tarefas/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM plan_tarefas WHERE id=?').run(req.params.id);
  res.json({ok:true});
});

// ── CONFIGURAÇÕES ─────────────────────────────────────────────────────────────
app.get('/api/usuario/perfil', requireAuth, (req, res) => {
  res.json({ id:req.user.id, nome:req.user.nome, email:req.user.email, foto:req.user.foto });
});
app.post('/api/usuario/zerar-dados', requireAuth, (req, res) => {
  const uid = req.user.id;
  db.transaction(() => {
    db.prepare('DELETE FROM plan_tarefas WHERE plan_disciplina_id IN (SELECT pd.id FROM plan_disciplinas pd JOIN planejamentos p ON pd.planejamento_id=p.id WHERE p.user_id=?)').run(uid);
    db.prepare('DELETE FROM plan_assuntos WHERE plan_disciplina_id IN (SELECT pd.id FROM plan_disciplinas pd JOIN planejamentos p ON pd.planejamento_id=p.id WHERE p.user_id=?)').run(uid);
    db.prepare('DELETE FROM plan_disciplinas WHERE planejamento_id IN (SELECT id FROM planejamentos WHERE user_id=?)').run(uid);
    db.prepare('DELETE FROM planejamentos WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM ciclo_itens WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM ciclo_config WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM sessao_assuntos WHERE sessao_id IN (SELECT id FROM sessoes WHERE user_id=?)').run(uid);
    db.prepare('DELETE FROM sessoes WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM concurso_assuntos WHERE concurso_id IN (SELECT id FROM concursos WHERE user_id=?)').run(uid);
    db.prepare('DELETE FROM concurso_disciplinas WHERE concurso_id IN (SELECT id FROM concursos WHERE user_id=?)').run(uid);
    db.prepare('DELETE FROM concursos WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM assuntos WHERE disciplina_id IN (SELECT id FROM disciplinas WHERE user_id=?)').run(uid);
    db.prepare('DELETE FROM disciplinas WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM app_config WHERE user_id=?').run(uid);
  })();
  res.json({ ok: true });
});
app.delete('/api/usuario/conta', requireAuth, (req, res) => {
  db.prepare('DELETE FROM usuarios WHERE id=?').run(req.user.id);
  req.logout(() => res.json({ ok: true }));
});

app.post('/api/usuario/zerar-historico', requireAuth, (req, res) => {
  const uid = req.user.id;
  db.transaction(() => {
    db.prepare('DELETE FROM sessao_assuntos WHERE sessao_id IN (SELECT id FROM sessoes WHERE user_id=?)').run(uid);
    db.prepare('DELETE FROM sessoes WHERE user_id=?').run(uid);
  })();
  res.json({ ok: true });
});

app.post('/api/usuario/zerar-disciplinas', requireAuth, (req, res) => {
  const uid = req.user.id;
  db.transaction(() => {
    // Remove vínculos de disciplinas nos planejamentos e concursos, mas mantém planejamentos
    db.prepare('DELETE FROM plan_tarefas WHERE plan_disciplina_id IN (SELECT pd.id FROM plan_disciplinas pd JOIN planejamentos p ON pd.planejamento_id=p.id WHERE p.user_id=?)').run(uid);
    db.prepare('DELETE FROM plan_assuntos WHERE plan_disciplina_id IN (SELECT pd.id FROM plan_disciplinas pd JOIN planejamentos p ON pd.planejamento_id=p.id WHERE p.user_id=?)').run(uid);
    db.prepare('DELETE FROM plan_disciplinas WHERE planejamento_id IN (SELECT id FROM planejamentos WHERE user_id=?)').run(uid);
    db.prepare('DELETE FROM concurso_assuntos WHERE concurso_id IN (SELECT id FROM concursos WHERE user_id=?)').run(uid);
    db.prepare('DELETE FROM concurso_disciplinas WHERE concurso_id IN (SELECT id FROM concursos WHERE user_id=?)').run(uid);
    // Apaga assuntos e disciplinas
    db.prepare('DELETE FROM assuntos WHERE disciplina_id IN (SELECT id FROM disciplinas WHERE user_id=?)').run(uid);
    db.prepare('DELETE FROM disciplinas WHERE user_id=?').run(uid);
  })();
  res.json({ ok: true });
});

app.post('/api/usuario/zerar-tarefas', requireAuth, (req, res) => {
  const uid = req.user.id;
  db.transaction(() => {
    db.prepare('DELETE FROM plan_tarefas WHERE plan_disciplina_id IN (SELECT pd.id FROM plan_disciplinas pd JOIN planejamentos p ON pd.planejamento_id=p.id WHERE p.user_id=?)').run(uid);
  })();
  res.json({ ok: true });
});


// ── DASHBOARD STATS POR PLANEJAMENTO ─────────────────────────────────────────
// Igual ao dashboard normal mas filtra por disciplinas do planejamento
app.get('/api/stats/dashboard-plan', requireAuth, (req, res) => {
  const { plan_id, banca, data_inicio, data_fim } = req.query;
  const uid = req.user.id;

  // Busca disciplinas do planejamento
  let planDiscs = [];
  if (plan_id) {
    planDiscs = db.prepare('SELECT pd.*, d.nome as disciplina_nome FROM plan_disciplinas pd JOIN disciplinas d ON pd.disciplina_id=d.id WHERE pd.planejamento_id=?').all(plan_id);
  }

  let where = ["s.tipo IN ('questoes','simulado')", 's.user_id=?'];
  let params = [uid];
  if (banca) { where.push('s.banca=?'); params.push(banca); }
  if (data_inicio) { where.push('s.data>=?'); params.push(data_inicio); }
  if (data_fim) { where.push('s.data<=?'); params.push(data_fim); }
  const wc = 'WHERE ' + where.join(' AND ');

  const overall = db.prepare(`SELECT SUM(total_questoes) as total_questoes, SUM(acertos) as total_acertos FROM sessoes s ${wc}`).get(...params);

  // Stats por disciplina (todas do usuário ou só do planejamento)
  const discIds = planDiscs.map(d => d.disciplina_id);
  let disciplinaRows;
  if (discIds.length > 0) {
    disciplinaRows = db.prepare(`SELECT d.id, d.nome, d.meta_acerto, SUM(s.total_questoes) as total_questoes, SUM(s.acertos) as total_acertos FROM disciplinas d LEFT JOIN sessoes s ON s.disciplina_id=d.id AND ${where.join(' AND ')} WHERE d.user_id=? AND d.id IN (${discIds.map(()=>'?').join(',')}) GROUP BY d.id ORDER BY d.nome`).all(...params, uid, ...discIds);
  } else {
    disciplinaRows = db.prepare(`SELECT d.id, d.nome, d.meta_acerto, SUM(s.total_questoes) as total_questoes, SUM(s.acertos) as total_acertos FROM disciplinas d LEFT JOIN sessoes s ON s.disciplina_id=d.id AND ${where.join(' AND ')} WHERE d.user_id=? GROUP BY d.id ORDER BY d.nome`).all(...params, uid);
  }

  const totalPontos = planDiscs.reduce((s,d) => s+((d.num_questoes||0)*(d.peso||1)), 0);
  const disciplinas = disciplinaRows.map(d => {
    const pd = planDiscs.find(p => p.disciplina_id===d.id);
    const pontos = pd ? (pd.num_questoes||0)*(pd.peso||1) : 0;
    const pct_peso = pd && totalPontos>0 ? ((pontos/totalPontos)*100).toFixed(1) : null;
    const pct_acerto = d.total_questoes>0 ? ((d.total_acertos/d.total_questoes)*100).toFixed(1) : null;
    const pct_avanco = pd && pd.num_questoes>0 ? Math.min(100,((d.total_questoes/pd.num_questoes)*100)).toFixed(1) : null;
    return { ...d, pct_peso, pct_acerto, pct_avanco, num_questoes_edital: pd?pd.num_questoes:null, prova: pd?pd.prova:null, na_meta: pct_acerto!==null && parseFloat(pct_acerto)>=d.meta_acerto };
  });

  const pct_acerto_geral = overall.total_questoes>0 ? ((overall.total_acertos/overall.total_questoes)*100).toFixed(1) : null;
  let pct_avanco_edital = null;
  if (planDiscs.length>0) {
    const te = planDiscs.reduce((s,d)=>s+(d.num_questoes||0),0);
    const tf = disciplinas.reduce((s,d)=>s+(d.total_questoes||0),0);
    if (te>0) pct_avanco_edital = Math.min(100,((tf/te)*100)).toFixed(1);
  }

  // Semana atual (fuso Brasília)
  const hoje = getBrasiliaDate(); const ds=hoje.getUTCDay()===0?6:hoje.getUTCDay()-1;
  const isSA=new Date(hoje); isSA.setUTCDate(hoje.getUTCDate()-ds); isSA.setUTCHours(0,0,0,0);
  const fmt=d=>d.toISOString().slice(0,10);
  const sA=db.prepare("SELECT SUM(total_questoes) as q,SUM(acertos) as a FROM sessoes WHERE user_id=? AND tipo IN ('questoes','simulado') AND data>=?").get(uid,fmt(isSA));

  res.json({ total_questoes:overall.total_questoes||0, total_acertos:overall.total_acertos||0, pct_acerto_geral, disciplinas_na_meta:disciplinas.filter(d=>d.na_meta).length, total_disciplinas:disciplinas.length, pct_avanco_edital, disciplinas, semana_atual:{questoes:sA.q||0,acertos:sA.a||0} });
});

// ── ATIVIDADE: SEQUÊNCIA E ÚLTIMOS 30 DIAS ────────────────────────────────────
app.get('/api/stats/atividade', requireAuth, (req, res) => {
  const uid = req.user.id;
  const hoje = getBrasiliaISO();

  // Últimos 30 dias com contagem de questões por dia
  const rows = db.prepare(`
    SELECT data, SUM(COALESCE(questoes_feitas, total_questoes, 0)) as questoes,
           COUNT(*) as sessoes
    FROM sessoes WHERE user_id=? AND data >= date(?, '-30 days')
    GROUP BY data ORDER BY data ASC
  `).all(uid, hoje);

  // Sequência atual (streak): dias consecutivos com sessão até hoje
  const diasComSessao = new Set(
    db.prepare('SELECT DISTINCT data FROM sessoes WHERE user_id=? ORDER BY data DESC').all(uid).map(r => r.data)
  );
  let streak = 0;
  const cur = new Date(hoje + 'T00:00:00');
  while (true) {
    const iso = cur.toISOString().slice(0, 10);
    if (diasComSessao.has(iso)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }

  res.json({ dias: rows, streak });
});

// Stats disciplina por planejamento
app.get('/api/stats/disciplina-plan/:id', requireAuth, (req, res) => {
  const disc_id = req.params.id;
  const { plan_id, banca, data_inicio, data_fim } = req.query;
  const uid = req.user.id;

  let where = ["s.tipo IN ('questoes','simulado')", 's.disciplina_id=?', 's.user_id=?'];
  let params = [disc_id, uid];
  if (banca) { where.push('s.banca=?'); params.push(banca); }
  if (data_inicio) { where.push('s.data>=?'); params.push(data_inicio); }
  if (data_fim) { where.push('s.data<=?'); params.push(data_fim); }

  const disc = db.prepare('SELECT * FROM disciplinas WHERE id=? AND user_id=?').get(disc_id, uid);
  if (!disc) return res.status(404).json({ error: 'Não encontrado' });

  const overall = db.prepare(`SELECT SUM(total_questoes) as total_questoes, SUM(acertos) as total_acertos FROM sessoes s WHERE ${where.join(' AND ')}`).get(...params);
  const allAssuntos = db.prepare('SELECT * FROM assuntos WHERE disciplina_id=? ORDER BY codigo,nome').all(disc_id);

  const statsRows = db.prepare(`SELECT sa.assunto_id, SUM(s.total_questoes) as tq, SUM(s.acertos) as ta FROM sessao_assuntos sa JOIN sessoes s ON sa.sessao_id=s.id WHERE ${where.join(' AND ')} GROUP BY sa.assunto_id`).all(...params);
  const assuntoStats = {}; statsRows.forEach(r => { assuntoStats[r.assunto_id]={tq:r.tq,ta:r.ta}; });

  const filhosMap = {}; allAssuntos.forEach(a => { if(a.parent_id){if(!filhosMap[a.parent_id])filhosMap[a.parent_id]=[];filhosMap[a.parent_id].push(a);} });
  const assuntos = allAssuntos.filter(a=>!a.parent_id).map(a => {
    const s=assuntoStats[a.id]||{tq:0,ta:0};
    const pct=s.tq>0?((s.ta/s.tq)*100).toFixed(1):null;
    const filhos=(filhosMap[a.id]||[]).map(f=>{const sf=assuntoStats[f.id]||{tq:0,ta:0};const pf=sf.tq>0?((sf.ta/sf.tq)*100).toFixed(1):null;return{...f,total_questoes:sf.tq,total_acertos:sf.ta,pct_acerto:pf,na_meta:pf!==null&&parseFloat(pf)>=disc.meta_acerto};});
    return {...a,total_questoes:s.tq,total_acertos:s.ta,pct_acerto:pct,na_meta:pct!==null&&parseFloat(pct)>=disc.meta_acerto,filhos};
  });

  let pdInfo = null;
  if (plan_id) pdInfo = db.prepare('SELECT * FROM plan_disciplinas WHERE planejamento_id=? AND disciplina_id=?').get(plan_id, disc_id);
  const pct_acerto = overall.total_questoes>0?((overall.total_acertos/overall.total_questoes)*100).toFixed(1):null;
  const pct_avanco = pdInfo&&pdInfo.num_questoes>0?Math.min(100,((overall.total_questoes/pdInfo.num_questoes)*100)).toFixed(1):null;

  const sessoes = db.prepare('SELECT s.*, c.nome as concurso_nome FROM sessoes s LEFT JOIN concursos c ON s.concurso_id=c.id WHERE s.disciplina_id=? AND s.user_id=? ORDER BY s.data DESC').all(disc_id, uid).map(s=>{const ass=db.prepare('SELECT a.id,a.nome,a.codigo FROM sessao_assuntos sa JOIN assuntos a ON sa.assunto_id=a.id WHERE sa.sessao_id=?').all(s.id);return{...s,assuntos:ass};});

  res.json({ disciplina:disc, total_questoes:overall.total_questoes||0, total_acertos:overall.total_acertos||0, pct_acerto, pct_avanco, num_questoes_edital:pdInfo?pdInfo.num_questoes:null, assuntos_na_meta:assuntos.filter(a=>a.na_meta).length, assuntos, sessoes });
});

// ── SPA / LOGIN FALLBACK ──────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
