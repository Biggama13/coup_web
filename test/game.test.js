// Testes da logica de jogo. Rode com:  node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/catalog.js');
require('../js/game.js');
const { Game, Catalog } = globalThis.Coup;

// PRNG deterministico (mulberry32)
function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
const make = (storage = null) => new Game({ rng: seeded(7), storage });
function started({ players = 4, iStart = false, storage = null } = {}) {
  const g = make(storage);
  g.newGame({ names: Array.from({ length: players }, (_, i) => 'J' + (i + 1)), iStart });
  return g;
}

test('catalogo: referencias consistentes', () => {
  for (const a of Object.values(Catalog.actions)) {
    for (const id of [...a.claimedBy, ...a.blockedBy]) {
      assert.ok(Catalog.cards[id], a.id + ' referencia carta inexistente: ' + id);
    }
  }
  for (const r of Object.values(Catalog.ruleSets)) {
    r.cardIds.forEach((id) => assert.ok(Catalog.cards[id]));
    [...r.actionIds, r.coupActionId].forEach((id) => assert.ok(Catalog.actions[id]));
  }
  assert.equal(Catalog.defaultRuleSet().deckSize, 15);
});

test('nova partida: 2 cartas, 2 moedas, 13 na corte', () => {
  const g = started();
  assert.equal(g.hand.length, 2);
  assert.equal(g.influence, 2);
  assert.equal(g.coins, 2);
  assert.equal(g.deckCount, 13);
});

test('2 jogadores: quem comeca recebe 1 moeda', () => {
  assert.equal(started({ players: 2, iStart: true }).coins, 1);
  assert.equal(started({ players: 2, iStart: false }).coins, 2);
  assert.equal(started({ players: 3, iStart: true }).coins, 2);
});

test('baralho tem exatamente 3 copias de cada personagem', () => {
  const g = started();
  const all = [...g.state.deck, ...g.hand.map((h) => h.cardId)];
  assert.equal(all.length, 15);
  for (const id of Catalog.defaultRuleSet().cardIds) {
    assert.equal(all.filter((x) => x === id).length, 3);
  }
});

test('moedas: ganhar, gastar e nunca ficar negativo', () => {
  const g = started();
  g.addCoins(3);
  assert.equal(g.coins, 5);
  assert.equal(g.spendCoins(2), 2);
  assert.equal(g.spendCoins(99), 3);
  assert.equal(g.coins, 0);
});

test('golpe obrigatorio com 10+ moedas', () => {
  const g = started();
  g.addCoins(8);
  assert.ok(g.mustCoup);
  assert.ok(g.unavailableReason(Catalog.action('renda')));
  assert.equal(g.unavailableReason(Catalog.action('golpe')), null);
});

test('acao sem moedas suficientes fica indisponivel', () => {
  const g = started();
  g.addCoins(4); // 6 moedas
  assert.match(g.unavailableReason(Catalog.action('golpe')), /Faltam 1 moeda/);
  assert.equal(g.unavailableReason(Catalog.action('assassinar')), null);
});

test('perder influencia ate ser eliminado', () => {
  const g = started();
  g.loseInfluence(g.aliveCards[0].uid);
  assert.equal(g.influence, 1);
  assert.equal(g.isEliminated, false);
  g.loseInfluence(g.aliveCards[0].uid);
  assert.equal(g.isEliminated, true);
  assert.equal(g.lostCards.length, 2);
});

test('contestacao vencida troca a carta e mantem 15 cartas no total', () => {
  const g = started();
  const uid = g.hand[0].uid;
  g.replaceCard(uid);
  assert.equal(g.deckCount, 13);
  assert.equal(g.hand[0].uid, uid);
  assert.equal(g.hand.length + g.deckCount, 15);
});

test('troca do Embaixador: compra 2 e devolve as nao escolhidas', () => {
  const g = started();
  const options = g.beginExchange();
  assert.equal(options.length, 4);
  assert.equal(g.deckCount, 11);
  g.completeExchange([2, 3]);
  assert.equal(g.deckCount, 13);
  assert.equal(g.hand[0].cardId, options[2]);
  assert.equal(g.hand[1].cardId, options[3]);
});

test('troca com 1 influencia mantem apenas 1 carta', () => {
  const g = started();
  g.loseInfluence(g.aliveCards[0].uid);
  const options = g.beginExchange();
  assert.equal(options.length, 3);
  g.completeExchange([1]);
  assert.equal(g.influence, 1);
  assert.equal(g.deckCount, 13); // a carta perdida fica fora da corte
});

test('troca com corte vazia nao quebra', () => {
  const g = started();
  g.state.deck.length = 0;
  const options = g.beginExchange();
  assert.equal(options.length, 2);
  g.completeExchange([0, 1]);
  assert.equal(g.deckCount, 0);
});

test('vitoria quando todos os rivais sao eliminados', () => {
  const g = started({ players: 3 });
  assert.equal(g.hasWon, false);
  g.setEliminated(1, true);
  assert.equal(g.hasWon, false);
  g.setEliminated(2, true);
  assert.equal(g.hasWon, true);
  assert.deepEqual(g.aliveOpponents, []);
});

test('persistencia: salva, restaura e limpa', () => {
  const storage = memStorage();
  const g = started({ storage });
  g.addCoins(3);
  const restored = new Game({ rng: seeded(1), storage });
  assert.ok(restored.load());
  assert.equal(restored.coins, 5);
  assert.deepEqual(restored.hand.map((h) => h.cardId), g.hand.map((h) => h.cardId));
  assert.equal(restored.deckCount, 13);
  g.clear();
  const other = new Game({ rng: seeded(1), storage });
  assert.equal(other.load(), false);
  assert.equal(other.hasGame, false);
});

test('save corrompido e ignorado', () => {
  const storage = memStorage();
  storage.setItem('coup_offline_web_game_v1', '{nao e json');
  const g = new Game({ storage });
  assert.equal(g.load(), false);
  storage.setItem('coup_offline_web_game_v1', '{"hand":1}');
  assert.equal(g.load(), false);
});

test('subscribe notifica mudancas', () => {
  const g = started();
  let n = 0;
  const off = g.subscribe(() => n++);
  g.addCoins(1);
  g.spendCoins(1);
  off();
  g.addCoins(1);
  assert.equal(n, 2);
});
