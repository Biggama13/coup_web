/* Telas: Inicio, Nova partida, Mesa, Regras + inicializacao. */
(function (root) {
  'use strict';
  const Coup = root.Coup;
  const { h, OutlinedText, Btn, Panel, Card3D, DeckPile, CoinStack, Router, dialog,
    openSheet, toast, clamp, ActionTile, FlowShell, InfluencePicker, MyTurnFlow,
    OtherActsFlow } = Coup;

  let installPrompt = null;

  function iconBtn(symbol, label, onClick) {
    return h('button', { type: 'button', class: 'iconbtn', 'aria-label': label,
      on: { click: onClick } }, symbol);
  }

  function TopBar(title, left, right = []) {
    return h('div', { class: 'topbar' }, left,
      h('div', { class: 'topbar-title' }, OutlinedText(title, { size: 24 })),
      right.length ? right : h('div', { class: 'iconbtn spacer' }));
  }

  // ================================================================== INICIO
  function HomeScreen(game) {
    const el = h('div', { class: 'screen home' });

    function startNew() {
      Router.push(SetupScreen(game));
    }
    async function askNew() {
      if (game.hasGame) {
        const ok = await dialog({
          title: 'Começar nova partida?',
          text: 'Já existe uma partida salva. Ela será substituída quando você iniciar a nova.',
          buttons: [
            { label: 'Continuar a atual', value: 'keep', variant: 'green' },
            { label: 'Nova partida', value: 'new', variant: 'cream' },
          ],
        });
        if (ok === 'keep') { Router.push(TableScreen(game)); return; }
        if (ok !== 'new') return;
      }
      startNew();
    }

    function build() {
      el.innerHTML = '';
      const ids = game.catalog.defaultRuleSet().cardIds;
      const fanIds = [ids[0], ids[Math.floor(ids.length / 2)], ids[ids.length - 1]];
      const fan = h('div', { class: 'fan' }, fanIds.map((id, i) => {
        const c = Card3D({ cardId: id, faceUp: false, width: 150, onTap: null });
        setTimeout(() => c.setFaceUp(true), 450 + i * 250);
        const dx = (i - 1) * 90;
        const dy = i === 1 ? -8 : 10;
        return h('div', { class: 'fan-card', style: {
          transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) rotate(' + (i - 1) * 12.6 + 'deg)',
          zIndex: i === 1 ? 2 : 1 } }, c.el);
      }));

      el.append(
        h('div', { class: 'logo' }, OutlinedText('COUP', { size: 84, color: 'var(--gold)', stroke: 14 })),
        h('div', { class: 'tagline' }, 'Blefe, roube e domine a corte!'),
        fan,
        h('div', { class: 'home-actions' },
          game.hasGame ? Btn({ label: 'CONTINUAR PARTIDA', icon: '▶️', variant: 'green',
            onClick: () => Router.push(TableScreen(game)) }) : null,
          Btn({ label: 'NOVA PARTIDA', icon: '🃏', onClick: askNew }),
          Btn({ label: 'COMO JOGAR', icon: '📖', variant: 'blue',
            onClick: () => Router.push(RulesScreen(game)) }),
          installPrompt ? Btn({ label: 'INSTALAR NO CELULAR', icon: '📲', variant: 'purple', small: true,
            onClick: async () => {
              const p = installPrompt;
              installPrompt = null;
              p.prompt();
              try { await p.userChoice; } catch (_) { /* ignora */ }
              build();
            } }) : null));
    }
    build();
    return { el, onShow: build, rebuild: build };
  }

  // ============================================================ NOVA PARTIDA
  function SetupScreen(game) {
    const MIN = 2, MAX = 6;
    let count = 4;
    let iStart = false;
    const names = ['', 'Jogador 2', 'Jogador 3', 'Jogador 4', 'Jogador 5', 'Jogador 6'];
    const chips = h('div', { class: 'count-row' });
    const namesBox = h('div');
    const extra = h('div');

    function renderChips() {
      chips.innerHTML = '';
      for (let n = MIN; n <= MAX; n++) {
        chips.appendChild(h('button', { type: 'button',
          class: 'chip-num' + (n === count ? ' sel' : ''),
          on: { click: () => { count = n; Coup.haptic(8); renderChips(); renderNames(); renderExtra(); } },
        }, String(n)));
      }
    }
    function renderNames() {
      namesBox.innerHTML = '';
      for (let i = 0; i < count; i++) {
        namesBox.appendChild(h('input', {
          class: 'name-input', maxlength: 14, value: names[i],
          placeholder: i === 0 ? 'Seu nome' : 'Jogador ' + (i + 1),
          'aria-label': i === 0 ? 'Seu nome' : 'Jogador ' + (i + 1),
          on: { input: (e) => { names[i] = e.target.value; } },
        }));
      }
    }
    function renderExtra() {
      extra.innerHTML = '';
      if (count !== 2) return;
      const sw = h('button', { type: 'button', class: 'switch', role: 'switch',
        'aria-checked': String(iStart), 'aria-label': 'Eu começo a partida',
        on: { click: () => { iStart = !iStart; sw.setAttribute('aria-checked', String(iStart)); } } });
      extra.appendChild(h('div', { style: 'margin-top:18px' }, Panel(
        h('div', { class: 'switch-row' },
          h('div', { class: 'txt' }, 'Eu começo a partida',
            h('small', null, 'Em partidas de 2 jogadores, quem começa recebe só 1 moeda; o outro recebe 2.')),
          sw))));
    }
    function start() {
      const list = [];
      for (let i = 0; i < count; i++) {
        const t = (names[i] || '').trim();
        list.push(t || (i === 0 ? 'Você' : 'Jogador ' + (i + 1)));
      }
      game.newGame({ names: list, iStart });
      Router.replace(TableScreen(game));
    }

    renderChips(); renderNames(); renderExtra();
    const el = h('div', { class: 'screen' },
      TopBar('Nova partida', iconBtn('←', 'Voltar', () => Router.back())),
      h('div', { class: 'scroll' },
        Panel([h('h3', { style: 'text-align:center' }, 'Quantos jogadores?'), chips]),
        h('div', { style: 'margin-top:18px' }, Panel([
          h('h3', null, 'Nomes na mesa'),
          h('div', { class: 'muted' }, 'Os nomes dos adversários aparecem nos menus de ação e alvo.'),
          namesBox])),
        extra),
      h('div', { class: 'footer' }, Btn({ label: 'DISTRIBUIR CARTAS!', icon: '🃏', onClick: start })));
    return { el };
  }

  // ====================================================================== MESA
  function TableScreen(game) {
    const cat = game.catalog;
    const peeking = new Set();
    const cardObjs = new Map();
    let wakeLock = null;

    // ----- pecas
    const opponents = h('div', { class: 'opponents' });
    const hand = h('div', { class: 'hand' });
    const n = game.hand.length;
    const cardW = Math.round(clamp((Math.min(root.innerWidth, 520) - 40 - 14 * (n - 1)) / n, 96, 168));
    game.hand.forEach((hc) => {
      const c = Card3D({ cardId: hc.cardId, faceUp: hc.lost, lost: hc.lost, width: cardW,
        onTap: () => {
          if (game.hand.find((x) => x.uid === hc.uid).lost) return;
          if (!peeking.delete(hc.uid)) peeking.add(hc.uid);
          update();
        } });
      cardObjs.set(hc.uid, c);
      hand.appendChild(c.el);
    });
    const peekBtn = Btn({ label: 'ESPIAR MINHAS CARTAS', icon: '👁️', variant: 'purple', small: true,
      onClick: () => {
        const alive = game.aliveCards;
        const allUp = alive.every((x) => peeking.has(x.uid));
        if (allUp) peeking.clear(); else alive.forEach((x) => peeking.add(x.uid));
        update();
      } });

    const deck = DeckPile({ count: game.deckCount, width: 92 });
    const coins = CoinStack({ count: game.coins, width: 220 });
    const coinLabel = h('div');
    const mustCoup = h('div', { class: 'must-coup' }, '⚠ Golpe obrigatório!');
    const myTurn = Btn({ label: 'MINHA VEZ', icon: '▶️', onClick: () => openFlow(MyTurnFlow(game)) });
    const otherActs = Btn({ label: 'OUTRO JOGADOR AGIU', icon: '📣', variant: 'blue',
      onClick: () => openFlow(OtherActsFlow(game)) });
    const overlay = h('div', { class: 'overlay', hidden: true });

    // ----- acoes
    function openFlow(flow) {
      Router.push(flow, (msg) => {
        peeking.clear();
        update();
        if (msg) toast(msg);
      });
    }

    async function leave() {
      const choice = await dialog({
        title: 'Sair da mesa',
        text: 'A partida fica salva e você pode continuar depois. Ou encerre para descartar tudo.',
        buttons: [
          { label: 'Salvar e sair', value: 'save', variant: 'green' },
          { label: 'Encerrar partida', value: 'end', variant: 'red' },
          { label: 'Voltar ao jogo', value: 'cancel' },
        ],
      });
      if (choice === 'end') { game.clear(); Router.pop(); }
      else if (choice === 'save') Router.pop();
    }

    async function toggleEliminated(i) {
      const out = game.eliminated[i];
      const ok = await dialog({
        title: out ? 'Devolver ' + game.playerNames[i] + ' ao jogo?'
          : 'Marcar ' + game.playerNames[i] + ' como eliminado?',
        buttons: [
          { label: 'Confirmar', value: true, variant: 'green' },
          { label: 'Cancelar', value: false },
        ],
      });
      if (ok) game.setEliminated(i, !out);
    }

    function openManual() {
      let close;
      const run = (fn) => () => fn();
      const content = h('div', null,
        h('h3', null, 'Ajustes manuais'),
        h('div', { class: 'muted' }, 'Use quando algo acontecer fora dos fluxos guiados.'),
        h('div', { class: 'stack-col' },
          h('div', { class: 'row2' },
            Btn({ label: '+1', icon: '➕', variant: 'green', small: true,
              onClick: run(() => game.addCoins(1, 'Ajuste manual: +1.')) }),
            Btn({ label: '-1', icon: '➖', variant: 'orange', small: true,
              onClick: run(() => game.spendCoins(1, 'Ajuste manual: -1.')) })),
          Btn({ label: 'PERDER UMA INFLUÊNCIA', icon: '💔', variant: 'red', small: true,
            disabled: game.influence === 0,
            onClick: () => { close(); openFlow(ManualLoseScreen(game)); } }),
          Btn({ label: 'HISTÓRICO DA PARTIDA', icon: '🕘', variant: 'blue', small: true,
            onClick: () => { close(); showLog(); } })));
      close = openSheet(content);
    }

    function showLog() {
      openSheet(h('div', null, h('h3', null, 'Histórico'),
        h('ul', null, [...game.log].reverse().map((l) => h('li', null, '• ' + l)))));
    }

    // ----- atualizacao
    function update() {
      if (!game.hasGame) return;
      // adversarios
      opponents.innerHTML = '';
      for (let i = 1; i < game.playerNames.length; i++) {
        const out = game.eliminated[i];
        opponents.appendChild(h('button', { type: 'button', class: 'opp' + (out ? ' out' : ''),
          on: { click: () => toggleEliminated(i) } },
        (out ? '☠ ' : '') + game.playerNames[i]));
      }
      // cartas
      game.hand.forEach((hc) => {
        const c = cardObjs.get(hc.uid);
        if (!c) return;
        c.setCard(hc.cardId);
        c.setLost(hc.lost);
        c.setFaceUp(hc.lost || peeking.has(hc.uid));
      });
      const anyUp = game.aliveCards.some((x) => peeking.has(x.uid));
      peekBtn.lastChild.textContent = anyUp ? 'ESCONDER CARTAS' : 'ESPIAR MINHAS CARTAS';
      peekBtn.firstChild.textContent = anyUp ? '🙈' : '👁️';
      peekBtn.disabled = game.influence === 0;
      // tesouro
      deck.setCount(game.deckCount);
      coins.setCount(game.coins);
      coinLabel.replaceChildren(OutlinedText(
        game.coins + ' ' + (game.coins === 1 ? 'MOEDA' : 'MOEDAS'),
        { size: 24, color: 'var(--gold)' }));
      mustCoup.style.display = game.mustCoup ? '' : 'none';
      myTurn.disabled = game.isEliminated;
      otherActs.disabled = game.isEliminated || game.aliveOpponents.length === 0;
      // fim de jogo
      overlay.hidden = !(game.isEliminated || game.hasWon);
      if (!overlay.hidden) {
        const won = game.hasWon;
        overlay.replaceChildren(
          h('div', { class: 'big' }, won ? '👑' : '💀'),
          OutlinedText(won ? 'VOCÊ VENCEU!' : 'VOCÊ FOI ELIMINADO',
            { size: 38, color: won ? 'var(--gold)' : 'var(--red)', stroke: 10 }),
          h('p', null, won ? 'A corte é sua. Todos os rivais foram eliminados.'
            : 'Fim da linha para você. Acompanhe os rivais!'),
          Btn({ label: 'SAIR DA MESA', icon: '🚪', variant: won ? '' : 'red', onClick: leave }));
      }
    }

    const off = game.subscribe(update);

    async function lockScreen() {
      try {
        if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
      } catch (_) { /* nao suportado ou negado */ }
    }
    const onVis = () => { if (document.visibilityState === 'visible') lockScreen(); };
    document.addEventListener('visibilitychange', onVis);
    lockScreen();

    const el = h('div', { class: 'screen table' },
      h('div', { class: 'topbar' },
        iconBtn('🏠', 'Sair da mesa', leave),
        h('div', { class: 'topbar-title' }, OutlinedText(game.playerNames[0], { size: 22 })),
        iconBtn('📖', 'Regras', () => Router.push(RulesScreen(game))),
        iconBtn('🎛️', 'Ajustes', openManual)),
      opponents,
      h('div', { class: 'scroll' },
        hand,
        h('div', { class: 'center', style: 'margin-top:6px' }, peekBtn),
        h('div', { class: 'treasury' },
          h('div', { class: 'col' }, deck.el, h('div', { class: 'lbl' }, 'CORTE')),
          h('div', { class: 'col coins-col' }, coins.el, coinLabel, mustCoup))),
      h('div', { class: 'table-actions' }, myTurn, otherActs),
      overlay);
    update();

    return {
      el,
      onBack: () => { leave(); return true; },
      onDestroy() {
        off();
        document.removeEventListener('visibilitychange', onVis);
        try { wakeLock && wakeLock.release(); } catch (_) { /* ignora */ }
      },
    };
  }

  /** Tela simples para perder uma influencia fora dos fluxos guiados. */
  function ManualLoseScreen(game) {
    const shell = FlowShell('Perder influência');
    shell.show(InfluencePicker(game, { onPicked: (uid) => {
      game.loseInfluence(uid);
      Router.pop('Você perdeu uma influência.');
    } }));
    return { el: shell.el };
  }

  // ==================================================================== REGRAS
  function RulesScreen(game) {
    const cat = game.catalog;
    const rs = cat.defaultRuleSet();
    const section = (title, lines) => h('div', { class: 'section' }, Panel([
      h('h3', null, title), h('ul', null, lines.map((l) => h('li', null, l)))]));

    const el = h('div', { class: 'screen' },
      TopBar('Como jogar', iconBtn('←', 'Voltar', () => Router.back())),
      h('div', { class: 'scroll' },
        section('🎯 Objetivo', ['Seja o último jogador com influência (cartas viradas para baixo) ' +
          'na mesa. Não existe segundo lugar!']),
        section('🃏 Preparação', [
          'Cada jogador começa com ' + rs.startingInfluence + ' cartas secretas e ' + rs.startingCoins + ' moedas.',
          'O baralho da corte tem ' + rs.deckSize + ' cartas (' + rs.copiesPerCard + ' de cada personagem).',
          'Com 2 jogadores, quem começa recebe só 1 moeda.',
          'Neste app cada celular sorteia as próprias cartas, sem conexão com os outros aparelhos. ' +
            'Podem aparecer mais de ' + rs.copiesPerCard + ' cópias de uma carta na mesa.']),
        section('🔄 O turno', [
          'Na sua vez, escolha UMA ação. Os outros jogadores podem contestar ou bloquear, e depois a ' +
            'vez passa para o próximo.',
          'Você pode mentir! Ao usar uma ação de personagem, basta dizer que tem a carta, mesmo sem ter.',
          'Com ' + rs.mandatoryCoupAt + ' ou mais moedas no início da vez, o Golpe é obrigatório.']),
        h('div', { class: 'h-center' }, OutlinedText('Ações', { size: 24 })),
        h('div', { class: 'stack-col', style: 'margin-bottom:16px' }, rs.actionIds.map((id) =>
          ActionTile({ action: cat.action(id), catalog: cat, onTap: () => {} }))),
        section('⚖️ Contestação', [
          'Qualquer jogador pode contestar quem usa uma ação de personagem ou um bloqueio, dizendo que é blefe.',
          'Se o contestado TEM a carta: mostra-a, devolve ao baralho da corte, embaralha e compra outra. ' +
            'Quem contestou perde uma influência.',
          'Se estava blefando: perde uma influência e a ação falha. Moedas que ele pagaria pela ação voltam.',
          'Ações gerais (Renda, Ajuda Externa e Golpe) não podem ser contestadas.']),
        section('🛡️ Bloqueio', [
          'Ajuda Externa: qualquer jogador pode bloquear dizendo ser o Duque.',
          'Assassinato: só o alvo bloqueia, como Condessa. As 3 moedas continuam gastas.',
          'Extorsão: só o alvo bloqueia, como Capitão ou Embaixador.',
          'O Golpe nunca pode ser bloqueado.',
          'Um bloqueio também pode ser contestado.']),
        section('💀 Perder influência', [
          'Escolha uma de suas cartas e vire-a para cima: ela sai do jogo e todos podem vê-la.',
          'Sem cartas, você está eliminado.',
          'É possível perder duas influências no mesmo turno: contestar um Assassino e perder, e depois ' +
            'sofrer o assassinato.']),
        h('div', { class: 'h-center' }, OutlinedText('Personagens', { size: 24 })),
        h('div', { class: 'wrap-cards', style: 'margin-bottom:22px' }, rs.cardIds.map((id) => h('div', { class: 'item' },
          Card3D({ cardId: id, faceUp: true, width: 140, floating: false }).el,
          cat.card(id).description))),
        section('📱 Como usar o app', [
          'Toque em "Espiar minhas cartas" para ver sua mão e esconda antes de passar o celular.',
          '"Minha vez": o app guia sua ação, contestação, bloqueio e coleta de moedas.',
          '"Outro jogador agiu": informe o que ele anunciou e escolha contestar, bloquear ou deixar ' +
            'passar. O app diz se você estava blefando e tira moedas ou cartas quando preciso.',
          'Toque no nome de um rival para marcar quando ele for eliminado. Quando todos caírem, você vence.',
          'O botão de ajustes (barra superior) permite corrigir moedas ou perder uma carta manualmente.'])));
    return { el };
  }

  // ================================================================== BOOT
  function buildBackdrop() {
    const bd = document.getElementById('backdrop');
    for (let i = 0; i < 14; i++) {
      const sx = Math.sin(i * 12.9898) * 0.5 + 0.5;
      const sy = Math.cos(i * 12.9898 * 1.7) * 0.5 + 0.5;
      const size = 10 + (i % 4) * 8;
      const gold = i % 2 === 0;
      bd.appendChild(h('i', { class: i % 3 === 0 ? 'star' : '', style: {
        '--x': (sx * 100).toFixed(1) + '%', '--y': (sy * 100).toFixed(1) + '%',
        '--s': size * (i % 3 === 0 ? 1.8 : 1) + 'px', '--c': gold ? '#ffc93c' : '#9b59f6',
        '--d': (14 + (i % 5) * 3) + 's' } }));
    }
  }

  function boot() {
    buildBackdrop();
    const host = document.getElementById('app');
    const game = new Coup.Game();
    game.load();
    Router.init(host);
    Router.setRoot(HomeScreen(game));
    root.Coup.game = game; // util para depuracao/testes

    root.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      installPrompt = e;
      const top = Router.top;
      if (top && top.rebuild) top.rebuild();
    });
    try {
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register('sw.js').catch(() => { /* offline-first opcional */ });
      }
    } catch (_) { /* ambiente sem service worker */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
