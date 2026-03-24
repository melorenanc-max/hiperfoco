const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.NODE_ENV === 'production' ? '/data' : path.join(__dirname, '..');
const DB_PATH = path.join(DB_DIR, 'concurso.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    foto TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS disciplinas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    nome TEXT NOT NULL,
    meta_acerto INTEGER NOT NULL DEFAULT 75,
    estrategia TEXT DEFAULT '',
    teoria_material TEXT DEFAULT '',
    teoria_link TEXT DEFAULT '',
    resumo_tipo TEXT DEFAULT '',
    resumo_descricao TEXT DEFAULT '',
    resumo_link TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS assuntos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    disciplina_id INTEGER NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    codigo TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES assuntos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS concursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    nome TEXT NOT NULL,
    banca TEXT DEFAULT '',
    data_prova TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS concurso_disciplinas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    concurso_id INTEGER NOT NULL,
    disciplina_id INTEGER NOT NULL,
    num_questoes INTEGER NOT NULL DEFAULT 0,
    peso REAL NOT NULL DEFAULT 1,
    prova TEXT DEFAULT '',
    FOREIGN KEY (concurso_id) REFERENCES concursos(id) ON DELETE CASCADE,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
    UNIQUE(concurso_id, disciplina_id)
  );

  CREATE TABLE IF NOT EXISTS concurso_assuntos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    concurso_id INTEGER NOT NULL,
    assunto_id INTEGER NOT NULL,
    FOREIGN KEY (concurso_id) REFERENCES concursos(id) ON DELETE CASCADE,
    FOREIGN KEY (assunto_id) REFERENCES assuntos(id) ON DELETE CASCADE,
    UNIQUE(concurso_id, assunto_id)
  );

  CREATE TABLE IF NOT EXISTS sessoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    data TEXT NOT NULL,
    concurso_id INTEGER,
    disciplina_id INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('questoes','teorico','simulado','revisao')),
    total_questoes INTEGER DEFAULT 0,
    acertos INTEGER DEFAULT 0,
    banca TEXT DEFAULT '',
    nota_liquida REAL DEFAULT NULL,
    ranking TEXT DEFAULT '',
    controle_emocional INTEGER DEFAULT NULL,
    gestao_tempo INTEGER DEFAULT NULL,
    observacoes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (concurso_id) REFERENCES concursos(id) ON DELETE SET NULL,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessao_assuntos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessao_id INTEGER NOT NULL,
    assunto_id INTEGER NOT NULL,
    FOREIGN KEY (sessao_id) REFERENCES sessoes(id) ON DELETE CASCADE,
    FOREIGN KEY (assunto_id) REFERENCES assuntos(id) ON DELETE CASCADE,
    UNIQUE(sessao_id, assunto_id)
  );

  CREATE TABLE IF NOT EXISTS ciclo_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    disciplina_id INTEGER NOT NULL,
    sessoes_por_semana INTEGER NOT NULL DEFAULT 0,
    semana_inicio TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ciclo_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    semana_inicio TEXT NOT NULL,
    ordem INTEGER NOT NULL,
    dia_semana INTEGER DEFAULT NULL,
    disciplina_id INTEGER NOT NULL,
    assunto_ids TEXT DEFAULT '',
    tipo TEXT DEFAULT '',
    tempo_estimado INTEGER DEFAULT 60,
    descricao TEXT DEFAULT '',
    realizado INTEGER NOT NULL DEFAULT 0,
    adiado INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS planejamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    nome TEXT NOT NULL,
    concurso_id INTEGER,
    data_prova TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (concurso_id) REFERENCES concursos(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS plan_disciplinas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planejamento_id INTEGER NOT NULL,
    disciplina_id INTEGER NOT NULL,
    prova TEXT DEFAULT '',
    peso REAL DEFAULT 1,
    num_questoes INTEGER DEFAULT 0,
    FOREIGN KEY (planejamento_id) REFERENCES planejamentos(id) ON DELETE CASCADE,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
    UNIQUE(planejamento_id, disciplina_id)
  );

  CREATE TABLE IF NOT EXISTS plan_assuntos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_disciplina_id INTEGER NOT NULL,
    assunto_id INTEGER NOT NULL,
    FOREIGN KEY (plan_disciplina_id) REFERENCES plan_disciplinas(id) ON DELETE CASCADE,
    FOREIGN KEY (assunto_id) REFERENCES assuntos(id) ON DELETE CASCADE,
    UNIQUE(plan_disciplina_id, assunto_id)
  );

  CREATE TABLE IF NOT EXISTS plan_tarefas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_disciplina_id INTEGER NOT NULL,
    assunto_ids TEXT DEFAULT '',
    fonte TEXT DEFAULT '',
    link_caderno TEXT DEFAULT '',
    o_que_fazer TEXT DEFAULT '',
    data_execucao TEXT DEFAULT '',
    concluida INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (plan_disciplina_id) REFERENCES plan_disciplinas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS app_config (
    user_id INTEGER NOT NULL DEFAULT 1,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, key),
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );
`);

// Migrations para banco existente
const migrations = [
  `ALTER TABLE disciplinas ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE concursos ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE sessoes ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE ciclo_config ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE ciclo_itens ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE planejamentos ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE disciplinas ADD COLUMN teoria_material TEXT DEFAULT ''`,
  `ALTER TABLE disciplinas ADD COLUMN teoria_link TEXT DEFAULT ''`,
  `ALTER TABLE disciplinas ADD COLUMN resumo_tipo TEXT DEFAULT ''`,
  `ALTER TABLE disciplinas ADD COLUMN resumo_descricao TEXT DEFAULT ''`,
  `ALTER TABLE disciplinas ADD COLUMN resumo_link TEXT DEFAULT ''`,
  `ALTER TABLE disciplinas ADD COLUMN estrategia TEXT DEFAULT ''`,
  `ALTER TABLE assuntos ADD COLUMN parent_id INTEGER DEFAULT NULL`,
  `ALTER TABLE assuntos ADD COLUMN codigo TEXT DEFAULT ''`,
  `ALTER TABLE concurso_disciplinas ADD COLUMN prova TEXT DEFAULT ''`,
  `ALTER TABLE ciclo_itens ADD COLUMN assunto_ids TEXT DEFAULT ''`,
  `ALTER TABLE ciclo_itens ADD COLUMN tipo TEXT DEFAULT ''`,
  `ALTER TABLE ciclo_itens ADD COLUMN tempo_estimado INTEGER DEFAULT 60`,
  `ALTER TABLE ciclo_itens ADD COLUMN descricao TEXT DEFAULT ''`,
  `ALTER TABLE ciclo_itens ADD COLUMN dia_semana INTEGER DEFAULT NULL`,
  `ALTER TABLE ciclo_itens ADD COLUMN adiado INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE sessoes ADD COLUMN assunto_id INTEGER DEFAULT NULL`,
  `ALTER TABLE assuntos ADD COLUMN ordem INTEGER DEFAULT 0`,
  `ALTER TABLE plan_tarefas ADD COLUMN ordem INTEGER DEFAULT 0`,
  `ALTER TABLE plan_tarefas ADD COLUMN tipo TEXT DEFAULT ''`,

  // Fase 1 — Redesign 2026
  // disciplinas
  `ALTER TABLE disciplinas ADD COLUMN nivel_conhecimento INTEGER DEFAULT NULL`,

  // plan_disciplinas
  `ALTER TABLE plan_disciplinas ADD COLUMN meta_questoes INTEGER DEFAULT NULL`,
  `ALTER TABLE plan_disciplinas ADD COLUMN meta_pct REAL DEFAULT NULL`,
  `ALTER TABLE plan_disciplinas ADD COLUMN banca TEXT DEFAULT ''`,

  // sessoes
  `ALTER TABLE sessoes ADD COLUMN questoes_feitas INTEGER DEFAULT 0`,
  `ALTER TABLE sessoes ADD COLUMN questoes_acertadas INTEGER DEFAULT 0`,
  `ALTER TABLE sessoes ADD COLUMN tempo_gasto INTEGER DEFAULT NULL`,
  `ALTER TABLE sessoes ADD COLUMN como_foi TEXT DEFAULT ''`,

  // ciclo_config
  `ALTER TABLE ciclo_config ADD COLUMN horas_semana REAL DEFAULT NULL`,
  `ALTER TABLE ciclo_config ADD COLUMN dias_estudo TEXT DEFAULT '[]'`,
  `ALTER TABLE ciclo_config ADD COLUMN inicio_semana TEXT DEFAULT 'segunda'`,
  `ALTER TABLE ciclo_config ADD COLUMN duracao_ciclo INTEGER DEFAULT 7`,

  // plan_tarefas
  `ALTER TABLE plan_tarefas ADD COLUMN tempo_estimado INTEGER DEFAULT 60`,
  `ALTER TABLE plan_tarefas ADD COLUMN quantidade_questoes INTEGER DEFAULT 0`,
  `ALTER TABLE plan_tarefas ADD COLUMN link_caderno TEXT DEFAULT ''`,
  `ALTER TABLE plan_tarefas ADD COLUMN comando TEXT DEFAULT ''`,
  `ALTER TABLE plan_tarefas ADD COLUMN hiperdica TEXT DEFAULT ''`,
  `ALTER TABLE plan_tarefas ADD COLUMN numero INTEGER DEFAULT 0`,
  `ALTER TABLE plan_tarefas ADD COLUMN observacao TEXT DEFAULT ''`,

  // ciclo_itens
  `ALTER TABLE ciclo_itens ADD COLUMN quantidade_questoes INTEGER DEFAULT 0`,
  `ALTER TABLE ciclo_itens ADD COLUMN link_caderno TEXT DEFAULT ''`,
  `ALTER TABLE ciclo_itens ADD COLUMN comando TEXT DEFAULT ''`,
  `ALTER TABLE ciclo_itens ADD COLUMN hiperdica TEXT DEFAULT ''`,
  `ALTER TABLE ciclo_itens ADD COLUMN numero INTEGER DEFAULT 0`,
  `ALTER TABLE ciclo_itens ADD COLUMN plan_tarefa_id INTEGER DEFAULT NULL`,
];

for (const m of migrations) {
  try { db.exec(m); } catch(e) { /* já existe */ }
}

// Novas tabelas — Redesign 2026
db.exec(`
  CREATE TABLE IF NOT EXISTS bancas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE(user_id, nome)
  );

  CREATE TABLE IF NOT EXISTS ciclo_viradas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data_virada TEXT NOT NULL,
    tarefas_concluidas INTEGER DEFAULT 0,
    tarefas_nao_concluidas INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );
`);

// Bancas default (inseridas para cada usuário existente na primeira vez)
// A inserção por usuário é feita no endpoint de login/me.
// Aqui garantimos a tabela existe apenas.

// Apaga todos os dados de teste (reset limpo para novo usuário)
try {
  const shouldReset = process.env.RESET_DB === 'true';
  if (shouldReset) {
    db.exec(`
      DELETE FROM plan_tarefas;
      DELETE FROM plan_assuntos;
      DELETE FROM plan_disciplinas;
      DELETE FROM planejamentos;
      DELETE FROM ciclo_itens;
      DELETE FROM ciclo_viradas;
      DELETE FROM ciclo_config;
      DELETE FROM sessao_assuntos;
      DELETE FROM sessoes;
      DELETE FROM concurso_assuntos;
      DELETE FROM concurso_disciplinas;
      DELETE FROM concursos;
      DELETE FROM assuntos;
      DELETE FROM disciplinas;
      DELETE FROM bancas;
      DELETE FROM app_config;
      DELETE FROM usuarios;
    `);
    console.log('Banco resetado com sucesso.');
  }
} catch(e) {}

module.exports = db;
