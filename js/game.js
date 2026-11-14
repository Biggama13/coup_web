/*
 * Regras da partida local: mao, moedas, baralho da corte e persistencia.
 * Tudo offline; cada celular sorteia suas cartas de forma independente.
 * Sem dependencia de DOM, entao roda tambem no Node (testes).
 */
(function (root) {
  'use strict';
  const Coup = (root.Coup = root.Coup || {});
  const STORAGE_KEY = 'coup_offline_web_game_v1';

  class Game {
    /**
     * @param {object} [opts]
     * @param {object} [opts.catalog]  catalogo (padrao: Coup.Catalog)
     * @param {function} [opts.rng]    () => [0,1) (padrao: Math.random)
     * @param {object} [opts.storage]  {getItem,setItem,removeItem}
     */
    constructor(opts = {}) {
      this.catalog = opts.catalog || Coup.Catalog;
      this.rng = opts.rng || Math.random;
      this.storage = opts.storage !== undefined ? opts.storage : safeStorage();
      this.state = null;
      this.pendingDrawn = [];
      this.listeners = new Set();
    }

    // ---------------------------------------------------------- eventos
    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }
    _emit() {
      for (const fn of [...this.listeners]) fn(this);
    }
    _changed() {
      this._emit();
      this._save();
    }

    // ----------------------------------------------------------- leitura
    get hasGame() { return this.state !== null; }
    get ruleSet() { return this.catalog.ruleSet(this.state.ruleSetId); }
    get playerNames() { return this.state.playerNames; }
    get eliminated() { return this.state.eliminated; }
    get hand() { return this.state.hand; }
    get aliveCards() { return this.state.hand.filter((h) => !h.lost); }
    get lostCards() { return this.state.hand.filter((h) => h.lost); }
    get coins() { return this.state.coins; }
    get deckCount() { return this.state.deck.length; }
    get influence() { return this.aliveCards.length; }
    get log() { return this.state.log; }
    get isEliminated() { return this.hasGame && this.influence === 0; }

    /** Venceu: todos os outros jogadores foram marcados como eliminados. */
    get hasWon() {
      if (!this.hasGame || this.isEliminated) return false;
      const s = this.state;
      for (let i = 1; i < s.playerNames.length; i++) {
        if (!s.eliminated[i]) return false;
      }
      return s.playerNames.length > 1;
    }

    get mustCoup() {
      return this.hasGame && this.coins >= this.ruleSet.mandatoryCoupAt;
    }

    /** Indices dos adversarios ainda vivos. */
    get aliveOpponents() {
      const out = [];
      for (let i = 1; i < this.state.playerNames.length; i++) {
        if (!this.state.eliminated[i]) out.push(i);
      }
      return out;
    }

    /** Motivo pelo qual a acao nao pode ser escolhida agora (ou null). */
    unavailableReason(a) {
      if (this.mustCoup && a.id !== this.ruleSet.coupActionId) {
        return 'Você tem ' + this.ruleSet.mandatoryCoupAt +
          '+ moedas: precisa dar um Golpe!';
      }
      if (this.coins < a.cost) {
        const falta = a.cost - this.coins;
        return 'Faltam ' + falta + (falta === 1 ? ' moeda' : ' moedas');
      }
      if (a.needsTarget && this.aliveOpponents.length === 0) {
        return 'Sem alvos vivos';
      }
      return null;
    }

    /** Primeira carta viva da mao que seja de um dos tipos informados. */
    holding(cardIds) {
      return this.state.hand.find((h) => !h.lost && cardIds.includes(h.cardId)) || null;
    }

    // ------------------------------------------------------- nova partida
    /** Comeca uma partida. `names[0]` e o dono do celular. */
    newGame({ names, iStart = false, ruleSetId } = {}) {
      const rs = ruleSetId ? this.catalog.ruleSet(ruleSetId)
        : this.catalog.defaultRuleSet();
      const deck = [];
      for (const id of rs.cardIds) {
        for (let i = 0; i < rs.copiesPerCard; i++) deck.push(id);
      }
      this._shuffle(deck);

      let uid = 0;
      const hand = [];
      for (let i = 0; i < rs.startingInfluence; i++) {
        hand.push({ uid: uid++, cardId: deck.pop(), lost: false });
      }
      // Variante de 2 jogadores: quem comeca recebe apenas 1 moeda.
      const coins = names.length === 2 && iStart ? 1 : rs.startingCoins;

      this.pendingDrawn = [];
      this.state = {
        ruleSetId: rs.id,
        playerNames: names.slice(),
        eliminated: names.map(() => false),
        hand, deck, coins, nextUid: uid, log: [],
      };
      this._log('Partida iniciada com ' + names.length + ' jogadores.');
      this._changed();
    }

    // -------------------------------------------------------------- moedas
    addCoins(n, why) {
      if (n <= 0) return;
      this.state.coins += n;
      this._log(why || '+' + n + (n === 1 ? ' moeda' : ' moedas'));
      this._changed();
    }

    /** Gasta ate n moedas. Retorna quantas foram realmente gastas. */
    spendCoins(n, why) {
      if (n <= 0) return 0;
      const spent = Math.min(n, this.state.coins);
      this.state.coins -= spent;
      this._log(why || '-' + spent + (spent === 1 ? ' moeda' : ' moedas'));
      this._changed();
      return spent;
    }

    // -------------------------------------------------------------- cartas
    /** Vira uma carta para cima: a influencia foi perdida. */
    loseInfluence(uid) {
      const h = this.state.hand.find((c) => c.uid === uid);
      if (!h || h.lost) return;
      h.lost = true;
      this._log('Perdeu a influência: ' + this.catalog.card(h.cardId).name + '.');
      this._changed();
    }

    /**
     * Vencer uma contestacao: devolve a carta revelada ao baralho, embaralha
     * e compra uma nova no mesmo lugar. Retorna o id da nova carta.
     */
    replaceCard(uid) {
      const h = this.state.hand.find((c) => c.uid === uid);
      const old = h.cardId;
      this.state.deck.push(old);
      this._shuffle(this.state.deck);
      h.cardId = this.state.deck.pop();
      this._log('Revelou ' + this.catalog.card(old).name +
        ', devolveu à corte e comprou outra.');
      this._changed();
      return h.cardId;
    }

    // --------------------------------------------------------------- troca
    /**
     * Embaixador: compra ate 2 cartas da corte. Retorna as opcoes de escolha
     * (cartas vivas da mao + cartas compradas). Nao notifica: o estado e
     * salvo ao concluir a troca.
     */
    beginExchange() {
      this.pendingDrawn = [];
      for (let i = 0; i < 2 && this.state.deck.length > 0; i++) {
        this.pendingDrawn.push(this.state.deck.pop());
      }
      return this.aliveCards.map((h) => h.cardId).concat(this.pendingDrawn);
    }

    /**
     * Conclui a troca mantendo as opcoes de indice `keep` (mesma quantidade
     * de cartas vivas). O resto volta ao baralho, que e embaralhado.
     */
    completeExchange(keep) {
      const alive = this.aliveCards;
      const options = alive.map((h) => h.cardId).concat(this.pendingDrawn);
      if (keep.length !== alive.length) {
        throw new Error('keep deve ter ' + alive.length + ' itens');
      }
      const keepSet = new Set(keep);
      alive.forEach((h, i) => { h.cardId = options[keep[i]]; });
      options.forEach((id, i) => {
        if (!keepSet.has(i)) this.state.deck.push(id);
      });
      this._shuffle(this.state.deck);
      this.pendingDrawn = [];
      this._log('Trocou cartas com a corte.');
      this._changed();
    }

    // ----------------------------------------------------- outros jogadores
    setEliminated(index, value) {
      const s = this.state;
      if (index <= 0 || index >= s.eliminated.length) return;
      s.eliminated[index] = value;
      this._log(s.playerNames[index] +
        (value ? ' foi eliminado.' : ' voltou ao jogo.'));
      this._changed();
    }

    // -------------------------------------------------------- persistencia
    load() {
      try {
        const raw = this.storage && this.storage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const s = JSON.parse(raw);
        if (!s || !Array.isArray(s.hand) || !Array.isArray(s.deck) ||
            !Array.isArray(s.playerNames) || !this.catalog.ruleSets[s.ruleSetId]) {
          return false;
        }
        this.state = s;
        this.pendingDrawn = [];
        this._emit();
        return true;
      } catch (_) {
        this.state = null; // save corrompido: comeca do zero
        return false;
      }
    }

    hasSavedGame() {
      try { return !!(this.storage && this.storage.getItem(STORAGE_KEY)); }
      catch (_) { return false; }
    }

    clear() {
      this.state = null;
      this.pendingDrawn = [];
      try { this.storage && this.storage.removeItem(STORAGE_KEY); } catch (_) {}
      this._emit();
    }

    // ------------------------------------------------------------ internos
    _log(msg) {
      this.state.log.push(msg);
      if (this.state.log.length > 80) this.state.log.shift();
    }

    _save() {
      if (!this.state || !this.storage) return;
      try { this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state)); }
      catch (_) { /* sem armazenamento: o jogo continua em memoria */ }
    }

    /** Fisher-Yates. */
    _shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
  }

  function safeStorage() {
    try {
      const s = root.localStorage;
      const k = '__coup_test__';
      s.setItem(k, '1');
      s.removeItem(k);
      return s;
    } catch (_) {
      return null;
    }
  }

  Coup.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
