/**
 * Seed de dados de teste — conta testehiperfoco@gmail.com
 * Execução: node backend/seed.js
 * Pré-requisito: a conta já deve ter feito login pelo menos uma vez.
 */

const db = require('./db');

const usuario = db.prepare("SELECT id FROM usuarios WHERE email = ?").get('testehiperfoco@gmail.com');
if (!usuario) {
  console.error('Usuário testehiperfoco@gmail.com não encontrado. Faça login primeiro.');
  process.exit(1);
}
const uid = usuario.id;
console.log(`Seeding dados para user_id=${uid} (testehiperfoco@gmail.com)`);

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
function getMondayISO() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

db.transaction(() => {

  // ── Limpa dados existentes do usuário ────────────────────────────────────
  db.prepare('DELETE FROM sessao_assuntos WHERE sessao_id IN (SELECT id FROM sessoes WHERE user_id=?)').run(uid);
  db.prepare('DELETE FROM sessoes WHERE user_id=?').run(uid);
  db.prepare('DELETE FROM ciclo_itens WHERE user_id=?').run(uid);
  db.prepare('DELETE FROM ciclo_config WHERE user_id=?').run(uid);
  try { db.prepare('DELETE FROM ciclo_viradas WHERE user_id=?').run(uid); } catch(e) {}
  db.prepare('DELETE FROM plan_tarefas WHERE plan_disciplina_id IN (SELECT id FROM plan_disciplinas WHERE planejamento_id IN (SELECT id FROM planejamentos WHERE user_id=?))').run(uid);
  db.prepare('DELETE FROM plan_assuntos WHERE plan_disciplina_id IN (SELECT id FROM plan_disciplinas WHERE planejamento_id IN (SELECT id FROM planejamentos WHERE user_id=?))').run(uid);
  db.prepare('DELETE FROM plan_disciplinas WHERE planejamento_id IN (SELECT id FROM planejamentos WHERE user_id=?)').run(uid);
  db.prepare('DELETE FROM planejamentos WHERE user_id=?').run(uid);
  db.prepare('DELETE FROM concurso_assuntos WHERE concurso_id IN (SELECT id FROM concursos WHERE user_id=?)').run(uid);
  db.prepare('DELETE FROM concurso_disciplinas WHERE concurso_id IN (SELECT id FROM concursos WHERE user_id=?)').run(uid);
  db.prepare('DELETE FROM concursos WHERE user_id=?').run(uid);
  db.prepare('DELETE FROM assuntos WHERE disciplina_id IN (SELECT id FROM disciplinas WHERE user_id=?)').run(uid);
  db.prepare('DELETE FROM disciplinas WHERE user_id=?').run(uid);
  db.prepare('DELETE FROM bancas WHERE user_id=?').run(uid);
  console.log('Dados anteriores removidos.');

  // ── Bancas padrão ─────────────────────────────────────────────────────────
  const insertBanca = db.prepare('INSERT OR IGNORE INTO bancas (user_id, nome) VALUES (?, ?)');
  ['CESPE/CEBRASPE', 'FGV', 'FCC', 'VUNESP', 'FUNRIO', 'IBFC', 'QUADRIX'].forEach(b => insertBanca.run(uid, b));

  // ── Disciplinas ───────────────────────────────────────────────────────────
  const insertDisc = db.prepare(`
    INSERT INTO disciplinas (user_id, nome, meta_acerto, estrategia, teoria_material, nivel_conhecimento)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const discsData = [
    { nome: 'Direito Constitucional', meta: 80, est: 'Focar em questões CESPE de provas recentes. Revisar CF semanalmente com atenção aos direitos fundamentais.', mat: 'Constituição Federal anotada + Lenza', nivel: 3 },
    { nome: 'Direito Administrativo', meta: 75, est: 'Ler legislação seca + resolver questões por assunto. Atenção especial ao STJ e jurisprudência recente.', mat: 'Manual do Di Pietro + slides do professor', nivel: 2 },
    { nome: 'Português', meta: 85, est: 'Resolver 20 questões por dia. Foco em interpretação textual e gramática contextual.', mat: 'Material próprio + questões comentadas CESPE', nivel: 4 },
    { nome: 'Raciocínio Lógico', meta: 70, est: 'Estudar um tema por semana, resolvendo muitas questões. Não pular para o próximo sem dominar o atual.', mat: 'Apostila CERS + questões comentadas', nivel: 2 },
    { nome: 'Noções de Informática', meta: 70, est: 'Praticar com questões FCC e CESPE sobre Office e Internet. Focar em segurança da informação.', mat: 'Apostila online + questões comentadas', nivel: 3 },
  ];

  const discIds = {};
  discsData.forEach(d => {
    const r = insertDisc.run(uid, d.nome, d.meta, d.est, d.mat, d.nivel);
    discIds[d.nome] = r.lastInsertRowid;
  });
  console.log('Disciplinas criadas:', Object.keys(discIds).join(', '));

  // ── Assuntos ──────────────────────────────────────────────────────────────
  const insertAssunto = db.prepare('INSERT INTO assuntos (disciplina_id, nome, codigo, parent_id, ordem) VALUES (?, ?, ?, ?, ?)');

  const assuntosData = {
    'Direito Constitucional': [
      { nome: 'Princípios Fundamentais', cod: 'CF.1', pai: null, ord: 1 },
      { nome: 'Direitos e Garantias Fundamentais', cod: 'CF.5', pai: null, ord: 2 },
      { nome: 'Remédios Constitucionais', cod: 'CF.5.rem', pai: null, ord: 3 },
      { nome: 'Organização do Estado', cod: 'CF.18', pai: null, ord: 4 },
      { nome: 'Poderes da República', cod: 'CF.44', pai: null, ord: 5 },
      { nome: 'Poder Executivo', cod: 'CF.76', pai: null, ord: 6 },
      { nome: 'Poder Judiciário', cod: 'CF.92', pai: null, ord: 7 },
    ],
    'Direito Administrativo': [
      { nome: 'Princípios da Administração Pública', cod: 'ADM.1', pai: null, ord: 1 },
      { nome: 'Atos Administrativos', cod: 'ADM.2', pai: null, ord: 2 },
      { nome: 'Licitações e Contratos (Lei 14.133)', cod: 'ADM.3', pai: null, ord: 3 },
      { nome: 'Servidores Públicos', cod: 'ADM.4', pai: null, ord: 4 },
      { nome: 'Controle da Administração Pública', cod: 'ADM.5', pai: null, ord: 5 },
      { nome: 'Responsabilidade Civil do Estado', cod: 'ADM.6', pai: null, ord: 6 },
    ],
    'Português': [
      { nome: 'Interpretação de Texto', cod: 'POR.1', pai: null, ord: 1 },
      { nome: 'Gramática', cod: 'POR.2', pai: null, ord: 2 },
      { nome: 'Ortografia e Acentuação', cod: 'POR.3', pai: null, ord: 3 },
      { nome: 'Pontuação', cod: 'POR.4', pai: null, ord: 4 },
      { nome: 'Redação Oficial', cod: 'POR.5', pai: null, ord: 5 },
    ],
    'Raciocínio Lógico': [
      { nome: 'Lógica Proposicional', cod: 'RL.1', pai: null, ord: 1 },
      { nome: 'Lógica de Argumentação', cod: 'RL.2', pai: null, ord: 2 },
      { nome: 'Sequências e Padrões', cod: 'RL.3', pai: null, ord: 3 },
      { nome: 'Matemática Financeira', cod: 'RL.4', pai: null, ord: 4 },
      { nome: 'Probabilidade e Combinatória', cod: 'RL.5', pai: null, ord: 5 },
    ],
    'Noções de Informática': [
      { nome: 'Office — Word e Excel', cod: 'INFO.1', pai: null, ord: 1 },
      { nome: 'Internet e E-mail', cod: 'INFO.2', pai: null, ord: 2 },
      { nome: 'Sistemas Operacionais', cod: 'INFO.3', pai: null, ord: 3 },
      { nome: 'Segurança da Informação', cod: 'INFO.4', pai: null, ord: 4 },
      { nome: 'Redes e Protocolos', cod: 'INFO.5', pai: null, ord: 5 },
    ],
  };

  // Subitens para algumas disciplinas
  const subassuntosData = {
    'Direito Constitucional': {
      'Direitos e Garantias Fundamentais': [
        { nome: 'Direitos Individuais e Coletivos', cod: 'CF.5.1' },
        { nome: 'Direitos Sociais', cod: 'CF.5.2' },
        { nome: 'Direitos Políticos', cod: 'CF.5.3' },
      ],
      'Remédios Constitucionais': [
        { nome: 'Habeas Corpus', cod: 'CF.5.HC' },
        { nome: 'Mandado de Segurança', cod: 'CF.5.MS' },
        { nome: 'Habeas Data', cod: 'CF.5.HD' },
      ],
    },
    'Direito Administrativo': {
      'Licitações e Contratos (Lei 14.133)': [
        { nome: 'Modalidades de Licitação', cod: 'ADM.3.1' },
        { nome: 'Dispensas e Inexigibilidades', cod: 'ADM.3.2' },
        { nome: 'Contratos Administrativos', cod: 'ADM.3.3' },
      ],
    },
  };

  const assuntoIds = {};
  const assuntoIdsByNome = {};

  Object.entries(assuntosData).forEach(([discNome, assuntos]) => {
    const did = discIds[discNome];
    assuntoIds[discNome] = [];
    assuntoIdsByNome[discNome] = {};

    assuntos.forEach(a => {
      const r = insertAssunto.run(did, a.nome, a.cod, null, a.ord);
      const aid = r.lastInsertRowid;
      assuntoIds[discNome].push({ id: aid, nome: a.nome });
      assuntoIdsByNome[discNome][a.nome] = aid;

      // Subitens
      const subs = (subassuntosData[discNome] || {})[a.nome] || [];
      subs.forEach((sub, si) => {
        insertAssunto.run(did, sub.nome, sub.cod, aid, si + 1);
      });
    });
  });
  console.log('Assuntos e subitens criados.');

  // ── Concursos ─────────────────────────────────────────────────────────────
  const insertConc = db.prepare('INSERT INTO concursos (user_id, nome, banca, data_prova) VALUES (?, ?, ?, ?)');
  const cAgencia = insertConc.run(uid, 'Agência Reguladora Federal 2026', 'CESPE/CEBRASPE', diasAFrente(90)).lastInsertRowid;
  const cTRF = insertConc.run(uid, 'TRF 1ª Região — Analista 2026', 'FGV', diasAFrente(180)).lastInsertRowid;
  const cAGU = insertConc.run(uid, 'AGU — Advogado da União 2025', 'CESPE/CEBRASPE', diasAtras(45)).lastInsertRowid;
  console.log('Concursos criados.');

  // Disciplinas dos concursos
  const insertCD = db.prepare('INSERT OR IGNORE INTO concurso_disciplinas (concurso_id, disciplina_id, num_questoes, peso, prova) VALUES (?, ?, ?, ?, ?)');
  [
    [cAgencia, discIds['Direito Constitucional'],  20, 2, 'P1'],
    [cAgencia, discIds['Direito Administrativo'],  25, 3, 'P1'],
    [cAgencia, discIds['Português'],               15, 2, 'P1'],
    [cAgencia, discIds['Raciocínio Lógico'],       10, 1, 'P2'],
    [cAgencia, discIds['Noções de Informática'],   10, 1, 'P1'],
    [cTRF,    discIds['Direito Constitucional'],   30, 3, 'P1'],
    [cTRF,    discIds['Direito Administrativo'],   30, 3, 'P1'],
    [cTRF,    discIds['Português'],                20, 2, 'P1'],
    [cAGU,    discIds['Direito Constitucional'],   25, 3, 'P1'],
    [cAGU,    discIds['Direito Administrativo'],   25, 3, 'P1'],
    [cAGU,    discIds['Português'],                20, 2, 'P1'],
    [cAGU,    discIds['Raciocínio Lógico'],        15, 1, 'P2'],
  ].forEach(args => insertCD.run(...args));

  // ── Planejamentos ─────────────────────────────────────────────────────────
  const insertPlan = db.prepare('INSERT INTO planejamentos (user_id, nome, concurso_id, data_prova) VALUES (?, ?, ?, ?)');
  const planAgenciaId = insertPlan.run(uid, 'Agência Reguladora Federal 2026', cAgencia, diasAFrente(90)).lastInsertRowid;
  const planTRFId = insertPlan.run(uid, 'TRF 1ª Região — Analista 2026', cTRF, diasAFrente(180)).lastInsertRowid;

  // Plano ativo
  db.prepare('INSERT OR REPLACE INTO app_config (user_id, key, value) VALUES (?, ?, ?)').run(uid, 'plano_alvo', String(planAgenciaId));

  // Disciplinas dos planejamentos
  const insertPD = db.prepare('INSERT OR IGNORE INTO plan_disciplinas (planejamento_id, disciplina_id, prova, peso, num_questoes, meta_questoes, meta_pct) VALUES (?, ?, ?, ?, ?, ?, ?)');

  const pdIds = {};
  [
    [planAgenciaId, 'Direito Constitucional',  'P1', 2, 20, 16, 80],
    [planAgenciaId, 'Direito Administrativo',  'P1', 3, 25, 19, 75],
    [planAgenciaId, 'Português',               'P1', 2, 15, 13, 85],
    [planAgenciaId, 'Raciocínio Lógico',       'P2', 1, 10,  7, 70],
    [planAgenciaId, 'Noções de Informática',   'P1', 1, 10,  7, 70],
    [planTRFId,     'Direito Constitucional',  'P1', 3, 30, 24, 80],
    [planTRFId,     'Direito Administrativo',  'P1', 3, 30, 23, 75],
    [planTRFId,     'Português',               'P1', 2, 20, 17, 85],
  ].forEach(([planId, discNome, prova, peso, nq, mq, mp]) => {
    const did = discIds[discNome];
    const r = insertPD.run(planId, did, prova, peso, nq, mq, mp);
    if (!pdIds[planId]) pdIds[planId] = {};
    pdIds[planId][did] = r.lastInsertRowid;
  });
  console.log('Planejamentos e disciplinas criados.');

  // ── Tarefas do planejamento (Agência) ─────────────────────────────────────
  const insertTarefa = db.prepare(`
    INSERT INTO plan_tarefas
      (plan_disciplina_id, tipo, tempo_estimado, quantidade_questoes,
       assunto_ids, concluida, numero, ordem, o_que_fazer, comando, hiperdica, link_caderno)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tarefasAgencia = [
    {
      disc: 'Direito Constitucional', tipo: 'questoes', t: 60, q: 30, assIdx: 0, done: 1, num: 1,
      cmd: 'Resolver questões CESPE sobre princípios fundamentais. Focar em soberania, cidadania e dignidade da pessoa humana.',
      dica: 'Os objetivos (art. 3) são muito cobrados. Lembre: construir, garantir, erradicar, promover.',
      link: 'https://www.tecconcursos.com.br/questoes/cadernos/123456'
    },
    {
      disc: 'Direito Constitucional', tipo: 'questoes', t: 60, q: 30, assIdx: 1, done: 1, num: 2,
      cmd: 'Questões sobre direitos e garantias fundamentais. Atenção aos remédios constitucionais.',
      dica: 'HC protege liberdade de locomoção. MS protege direito líquido e certo. HD garante acesso a dados.',
      link: ''
    },
    {
      disc: 'Direito Constitucional', tipo: 'teoria', t: 90, q: 0, assIdx: 3, done: 0, num: 3,
      cmd: 'Ler o capítulo sobre organização do Estado. Fazer resumo dos artigos 18 a 43.',
      dica: 'Organização político-administrativa: União, Estados, DF e Municípios. Todos autônomos!',
      link: ''
    },
    {
      disc: 'Direito Administrativo', tipo: 'questoes', t: 60, q: 35, assIdx: 0, done: 1, num: 1,
      cmd: 'Questões sobre princípios LIMPE. Incluir jurisprudência do STJ sobre moralidade.',
      dica: 'LIMPE: Legalidade, Impessoalidade, Moralidade, Publicidade, Eficiência. Decorar a ordem!',
      link: ''
    },
    {
      disc: 'Direito Administrativo', tipo: 'questoes', t: 75, q: 40, assIdx: 1, done: 0, num: 2,
      cmd: 'Atos administrativos — elementos, atributos e vícios. Foco em anulação vs revogação.',
      dica: 'Anulação: ilegalidade (pode ser feita pela própria Adm. ou Judiciário). Revogação: conveniência (só pela Adm.).',
      link: 'https://www.tecconcursos.com.br/questoes/cadernos/789012'
    },
    {
      disc: 'Direito Administrativo', tipo: 'questoes', t: 90, q: 40, assIdx: 2, done: 0, num: 3,
      cmd: 'Licitações — modalidades e critérios de julgamento da Nova Lei de Licitações (14.133/21).',
      dica: 'Pregão é a modalidade mais cobrada. Sempre para bens e serviços comuns. Lembre das fases.',
      link: ''
    },
    {
      disc: 'Português', tipo: 'questoes', t: 40, q: 25, assIdx: 0, done: 1, num: 1,
      cmd: 'Interpretação textual CESPE — foco em inferências e pressupostos.',
      dica: 'No CESPE, cuidado com afirmações absolutas (sempre, nunca, todos). Geralmente são falsas.',
      link: ''
    },
    {
      disc: 'Português', tipo: 'questoes', t: 45, q: 25, assIdx: 1, done: 1, num: 2,
      cmd: 'Gramática — concordância nominal e verbal. Casos especiais.',
      dica: 'Verbos impessoais (haver, fazer + tempo) ficam sempre no singular. Ex: Faz dois anos.',
      link: ''
    },
    {
      disc: 'Raciocínio Lógico', tipo: 'questoes', t: 50, q: 20, assIdx: 0, done: 0, num: 1,
      cmd: 'Lógica proposicional — tabela verdade e equivalências lógicas.',
      dica: 'Bicondicional verdadeiro só quando os dois lados têm o mesmo valor lógico.',
      link: ''
    },
    {
      disc: 'Noções de Informática', tipo: 'questoes', t: 40, q: 20, assIdx: 0, done: 1, num: 1,
      cmd: 'Office Word e Excel — questões FCC e CESPE sobre formatação e funções.',
      dica: 'Atalhos mais cobrados: Ctrl+Z (desfazer), Ctrl+Y (refazer), F12 (salvar como).',
      link: ''
    },
  ];

  tarefasAgencia.forEach((tarefa, idx) => {
    const discId = discIds[tarefa.disc];
    const pdId = pdIds[planAgenciaId] && pdIds[planAgenciaId][discId];
    if (!pdId) return;
    const assArr = assuntoIds[tarefa.disc];
    const assStr = assArr && assArr[tarefa.assIdx] ? String(assArr[tarefa.assIdx].id) : '';
    insertTarefa.run(
      pdId, tarefa.tipo, tarefa.t, tarefa.q,
      assStr, tarefa.done, tarefa.num, idx + 1,
      tarefa.cmd, tarefa.cmd, tarefa.dica, tarefa.link
    );
  });
  console.log('Tarefas do planejamento criadas.');

  // ── Sessões de estudo (40 registros nos últimos 30 dias) ──────────────────
  const insertSess = db.prepare(`
    INSERT INTO sessoes
      (user_id, disciplina_id, concurso_id, tipo, data, banca,
       total_questoes, acertos, questoes_feitas, questoes_acertadas,
       tempo_gasto, como_foi, observacoes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSessAss = db.prepare('INSERT OR IGNORE INTO sessao_assuntos (sessao_id, assunto_id) VALUES (?, ?)');

  const sessoesSeed = [
    // Direito Constitucional
    { disc: 'Direito Constitucional', tipo: 'questoes', dda: 2,  q: 30, a: 24, t: 60,  cf: 'normal',  obs: 'Princípios fundamentais — bom desempenho. Objetivos ainda confundo às vezes.', assIdx: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Constitucional', tipo: 'questoes', dda: 5,  q: 30, a: 22, t: 65,  cf: 'dificil', obs: 'Direitos e garantias — muito extenso. Precisei reler vários artigos.', assIdx: 1, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Constitucional', tipo: 'teoria',   dda: 8,  q: 0,  a: 0,  t: 90,  cf: 'normal',  obs: 'Leitura completa do Título II da CF. Fichei os remédios constitucionais.', assIdx: 2, banca: null },
    { disc: 'Direito Constitucional', tipo: 'questoes', dda: 11, q: 25, a: 20, t: 55,  cf: 'facil',   obs: 'Remédios constitucionais — HC e MS ficaram bem claros.', assIdx: 2, banca: 'FGV' },
    { disc: 'Direito Constitucional', tipo: 'questoes', dda: 15, q: 30, a: 25, t: 60,  cf: 'normal',  obs: 'Organização do Estado — questões de distribuição de competências.', assIdx: 3, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Constitucional', tipo: 'simulado', dda: 20, q: 20, a: 17, t: 45,  cf: 'normal',  obs: 'Simulado parcial de constitucional — 85%. Melhorei bastante!', assIdx: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Constitucional', tipo: 'questoes', dda: 25, q: 25, a: 20, t: 50,  cf: 'normal',  obs: 'Poderes da República — confundo competências privativas às vezes.', assIdx: 4, banca: 'CESPE/CEBRASPE' },

    // Direito Administrativo
    { disc: 'Direito Administrativo', tipo: 'questoes', dda: 1,  q: 35, a: 25, t: 70,  cf: 'normal',  obs: 'Princípios — LIMPE dominado. Eficiência e moralidade ainda pegam pegadinha.', assIdx: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Administrativo', tipo: 'questoes', dda: 4,  q: 40, a: 27, t: 80,  cf: 'dificil', obs: 'Atos administrativos — vícios e nulidades muito cobrados. Difícil!', assIdx: 1, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Administrativo', tipo: 'teoria',   dda: 7,  q: 0,  a: 0,  t: 120, cf: 'normal',  obs: 'Leitura completa da lei 14.133. Muita coisa nova em relação à lei anterior.', assIdx: 2, banca: null },
    { disc: 'Direito Administrativo', tipo: 'questoes', dda: 10, q: 40, a: 26, t: 85,  cf: 'dificil', obs: 'Licitações — Nova lei trocou muita nomenclatura. Preciso revisar mais.', assIdx: 2, banca: 'FCC' },
    { disc: 'Direito Administrativo', tipo: 'questoes', dda: 14, q: 30, a: 21, t: 65,  cf: 'normal',  obs: 'Servidores públicos — estabilidade e remuneração. Foi bem.', assIdx: 3, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Administrativo', tipo: 'revisao',  dda: 18, q: 20, a: 14, t: 40,  cf: 'normal',  obs: 'Revisão de controle da administração — TCU e CGU.', assIdx: 4, banca: 'CESPE/CEBRASPE' },
    { disc: 'Direito Administrativo', tipo: 'questoes', dda: 23, q: 35, a: 22, t: 70,  cf: 'normal',  obs: 'Responsabilidade civil do Estado — teoria do risco administrativo.', assIdx: 5, banca: 'FGV' },

    // Português
    { disc: 'Português', tipo: 'questoes', dda: 1,  q: 20, a: 18, t: 40,  cf: 'facil',   obs: 'Interpretação de texto — foi bem! Textos curtos são mais fáceis de analisar.', assIdx: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Português', tipo: 'questoes', dda: 3,  q: 25, a: 22, t: 45,  cf: 'normal',  obs: 'Gramática vai bem. Concordância nominal ok. Verbal ainda dúvido às vezes.', assIdx: 1, banca: 'FCC' },
    { disc: 'Português', tipo: 'questoes', dda: 6,  q: 20, a: 16, t: 40,  cf: 'normal',  obs: 'Ortografia — sempre tem pegadinha de acento. Cuidado com paroxítonas.', assIdx: 2, banca: 'CESPE/CEBRASPE' },
    { disc: 'Português', tipo: 'questoes', dda: 9,  q: 30, a: 26, t: 55,  cf: 'facil',   obs: 'Pontuação e vírgula — foi bem! Regras ficaram mais claras depois de revisar.', assIdx: 3, banca: 'FCC' },
    { disc: 'Português', tipo: 'questoes', dda: 12, q: 20, a: 17, t: 35,  cf: 'normal',  obs: 'Redação oficial — fácil na teoria, difícil na prática do CESPE.', assIdx: 4, banca: 'CESPE/CEBRASPE' },
    { disc: 'Português', tipo: 'simulado', dda: 18, q: 30, a: 26, t: 70,  cf: 'facil',   obs: 'Simulado de Português — 87%! Pontos fortes: interpretação e gramática contextual.', assIdx: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Português', tipo: 'questoes', dda: 24, q: 25, a: 21, t: 45,  cf: 'normal',  obs: 'Textos mais longos hoje. Mantive foco bem. Tempo ficou justo.', assIdx: 0, banca: 'CESPE/CEBRASPE' },

    // Raciocínio Lógico
    { disc: 'Raciocínio Lógico', tipo: 'questoes', dda: 2,  q: 20, a: 13, t: 50,  cf: 'dificil', obs: 'Lógica proposicional — tabela verdade muito confusa ainda. Preciso fixar.', assIdx: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Raciocínio Lógico', tipo: 'teoria',   dda: 5,  q: 0,  a: 0,  t: 70,  cf: 'normal',  obs: 'Estudei conectivos lógicos. Preciso fixar negações com questões.', assIdx: 0, banca: null },
    { disc: 'Raciocínio Lógico', tipo: 'questoes', dda: 8,  q: 25, a: 17, t: 60,  cf: 'normal',  obs: 'Lógica de argumentação — um pouco melhor. Silogismos ficando mais claros.', assIdx: 1, banca: 'CESPE/CEBRASPE' },
    { disc: 'Raciocínio Lógico', tipo: 'questoes', dda: 11, q: 20, a: 14, t: 55,  cf: 'dificil', obs: 'Sequências — algumas pareciam impossíveis. Revisar padrões visuais.', assIdx: 2, banca: 'FCC' },
    { disc: 'Raciocínio Lógico', tipo: 'questoes', dda: 15, q: 20, a: 15, t: 50,  cf: 'normal',  obs: 'Mat. Financeira — juros compostos ficaram mais claros com exemplos práticos.', assIdx: 3, banca: 'CESPE/CEBRASPE' },
    { disc: 'Raciocínio Lógico', tipo: 'questoes', dda: 19, q: 15, a: 11, t: 40,  cf: 'normal',  obs: 'Probabilidade — básico ok, combinatória ainda errando bastante.', assIdx: 4, banca: 'FCC' },
    { disc: 'Raciocínio Lógico', tipo: 'questoes', dda: 27, q: 25, a: 18, t: 55,  cf: 'normal',  obs: 'Revisão geral de RL. Evoluindo! Lógica proposicional melhorou muito.', assIdx: 0, banca: 'CESPE/CEBRASPE' },

    // Informática
    { disc: 'Noções de Informática', tipo: 'questoes', dda: 3,  q: 20, a: 16, t: 40,  cf: 'facil',   obs: 'Word e Excel — bem! Atalhos de teclado CESPE ficaram claros.', assIdx: 0, banca: 'CESPE/CEBRASPE' },
    { disc: 'Noções de Informática', tipo: 'questoes', dda: 7,  q: 20, a: 15, t: 35,  cf: 'normal',  obs: 'Internet — phishing e segurança em foco. Protocolo HTTP vs HTTPS cobrado.', assIdx: 1, banca: 'FCC' },
    { disc: 'Noções de Informática', tipo: 'teoria',   dda: 10, q: 0,  a: 0,  t: 60,  cf: 'facil',   obs: 'Estudei sistemas operacionais. Windows e Linux — diferenças bem marcadas.', assIdx: 2, banca: null },
    { disc: 'Noções de Informática', tipo: 'questoes', dda: 14, q: 20, a: 14, t: 40,  cf: 'dificil', obs: 'Segurança da informação — criptografia, firewall. Muito difícil! Preciso revisar.', assIdx: 3, banca: 'CESPE/CEBRASPE' },
    { disc: 'Noções de Informática', tipo: 'questoes', dda: 20, q: 15, a: 11, t: 35,  cf: 'normal',  obs: 'Redes e TCP/IP. Fui bem com portas conhecidas. IPv4 vs IPv6 cobrado.', assIdx: 4, banca: 'FCC' },
    { disc: 'Noções de Informática', tipo: 'questoes', dda: 28, q: 25, a: 19, t: 50,  cf: 'normal',  obs: 'Revisão de informática. Melhorou bastante vs início do estudo.', assIdx: 0, banca: 'CESPE/CEBRASPE' },
  ];

  sessoesSeed.forEach(s => {
    const discId = discIds[s.disc];
    const assArr = assuntoIds[s.disc];
    const ass = assArr && assArr[s.assIdx] ? assArr[s.assIdx] : null;
    const r = insertSess.run(
      uid, discId, cAgencia, s.tipo, diasAtras(s.dda),
      s.banca || null,
      s.q, s.a, s.q, s.a,
      s.t, s.cf, s.obs
    );
    if (ass) insertSessAss.run(r.lastInsertRowid, ass.id);
  });
  console.log(`${sessoesSeed.length} sessões criadas.`);

  // ── Ciclo semanal atual ───────────────────────────────────────────────────
  const semanaAtual = getMondayISO();
  const insertCiclo = db.prepare(`
    INSERT INTO ciclo_itens
      (user_id, semana_inicio, ordem, dia_semana, disciplina_id, tipo, tempo_estimado,
       quantidade_questoes, descricao, assunto_ids, realizado, adiado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const cicloSeed = [
    { disc: 'Direito Constitucional', dia: 0, tipo: 'questoes', t: 60, q: 30, desc: 'Princípios fundamentais', assIdx: 0, done: 1 },
    { disc: 'Direito Administrativo', dia: 0, tipo: 'questoes', t: 60, q: 35, desc: 'Atos administrativos', assIdx: 1, done: 1 },
    { disc: 'Português',              dia: 1, tipo: 'questoes', t: 45, q: 25, desc: 'Interpretação de texto', assIdx: 0, done: 1 },
    { disc: 'Raciocínio Lógico',      dia: 1, tipo: 'questoes', t: 60, q: 20, desc: 'Lógica proposicional', assIdx: 0, done: 0 },
    { disc: 'Direito Constitucional', dia: 2, tipo: 'teoria',   t: 90, q: 0,  desc: 'Organização do Estado', assIdx: 3, done: 0 },
    { disc: 'Noções de Informática',  dia: 2, tipo: 'questoes', t: 40, q: 20, desc: 'Office e Internet', assIdx: 0, done: 0 },
    { disc: 'Direito Administrativo', dia: 3, tipo: 'questoes', t: 75, q: 40, desc: 'Licitações e contratos', assIdx: 2, done: 0 },
    { disc: 'Português',              dia: 3, tipo: 'questoes', t: 40, q: 20, desc: 'Gramática', assIdx: 1, done: 0 },
    { disc: 'Direito Constitucional', dia: 4, tipo: 'revisao',  t: 45, q: 20, desc: 'Revisão semanal CF', assIdx: 0, done: 0 },
    { disc: 'Raciocínio Lógico',      dia: 4, tipo: 'questoes', t: 50, q: 15, desc: 'Probabilidade', assIdx: 4, done: 0 },
  ];

  cicloSeed.forEach((item, idx) => {
    const discId = discIds[item.disc];
    const assArr = assuntoIds[item.disc];
    const assStr = assArr && assArr[item.assIdx] ? String(assArr[item.assIdx].id) : '';
    insertCiclo.run(uid, semanaAtual, idx + 1, item.dia, discId, item.tipo, item.t, item.q, item.desc, assStr, item.done ? 1 : 0, 0);
  });
  console.log(`${cicloSeed.length} itens de ciclo criados para a semana ${semanaAtual}.`);

  // Config do ciclo
  db.prepare('INSERT OR IGNORE INTO ciclo_config (user_id, disciplina_id, sessoes_por_semana, semana_inicio, horas_semana, dias_estudo, inicio_semana) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    uid, discIds['Direito Constitucional'], 2, semanaAtual, 15, '["seg","ter","qua","qui","sex"]', 'segunda'
  );

})();

console.log('\n✓ Seed concluído com sucesso!');
console.log('  - 5 disciplinas com assuntos e subitens');
console.log('  - 3 concursos (2 ativos, 1 encerrado)');
console.log('  - 2 planejamentos com tarefas');
console.log('  - 35 sessões de estudo (últimos 30 dias)');
console.log('  - 10 itens no ciclo semanal atual (3 concluídos)');
console.log('\n  Acesse o app e recarregue a página (F5).');
