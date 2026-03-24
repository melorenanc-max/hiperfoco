/**
 * Seed de dados de teste — conta testehiperfoco@gmail.com
 *
 * Execução: node backend/seed.js
 * Pré-requisito: a conta já deve ter feito login pelo menos uma vez.
 */

const db = require('./db');

// ── Busca o user_id pelo e-mail ───────────────────────────────────────────────
const usuario = db.prepare("SELECT id FROM usuarios WHERE email = ?").get('testehiperfoco@gmail.com');
if (!usuario) {
  console.error('Usuário testehiperfoco@gmail.com não encontrado. Faça login primeiro.');
  process.exit(1);
}
const uid = usuario.id;
console.log(`Seeding dados para user_id=${uid} (testehiperfoco@gmail.com)`);

// ── Helper ────────────────────────────────────────────────────────────────────
function hoje() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}
function diasAtras(n) {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function diasAFrente(n) {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

db.transaction(() => {

  // ── Limpa dados existentes do usuário (exceto conta e bancas) ─────────────
  db.prepare('DELETE FROM sessoes WHERE user_id=?').run(uid);
  db.prepare('DELETE FROM ciclo_itens WHERE user_id=?').run(uid);
  db.prepare('DELETE FROM ciclo_config WHERE user_id=?').run(uid);
  db.prepare('DELETE FROM planejamentos WHERE user_id=?').run(uid);
  db.prepare('DELETE FROM disciplinas WHERE user_id=?').run(uid);
  db.prepare('DELETE FROM concursos WHERE user_id=?').run(uid);
  console.log('Dados anteriores removidos.');

  // ── Bancas padrão ─────────────────────────────────────────────────────────
  const bancasPadrao = ['CESPE/CEBRASPE', 'FGV', 'FCC', 'VUNESP', 'FUNRIO', 'IBFC', 'QUADRIX'];
  const insertBanca = db.prepare('INSERT OR IGNORE INTO bancas (user_id, nome) VALUES (?, ?)');
  bancasPadrao.forEach(b => insertBanca.run(uid, b));

  // ── Disciplinas (5) ───────────────────────────────────────────────────────
  const insertDisc = db.prepare(`
    INSERT INTO disciplinas (user_id, nome, meta_acerto, estrategia, teoria_material, nivel_conhecimento)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const discs = [
    { nome: 'Direito Constitucional', meta: 80, est: 'Focar em questões CESPE de provas recentes. Revisar semanalmente.', mat: 'Constituição Federal anotada + Lenza', nivel: 3 },
    { nome: 'Direito Administrativo', meta: 75, est: 'Ler legislação seca + resolver questões por assunto. Atenção ao STJ.', mat: 'Manual do Di Pietro + slides do professor', nivel: 2 },
    { nome: 'Português', meta: 85, est: 'Resolver 20 questões por dia. Foco em interpretação textual.', mat: 'Material próprio + questões comentadas', nivel: 4 },
    { nome: 'Raciocínio Lógico', meta: 70, est: 'Estudar um tema por semana, resolvendo muitas questões.', mat: 'Lógica de programação + apostila CERS', nivel: 2 },
    { nome: 'Noções de Informática', meta: 70, est: 'Praticar com questões FCC e CESPE sobre Office e Internet.', mat: 'Apostila online + questões comentadas', nivel: 3 },
  ];

  const discIds = {};
  discs.forEach(d => {
    const r = insertDisc.run(uid, d.nome, d.meta, d.est, d.mat, d.nivel);
    discIds[d.nome] = r.lastInsertRowid;
  });
  console.log('Disciplinas criadas:', Object.keys(discIds).join(', '));

  // ── Assuntos por disciplina ───────────────────────────────────────────────
  const insertAssunto = db.prepare('INSERT INTO assuntos (user_id, disciplina_id, nome, codigo, parent_id, ordem) VALUES (?, ?, ?, ?, ?, ?)');

  const assuntosData = {
    'Direito Constitucional': [
      ['Princípios Fundamentais', 'CF.1', null, 1],
      ['Direitos e Garantias', 'CF.5', null, 2],
      ['Remédios Constitucionais', 'CF.5.rem', null, 3],
      ['Organização do Estado', 'CF.18', null, 4],
      ['Poderes da República', 'CF.44', null, 5],
    ],
    'Direito Administrativo': [
      ['Princípios da Adm. Pública', 'ADM.1', null, 1],
      ['Atos Administrativos', 'ADM.2', null, 2],
      ['Licitações e Contratos', 'ADM.3', null, 3],
      ['Servidores Públicos', 'ADM.4', null, 4],
      ['Controle da Adm. Pública', 'ADM.5', null, 5],
    ],
    'Português': [
      ['Interpretação de Texto', 'POR.1', null, 1],
      ['Gramática', 'POR.2', null, 2],
      ['Ortografia e Acentuação', 'POR.2.1', null, 3],
      ['Pontuação', 'POR.2.2', null, 4],
      ['Redação Oficial', 'POR.3', null, 5],
    ],
    'Raciocínio Lógico': [
      ['Lógica Proposicional', 'RL.1', null, 1],
      ['Lógica de Argumentação', 'RL.2', null, 2],
      ['Sequências e Padrões', 'RL.3', null, 3],
      ['Matemática Financeira', 'RL.4', null, 4],
      ['Probabilidade', 'RL.5', null, 5],
    ],
    'Noções de Informática': [
      ['Office — Word e Excel', 'INFO.1', null, 1],
      ['Internet e E-mail', 'INFO.2', null, 2],
      ['Sistemas Operacionais', 'INFO.3', null, 3],
      ['Segurança da Informação', 'INFO.4', null, 4],
      ['Redes e Protocolos', 'INFO.5', null, 5],
    ],
  };

  const assuntoIds = {};
  Object.entries(assuntosData).forEach(([discNome, assuntos]) => {
    const did = discIds[discNome];
    assuntoIds[discNome] = [];
    assuntos.forEach(([nome, codigo, parentId, ordem]) => {
      const r = insertAssunto.run(uid, did, nome, codigo, parentId, ordem);
      assuntoIds[discNome].push({ id: r.lastInsertRowid, nome, codigo });
    });
  });
  console.log('Assuntos criados.');

  // ── Concursos ─────────────────────────────────────────────────────────────
  const insertConc = db.prepare('INSERT INTO concursos (user_id, nome, orgao, data_prova, status) VALUES (?, ?, ?, ?, ?)');
  const concursoAgencia = insertConc.run(uid, 'Agência Reguladora Federal', 'ANATEL', diasAFrente(120), 'ativo');
  const concursoTRF = insertConc.run(uid, 'TRF 1ª Região — Analista', 'TRF', diasAFrente(200), 'ativo');
  const concursoAGU = insertConc.run(uid, 'AGU — Advogado da União', 'AGU', diasAtras(30), 'encerrado');

  const cAgencia = concursoAgencia.lastInsertRowid;
  const cTRF = concursoTRF.lastInsertRowid;
  const cAGU = concursoAGU.lastInsertRowid;

  // Disciplinas do concurso (concurso_disciplinas)
  const insertCD = db.prepare('INSERT OR IGNORE INTO concurso_disciplinas (concurso_id, disciplina_id, num_questoes, peso, prova) VALUES (?, ?, ?, ?, ?)');
  [
    [cAgencia, discIds['Direito Constitucional'], 20, 2, 'Conhecimentos Básicos'],
    [cAgencia, discIds['Direito Administrativo'], 25, 3, 'Conhecimentos Básicos'],
    [cAgencia, discIds['Português'], 15, 2, 'Conhecimentos Básicos'],
    [cAgencia, discIds['Raciocínio Lógico'], 10, 1, 'Conhecimentos Específicos'],
    [cAgencia, discIds['Noções de Informática'], 10, 1, 'Conhecimentos Básicos'],
    [cTRF, discIds['Direito Constitucional'], 30, 3, 'Prova I'],
    [cTRF, discIds['Direito Administrativo'], 30, 3, 'Prova I'],
    [cTRF, discIds['Português'], 20, 2, 'Prova I'],
  ].forEach(args => insertCD.run(...args));

  console.log('Concursos e disciplinas criados.');

  // ── Planejamentos (2) ─────────────────────────────────────────────────────
  const insertPlan = db.prepare('INSERT INTO planejamentos (user_id, nome, data_prova, concurso_id) VALUES (?, ?, ?, ?)');
  const planAgencia = insertPlan.run(uid, 'Agência Reguladora Federal', diasAFrente(120), cAgencia);
  const planTRF = insertPlan.run(uid, 'TRF 1ª Região', diasAFrente(200), cTRF);
  const planAgenciaId = planAgencia.lastInsertRowid;
  const planTRFId = planTRF.lastInsertRowid;

  // Set concurso_alvo (planejamento ativo)
  db.prepare('UPDATE usuarios SET concurso_alvo_id = ? WHERE id = ?').run(cAgencia, uid);

  // plan_disciplinas
  const insertPD = db.prepare(`
    INSERT INTO plan_disciplinas
      (planejamento_id, disciplina_id, num_questoes, peso, meta_questoes, meta_pct, prova, banca)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const pdIds = {};
  [
    [planAgenciaId, discIds['Direito Constitucional'], 20, 2, 200, 80, 'Conhecimentos Básicos', 'CESPE/CEBRASPE'],
    [planAgenciaId, discIds['Direito Administrativo'], 25, 3, 300, 75, 'Conhecimentos Básicos', 'CESPE/CEBRASPE'],
    [planAgenciaId, discIds['Português'], 15, 2, 200, 85, 'Conhecimentos Básicos', 'CESPE/CEBRASPE'],
    [planAgenciaId, discIds['Raciocínio Lógico'], 10, 1, 150, 70, 'Conhecimentos Específicos', 'CESPE/CEBRASPE'],
    [planAgenciaId, discIds['Noções de Informática'], 10, 1, 100, 70, 'Conhecimentos Básicos', 'CESPE/CEBRASPE'],
    [planTRFId, discIds['Direito Constitucional'], 30, 3, 250, 80, 'Prova I', 'FCC'],
    [planTRFId, discIds['Direito Administrativo'], 30, 3, 280, 75, 'Prova I', 'FCC'],
    [planTRFId, discIds['Português'], 20, 2, 180, 85, 'Prova I', 'FCC'],
  ].forEach(args => {
    const r = insertPD.run(...args);
    const planId = args[0];
    const discId = args[1];
    if (!pdIds[planId]) pdIds[planId] = {};
    pdIds[planId][discId] = r.lastInsertRowid;
  });

  console.log('Planejamentos criados.');

  // ── Sessões (40) — distribuídas nos últimos 45 dias ───────────────────────
  const insertSess = db.prepare(`
    INSERT INTO sessoes
      (user_id, disciplina_id, concurso_id, tipo, data, banca,
       questoes_feitas, questoes_acertadas, total_questoes, acertos,
       tempo_gasto, como_foi, observacoes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSessAss = db.prepare('INSERT OR IGNORE INTO sessao_assuntos (sessao_id, assunto_id) VALUES (?, ?)');

  const sessoesSeed = [
    // DirConst - CESPE/CEBRASPE
    { disc: 'Direito Constitucional', tipo: 'questoes', dda: 1,  q: 30, a: 26, t: 60,  cf: 'Ótima sessão, acertei bem nas questões de princípios.', assunto: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Constitucional', tipo: 'questoes', dda: 4,  q: 25, a: 20, t: 50,  cf: 'Dificuldade em direitos sociais. Preciso revisar.', assunto: 1, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Constitucional', tipo: 'teoria',   dda: 6,  q: 0,  a: 0,  t: 90,  cf: 'Li os capítulos sobre organização do Estado.', assunto: 3 },
    { disc: 'Direito Constitucional', tipo: 'questoes', dda: 8,  q: 40, a: 34, t: 75,  cf: 'Bom desempenho hoje! Princípios fundamentais em dia.', assunto: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Constitucional', tipo: 'revisao',  dda: 11, q: 20, a: 17, t: 45,  cf: 'Revisão rápida antes da prova simulada.', assunto: 2, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Constitucional', tipo: 'questoes', dda: 14, q: 35, a: 28, t: 65,  cf: 'Foco em remédios constitucionais. Mandado de segurança complexo.', assunto: 2, banca: 'FGV' },
    { disc: 'Direito Constitucional', tipo: 'questoes', dda: 17, q: 30, a: 24, t: 60,  cf: 'Poderes da República — questões difíceis mas aprendi bastante.', assunto: 4, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Constitucional', tipo: 'simulado', dda: 20, q: 50, a: 39, t: 120, cf: 'Simulado completo. 78% — precisei rever organização política.', assunto: 3, banca: 'CESPE/CEBRASPE' },

    // DirAdm
    { disc: 'Direito Administrativo', tipo: 'questoes', dda: 2,  q: 30, a: 21, t: 60,  cf: 'Princípios — LIMPE em foco. Pegadinha da moralidade.', assunto: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Administrativo', tipo: 'questoes', dda: 5,  q: 25, a: 17, t: 50,  cf: 'Atos administrativos — difícil! Errei bastante em vícios.', assunto: 1, banca: 'FCC' },
    { disc: 'Direito Administrativo', tipo: 'teoria',   dda: 7,  q: 0,  a: 0,  t: 80,  cf: 'Leitura de licitações. Lei 14.133 é extensa.', assunto: 2 },
    { disc: 'Direito Administrativo', tipo: 'questoes', dda: 10, q: 35, a: 24, t: 70,  cf: 'Licitações — melhorando. Pregão eletrônico faz sentido agora.', assunto: 2, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Administrativo', tipo: 'questoes', dda: 13, q: 30, a: 22, t: 60,  cf: 'Servidores — muita jurisprudência. Demorei mas aprendi.', assunto: 3, banca: 'FCC' },
    { disc: 'Direito Administrativo', tipo: 'questoes', dda: 16, q: 40, a: 29, t: 75,  cf: 'Controle da Adm — TCU, CGU. Interessante e relevante.', assunto: 4, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Administrativo', tipo: 'simulado', dda: 22, q: 45, a: 32, t: 100, cf: 'Simulado geral — 71%. Preciso focar mais em atos adm.', assunto: 1, banca: 'FCC' },
    { disc: 'Direito Administrativo', tipo: 'revisao',  dda: 25, q: 20, a: 15, t: 40,  cf: 'Revisão rápida de princípios antes da próxima sessão.', assunto: 0, banca: 'CESPE/CEBRASPE' },

    // Português
    { disc: 'Português', tipo: 'questoes', dda: 1,  q: 20, a: 18, t: 40,  cf: 'Interpretação de texto — foi bem! Textos curtos são mais fáceis.', assunto: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Português', tipo: 'questoes', dda: 3,  q: 25, a: 22, t: 45,  cf: 'Gramática vai bem. Concordância nominal ok.', assunto: 1, banca: 'FCC' },
    { disc: 'Português', tipo: 'questoes', dda: 6,  q: 20, a: 16, t: 40,  cf: 'Ortografia — sempre tem pegadinha de acento.', assunto: 2, banca: 'CESPE/CEBRASPE' },
    { disc: 'Português', tipo: 'questoes', dda: 9,  q: 30, a: 26, t: 55,  cf: 'Pontuação e vírgula — foi bem! Regras ficaram mais claras.', assunto: 3, banca: 'FCC' },
    { disc: 'Português', tipo: 'questoes', dda: 12, q: 20, a: 17, t: 35,  cf: 'Redação oficial — fácil na teoria, difícil na prática do CESPE.', assunto: 4, banca: 'CESPE/CEBRASPE' },
    { disc: 'Português', tipo: 'simulado', dda: 18, q: 30, a: 26, t: 70,  cf: 'Simulado de Português — 87%! Pontos fortes: interpretação.', assunto: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Português', tipo: 'questoes', dda: 24, q: 25, a: 21, t: 45,  cf: 'Textos mais longos hoje. Mantive foco bem.', assunto: 0, banca: 'CESPE/CEBRASPE' },

    // Raciocínio Lógico
    { disc: 'Raciocínio Lógico', tipo: 'questoes', dda: 2,  q: 20, a: 13, t: 50,  cf: 'Lógica proposicional — tabela verdade muito confusa ainda.', assunto: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Raciocínio Lógico', tipo: 'teoria',   dda: 5,  q: 0,  a: 0,  t: 70,  cf: 'Estudei conectivos lógicos. Preciso fixar com questões.', assunto: 0 },
    { disc: 'Raciocínio Lógico', tipo: 'questoes', dda: 8,  q: 25, a: 17, t: 60,  cf: 'Lógica de argumentação — um pouco melhor hoje.', assunto: 1, banca: 'CESPE/CEBRASPE' },
    { disc: 'Raciocínio Lógico', tipo: 'questoes', dda: 11, q: 20, a: 14, t: 55,  cf: 'Sequências — algumas pareciam impossíveis. Revisar.', assunto: 2, banca: 'FCC' },
    { disc: 'Raciocínio Lógico', tipo: 'questoes', dda: 15, q: 20, a: 15, t: 50,  cf: 'Mat. Financeira — juros compostos ficaram mais claros.', assunto: 3, banca: 'CESPE/CEBRASPE' },
    { disc: 'Raciocínio Lógico', tipo: 'questoes', dda: 19, q: 15, a: 11, t: 40,  cf: 'Probabilidade — básico ok, combinatória ainda errando.', assunto: 4, banca: 'FCC' },
    { disc: 'Raciocínio Lógico', tipo: 'questoes', dda: 27, q: 25, a: 18, t: 55,  cf: 'Revisão geral de RL. Evoluindo!', assunto: 0, banca: 'CESPE/CEBRASPE' },

    // Informática
    { disc: 'Noções de Informática', tipo: 'questoes', dda: 3,  q: 20, a: 16, t: 40,  cf: 'Word e Excel — bem! Atalhos de teclado CESPE.', assunto: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Noções de Informática', tipo: 'questoes', dda: 7,  q: 20, a: 15, t: 35,  cf: 'Internet — phishing e segurança em foco.', assunto: 1, banca: 'FCC' },
    { disc: 'Noções de Informática', tipo: 'teoria',   dda: 10, q: 0,  a: 0,  t: 60,  cf: 'Estudei sistemas operacionais. Windows e Linux.', assunto: 2 },
    { disc: 'Noções de Informática', tipo: 'questoes', dda: 14, q: 20, a: 14, t: 40,  cf: 'Segurança da informação — criptografia, firewall. Difícil!', assunto: 3, banca: 'CESPE/CEBRASPE' },
    { disc: 'Noções de Informática', tipo: 'questoes', dda: 20, q: 15, a: 11, t: 35,  cf: 'Redes e TCP/IP. Fui bem com portas conhecidas.', assunto: 4, banca: 'FCC' },
    { disc: 'Noções de Informática', tipo: 'questoes', dda: 28, q: 25, a: 19, t: 50,  cf: 'Revisão de informática. Melhorou bastante vs início.', assunto: 0, banca: 'CESPE/CEBRASPE' },
  ];

  sessoesSeed.forEach(s => {
    const discId = discIds[s.disc];
    const assuntoIdx = s.assunto || 0;
    const assuntosDisc = assuntoIds[s.disc];
    const assunto = assuntosDisc ? assuntosDisc[assuntoIdx] : null;

    const r = insertSess.run(
      uid,
      discId,
      cAgencia,
      s.tipo,
      diasAtras(s.dda),
      s.banca || null,
      s.q, s.a,
      s.q, s.a, // legacy fields
      s.t,
      s.cf,
      s.cf
    );
    const sessId = r.lastInsertRowid;
    if (assunto) insertSessAss.run(sessId, assunto.id);
  });

  console.log(`${sessoesSeed.length} sessões criadas.`);

  // ── Ciclo da semana atual ─────────────────────────────────────────────────
  function getMondayISO() {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().slice(0, 10);
  }
  const semanaAtual = getMondayISO();

  const insertCiclo = db.prepare(`
    INSERT INTO ciclo_itens
      (user_id, semana_inicio, ordem, dia_semana, disciplina_id, tipo, tempo_estimado,
       quantidade_questoes, descricao, assunto_ids, realizado, adiado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const cicloSeed = [
    { disc: 'Direito Constitucional', dia: 0, tipo: 'questoes', tempo: 60, q: 30, desc: 'Princípios fundamentais', ass: 0 },
    { disc: 'Direito Administrativo', dia: 0, tipo: 'questoes', tempo: 60, q: 30, desc: 'Atos administrativos', ass: 1 },
    { disc: 'Português', dia: 1, tipo: 'questoes', tempo: 45, q: 25, desc: 'Interpretação de texto', ass: 0 },
    { disc: 'Raciocínio Lógico', dia: 1, tipo: 'questoes', tempo: 60, q: 20, desc: 'Lógica proposicional', ass: 0 },
    { disc: 'Direito Constitucional', dia: 2, tipo: 'teoria', tempo: 90, q: 0, desc: 'Organização do Estado', ass: 3 },
    { disc: 'Noções de Informática', dia: 2, tipo: 'questoes', tempo: 40, q: 20, desc: 'Office e Internet', ass: 0 },
    { disc: 'Direito Administrativo', dia: 3, tipo: 'questoes', tempo: 60, q: 35, desc: 'Licitações e contratos', ass: 2 },
    { disc: 'Português', dia: 3, tipo: 'questoes', tempo: 40, q: 20, desc: 'Gramática', ass: 1 },
    { disc: 'Direito Constitucional', dia: 4, tipo: 'revisao', tempo: 45, q: 20, desc: 'Revisão semanal', ass: 0 },
    { disc: 'Raciocínio Lógico', dia: 4, tipo: 'questoes', tempo: 50, q: 15, desc: 'Probabilidade', ass: 4 },
  ];

  cicloSeed.forEach((item, idx) => {
    const discId = discIds[item.disc];
    const assIds = assuntoIds[item.disc];
    const assStr = assIds && assIds[item.ass] ? String(assIds[item.ass].id) : '';
    const realizado = item.dia < 2 ? 1 : 0; // dias 0-1 (seg/ter) marcados como feitos
    insertCiclo.run(
      uid, semanaAtual, idx + 1, item.dia,
      discId, item.tipo, item.tempo, item.q, item.desc,
      assStr, realizado, 0
    );
  });

  console.log(`${cicloSeed.length} itens de ciclo criados para a semana ${semanaAtual}.`);

  // ── Tarefas do planejamento (para Agência) ────────────────────────────────
  const insertTarefa = db.prepare(`
    INSERT INTO plan_tarefas
      (plan_disciplina_id, tipo, tempo_estimado, quantidade_questoes, descricao,
       assunto_ids, concluida, numero, ordem)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tarefasAgencia = [
    { disc: 'Direito Constitucional', tipo: 'questoes', t: 60,  q: 30, desc: 'Princípios fundamentais — questões CESPE', ass: 0, done: 1 },
    { disc: 'Direito Constitucional', tipo: 'questoes', t: 60,  q: 30, desc: 'Direitos e garantias — questões', ass: 1, done: 1 },
    { disc: 'Direito Constitucional', tipo: 'teoria',   t: 90,  q: 0,  desc: 'Leitura CF — organização do Estado', ass: 3, done: 0 },
    { disc: 'Direito Administrativo', tipo: 'questoes', t: 60,  q: 35, desc: 'Princípios LIMPE — questões CESPE', ass: 0, done: 1 },
    { disc: 'Direito Administrativo', tipo: 'questoes', t: 75,  q: 40, desc: 'Atos administrativos — questões variadas', ass: 1, done: 0 },
    { disc: 'Direito Administrativo', tipo: 'questoes', t: 90,  q: 40, desc: 'Licitações e contratos — lei 14.133', ass: 2, done: 0 },
    { disc: 'Português', tipo: 'questoes', t: 40, q: 25, desc: 'Interpretação textual — CESPE', ass: 0, done: 1 },
    { disc: 'Português', tipo: 'questoes', t: 45, q: 25, desc: 'Gramática — concordância nominal e verbal', ass: 1, done: 1 },
    { disc: 'Raciocínio Lógico', tipo: 'questoes', t: 50, q: 20, desc: 'Lógica proposicional — tabela verdade', ass: 0, done: 0 },
    { disc: 'Noções de Informática', tipo: 'questoes', t: 40, q: 20, desc: 'Office — Word e Excel', ass: 0, done: 1 },
  ];

  tarefasAgencia.forEach((tarefa, idx) => {
    const discId = discIds[tarefa.disc];
    const pdId = pdIds[planAgenciaId]?.[discId];
    if (!pdId) return;
    const assIds = assuntoIds[tarefa.disc];
    const assStr = assIds && assIds[tarefa.ass] ? String(assIds[tarefa.ass].id) : '';
    insertTarefa.run(
      pdId, tarefa.tipo, tarefa.t, tarefa.q, tarefa.desc,
      assStr, tarefa.done, idx + 1, idx + 1
    );
  });

  console.log(`${tarefasAgencia.length} tarefas do planejamento criadas.`);

})(); // end transaction

console.log('\n✓ Seed concluído com sucesso!');
console.log('  Dados criados:');
console.log('  - 5 disciplinas com assuntos');
console.log('  - 2 planejamentos (Agência Reguladora + TRF)');
console.log('  - 40 sessões de estudo (últimos 28 dias)');
console.log('  - 10 itens no ciclo semanal atual');
console.log('  - 10 tarefas no planejamento da Agência');
