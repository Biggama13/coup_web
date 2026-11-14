/*
 * Catalogo de cartas, acoes e variantes (dados puros).
 *
 * ============ COMO ADICIONAR UMA CARTA NOVA ============
 * 1. Adicione um objeto em `CARDS` (o `id` define a imagem:
 *    assets/cards/<id>.webp).
 * 2. Adicione em `ACTIONS` as acoes que ela habilita e/ou inclua o id da carta
 *    em `blockedBy` de acoes existentes.
 * 3. Crie (ou edite) um item em `RULE_SETS` com os `cardIds` / `actionIds`.
 * Nenhuma tela precisa mudar: tudo e montado a partir destes dados.
 */
(function (root) {
  'use strict';
  const Coup = (root.Coup = root.Coup || {});

  const CARDS = [
    { id: 'duque', name: 'Duque', color: '#8E44AD', emoji: '👑',
      description: 'Taxa 3 moedas e bloqueia a Ajuda Externa.' },
    { id: 'assassino', name: 'Assassino', color: '#3B3B4F', emoji: '🗡️',
      description: 'Paga 3 moedas para eliminar uma influência.' },
    { id: 'capitao', name: 'Capitão', color: '#2E86DE', emoji: '⚓',
      description: 'Extorque 2 moedas e bloqueia extorsões.' },
    { id: 'embaixador', name: 'Embaixador', color: '#27AE60', emoji: '📜',
      description: 'Troca cartas com a corte e bloqueia extorsões.' },
    { id: 'condessa', name: 'Condessa', color: '#E74C3C', emoji: '💃',
      description: 'Bloqueia tentativas de assassinato.' },
  ];

  // effect: 'gain' (ganha moedas) | 'steal' (rouba) | 'lose' (alvo perde
  // influencia) | 'exchange' (troca com a corte)
  const ACTIONS = [
    { id: 'renda', name: 'Renda', effect: 'gain', amount: 1,
      description: 'Pegue 1 moeda. Não pode ser bloqueada nem contestada.' },
    { id: 'ajuda_externa', name: 'Ajuda Externa', effect: 'gain', amount: 2,
      blockedBy: ['duque'], anyoneCanBlock: true,
      description: 'Pegue 2 moedas. Qualquer jogador pode bloquear como Duque.' },
    { id: 'golpe', name: 'Golpe de Estado', effect: 'lose', cost: 7,
      needsTarget: true,
      description: 'Pague 7 moedas: o alvo perde uma influência. Não pode ser ' +
        'bloqueado. Obrigatório com 10 moedas ou mais.' },
    { id: 'taxar', name: 'Taxar', effect: 'gain', amount: 3,
      claimedBy: ['duque'],
      description: 'Como Duque: pegue 3 moedas.' },
    { id: 'assassinar', name: 'Assassinar', effect: 'lose', cost: 3,
      needsTarget: true, claimedBy: ['assassino'], blockedBy: ['condessa'],
      description: 'Como Assassino: pague 3 moedas e o alvo perde uma ' +
        'influência. A Condessa do alvo pode bloquear.' },
    { id: 'extorquir', name: 'Extorquir', effect: 'steal', amount: 2,
      needsTarget: true, claimedBy: ['capitao'],
      blockedBy: ['capitao', 'embaixador'],
      description: 'Como Capitão: roube 2 moedas de outro jogador. O alvo ' +
        'pode bloquear como Capitão ou Embaixador.' },
    { id: 'trocar', name: 'Trocar', effect: 'exchange',
      claimedBy: ['embaixador'],
      description: 'Como Embaixador: compre 2 cartas da corte, escolha quais ' +
        'manter e devolva o resto ao baralho.' },
  ];

  const RULE_SETS = [
    {
      id: 'classico',
      name: 'Coup Clássico',
      description: '15 cartas: 3 de cada personagem.',
      cardIds: ['duque', 'assassino', 'capitao', 'embaixador', 'condessa'],
      actionIds: ['renda', 'ajuda_externa', 'golpe', 'taxar', 'assassinar',
        'extorquir', 'trocar'],
      coupActionId: 'golpe',
      copiesPerCard: 3,
      startingInfluence: 2,
      startingCoins: 2,
      mandatoryCoupAt: 10,
    },
  ];

  function indexBy(list, defaults) {
    const out = {};
    for (const item of list) out[item.id] = Object.assign({}, defaults, item);
    return out;
  }

  const cards = indexBy(CARDS, {});
  const actions = indexBy(ACTIONS, {
    cost: 0, amount: 0, needsTarget: false, claimedBy: [], blockedBy: [],
    anyoneCanBlock: false,
  });
  const ruleSets = indexBy(RULE_SETS, {});
  for (const a of Object.values(actions)) {
    a.isChallengeable = a.claimedBy.length > 0;
    a.isBlockable = a.blockedBy.length > 0;
  }
  for (const r of Object.values(ruleSets)) {
    r.deckSize = r.cardIds.length * r.copiesPerCard;
  }

  Coup.Catalog = {
    cards, actions, ruleSets,
    card: (id) => cards[id],
    action: (id) => actions[id],
    ruleSet: (id) => ruleSets[id],
    defaultRuleSet: () => ruleSets[RULE_SETS[0].id],
    assetPath: (id) => 'assets/cards/' + id + '.webp',
    backPath: 'assets/cards/verso.webp',
  };
})(typeof window !== 'undefined' ? window : globalThis);
