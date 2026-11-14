/* Fluxos guiados: Minha vez, Outro jogador agiu, Troca do Embaixador. */
(function (root) {
  'use strict';
  const Coup = (root.Coup = root.Coup || {});
  const { h, OutlinedText, Btn, Panel, Card3D, CoinStack, Router } = Coup;

  const PALETTE = ['blue', 'orange', 'green', 'purple', 'red'];

  // ------------------------------------------------------------ componentes
  /** Cartao de uma acao na lista de escolha. */
  function ActionTile({ action, catalog, reason, onTap }) {
    const first = action.claimedBy.length ? catalog.card(action.claimedBy[0]) : null;
    const names = action.claimedBy.map((id) => catalog.card(id).name);
    const el = h('button', {
      type: 'button',
      class: 'panel tile tap' + (reason ? ' disabled' : ''),
      style: { '--ac': first ? first.color : 'var(--gold)' },
      disabled: !!reason,
    },
    h('div', { class: 'ava' }, first ? first.emoji : '🪙'),
    h('div', { class: 'info' },
      h('div', { class: 'nm' }, action.name),
      names.length ? h('div', { class: 'as' }, 'Como ' + names.join(' ou ')) : null,
      h('div', { class: 'ds' + (reason ? ' why' : '') }, reason || action.description)),
    action.cost > 0 ? h('div', { class: 'cost' }, '-' + action.cost + '🪙') : null);
    el.addEventListener('click', () => { if (!reason) { Coup.haptic(10); onTap(); } });
    return el;
  }

  /** Passo: pergunta grande + conteudo rolavel + botoes embaixo. */
  function StepLayout({ headline, subtitle, body, buttons = [] }) {
    const scroll = h('div', { class: 'scroll' },
      Panel([h('div', { class: 'headline' }, headline),
        subtitle ? h('div', { class: 'subtitle' }, subtitle) : null]),
      body ? h('div', { class: 'step-body' }, body) : null);
    return h('div', { class: 'step' }, scroll,
      buttons.length ? h('div', { class: 'footer' }, buttons) : null);
  }

  /** Moldura comum dos fluxos (botao fechar, titulo, area do passo). */
  function FlowShell(title) {
    let canClose = true;
    const closeBtn = h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Fechar',
      on: { click: () => Router.back() } }, '✕');
    const body = h('div', { class: 'flow-body' });
    const el = h('div', { class: 'screen flow' },
      h('div', { class: 'topbar' }, closeBtn,
        h('div', { class: 'topbar-title' }, OutlinedText(title, { size: 22 })),
        h('div', { class: 'iconbtn spacer' })),
      body);
    return {
      el,
      get canClose() { return canClose; },
      setCanClose(v) { canClose = v; closeBtn.style.visibility = v ? 'visible' : 'hidden'; },
      show(stepEl) {
        body.innerHTML = '';
        stepEl.classList.add('step-in');
        body.appendChild(stepEl);
      },
    };
  }

  /** Mostra as cartas vivas viradas para cima e deixa escolher qual perder. */
  function InfluencePicker(game, { headline = 'Escolha uma carta para perder',
    subtitle = 'Esconda a tela dos outros jogadores!', onPicked }) {
    const alive = game.aliveCards;
    let selected = alive.length === 1 ? alive[0].uid : null;
    const width = alive.length > 1 ? 135 : 190;
    const picks = [];
    const btn = Btn({ label: 'PERDER ESTA CARTA', icon: '💔', variant: 'red',
      disabled: selected == null, onClick: () => onPicked(selected) });

    function refresh() {
      picks.forEach(({ uid, el }) => el.classList.toggle('sel', uid === selected));
      btn.disabled = selected == null;
    }
    const items = alive.map((hc) => {
      const card = Card3D({ cardId: hc.cardId, faceUp: true, width,
        onTap: () => { selected = hc.uid; refresh(); } });
      const el = h('div', { class: 'pick' }, h('div', { class: 'ring' }, card.el));
      picks.push({ uid: hc.uid, el });
      return el;
    });
    refresh();
    return StepLayout({ headline, subtitle,
      body: h('div', { class: 'pick-wrap' }, items), buttons: [btn] });
  }

  /** Carta que comeca de costas e vira sozinha logo depois de aparecer. */
  function RevealedCard(cardId, width = 190) {
    const c = Card3D({ cardId, faceUp: false, width, onTap: null });
    setTimeout(() => c.setFaceUp(true), 350);
    return h('div', { class: 'center' }, c.el);
  }

  /** Troca do Embaixador: compra 2 cartas da corte e escolhe quais manter. */
  function ExchangeStep(game, onDone) {
    const keepCount = game.aliveCards.length;
    const options = game.beginExchange();
    const drawn = options.length - keepCount;
    const chosen = new Set();
    for (let i = 0; i < keepCount; i++) chosen.add(i);
    const picks = [];
    const confirm = Btn({ label: '', icon: '✔', variant: 'green', onClick: () => {
      game.completeExchange([...chosen].sort((a, b) => a - b));
      onDone();
    } });

    function refresh() {
      const ready = chosen.size === keepCount;
      picks.forEach((p, i) => p.classList.toggle('sel', chosen.has(i)));
      confirm.disabled = !ready;
      confirm.lastChild.textContent = ready ? 'CONFIRMAR TROCA'
        : 'Escolha ' + keepCount + ' (' + chosen.size + '/' + keepCount + ')';
    }
    const items = options.map((id, i) => {
      const card = Card3D({ cardId: id, faceUp: false, width: 128, onTap: () => {
        if (chosen.has(i)) chosen.delete(i);
        else if (chosen.size < keepCount) chosen.add(i);
        refresh();
      } });
      setTimeout(() => card.setFaceUp(true), 250 + i * 160);
      const el = h('div', { class: 'pick', style: { '--ring': 'var(--green)' } },
        h('div', { class: 'ring' }, card.el),
        h('div', { class: 'src' }, i < keepCount ? 'Sua mão' : 'Da corte'));
      picks.push(el);
      return el;
    });
    refresh();
    return StepLayout({
      headline: 'Escolha ' + (keepCount === 1 ? 'a carta' : 'as ' + keepCount + ' cartas') + ' para manter',
      subtitle: drawn === 0 ? 'O baralho da corte está vazio: nada para trocar.'
        : 'As outras voltam para o baralho da corte, que é embaralhado.',
      body: h('div', { class: 'pick-wrap' }, items),
      buttons: [confirm],
    });
  }

  /** Passo final com resumo (e, opcionalmente, pilha de moedas animada). */
  function DoneStep(game, d, label, onClose) {
    let body = null;
    if (d.coinsFrom !== undefined) {
      const stack = CoinStack({ count: d.coinsFrom, width: 230 });
      body = h('div', { class: 'center' }, stack.el);
      setTimeout(() => stack.setCount(game.coins), 450);
    }
    return StepLayout({ headline: d.title, subtitle: d.subtitle, body,
      buttons: [Btn({ label, icon: '✔', variant: 'green', onClick: onClose })] });
  }

  const moedas = (n) => n + (n === 1 ? ' moeda' : ' moedas');
  const hint = (text) => h('div', { class: 'hint' }, text);
  const back = (fn) => Btn({ label: 'VOLTAR', variant: 'cream', small: true, onClick: fn });

  // =============================================================== MINHA VEZ
  function MyTurnFlow(game) {
    const cat = game.catalog;
    const shell = FlowShell('Minha vez');
    const st = { step: 'pickAction', action: null, target: null, blockCard: null,
      paid: 0, done: null };
    const nm = (i) => game.playerNames[i];

    function go(step) { st.step = step; render(); }
    function render() {
      shell.setCanClose(st.step === 'pickAction' || st.step === 'pickTarget');
      shell.show(steps[st.step]());
    }
    function done(title, o = {}) {
      st.done = { title, subtitle: o.subtitle, coinsFrom: o.coinsFrom,
        result: o.result || title };
      go('done');
    }
    function eliminated() {
      if (game.isEliminated) { Router.pop('Você foi eliminado!'); return true; }
      return false;
    }
    function afterChallenge() { go(st.action.isBlockable ? 'blockAsk' : 'resolve'); }
    function chooseAction(a) {
      st.action = a; st.target = null;
      if (a.needsTarget) go('pickTarget'); else declare();
    }
    function declare() {
      const a = st.action;
      if (a.cost > 0) {
        game.spendCoins(a.cost, 'Pagou ' + a.cost + ' por ' + a.name + '.');
        st.paid = a.cost;
      }
      if (a.isChallengeable) go('challengeAsk'); else afterChallenge();
    }
    function claimedName() {
      const a = st.action;
      const held = game.holding(a.claimedBy);
      return cat.card(held ? held.cardId : a.claimedBy[0]).name;
    }
    const paidNote = () => (st.paid > 0
      ? 'As ' + st.paid + ' moedas pagas continuam gastas.' : 'Nada acontece.');

    const steps = {
      pickAction() {
        const rs = game.ruleSet;
        return StepLayout({
          headline: 'O que você vai fazer?',
          subtitle: game.mustCoup
            ? 'Você tem ' + rs.mandatoryCoupAt + '+ moedas: o Golpe é obrigatório!'
            : 'Escolha a ação do seu turno.',
          body: h('div', { class: 'stack-col' }, rs.actionIds.map((id) => {
            const a = cat.action(id);
            return ActionTile({ action: a, catalog: cat,
              reason: game.unavailableReason(a), onTap: () => chooseAction(a) });
          })),
        });
      },

      pickTarget() {
        return StepLayout({
          headline: 'Quem será o alvo?',
          subtitle: st.action.name,
          body: h('div', { class: 'stack-col' }, game.aliveOpponents.map((i, k) =>
            Btn({ label: nm(i), icon: '👤', variant: PALETTE[k % PALETTE.length],
              onClick: () => { st.target = i; declare(); } }))),
          buttons: [back(() => go('pickAction'))],
        });
      },

      challengeAsk() {
        const a = st.action;
        const targetText = st.target == null ? '' : ' em ' + nm(st.target);
        return StepLayout({
          headline: 'Anuncie em voz alta:',
          subtitle: '"Eu sou o ' + claimedName() + ' e vou usar ' + a.name + targetText + '!"',
          body: hint('Todos podem contestar. Se ninguém falar nada, siga em frente. ' +
            'Se alguém disser que você está blefando, toque em "Me contestaram".'),
          buttons: [
            Btn({ label: 'NINGUÉM CONTESTOU', icon: '✔', variant: 'green', onClick: afterChallenge }),
            Btn({ label: 'ME CONTESTARAM!', icon: '⚠️', variant: 'red',
              onClick: () => go(game.holding(a.claimedBy) ? 'challengeProve' : 'challengeBluff') }),
          ],
        });
      },

      /** Eu tenho a carta: mostro, devolvo ao baralho e compro outra. */
      challengeProve() {
        const held = game.holding(st.action.claimedBy);
        return StepLayout({
          headline: 'Você tem a carta! 🎉',
          subtitle: 'Mostre esta carta para a mesa. Quem contestou perde uma influência.',
          body: RevealedCard(held.cardId),
          buttons: [Btn({ label: 'JÁ MOSTREI, TROCAR CARTA', icon: '🔄', variant: 'green',
            onClick: () => { game.replaceCard(held.uid); afterChallenge(); } })],
        });
      },

      /** Eu nao tenho a carta: perco uma influencia e a acao falha. */
      challengeBluff() {
        return InfluencePicker(game, {
          headline: 'Você estava blefando!',
          subtitle: 'Perca uma influência. A ação falha' +
            (st.paid > 0 ? ' e suas ' + st.paid + ' moedas voltam' : '') + '.',
          onPicked: (uid) => {
            const before = game.coins;
            if (st.paid > 0) game.addCoins(st.paid, 'Ação falhou: moedas devolvidas.');
            game.loseInfluence(uid);
            if (eliminated()) return;
            done('Ação cancelada', { subtitle: 'Você perdeu a contestação.',
              coinsFrom: st.paid > 0 ? before : undefined,
              result: 'Você foi pego blefando.' });
          },
        });
      },

      blockAsk() {
        const a = st.action;
        return StepLayout({
          headline: 'Alguém bloqueou?',
          subtitle: a.anyoneCanBlock ? 'Qualquer jogador pode bloquear a ' + a.name + '.'
            : (st.target != null ? nm(st.target) + ' pode' : 'O alvo pode') + ' bloquear.',
          buttons: [
            Btn({ label: 'NINGUÉM BLOQUEOU', icon: '✔', variant: 'green', onClick: () => go('resolve') }),
            ...a.blockedBy.map((id) => Btn({
              label: 'BLOQUEARAM COMO ' + cat.card(id).name.toUpperCase(), icon: '✋', variant: 'blue',
              onClick: () => { st.blockCard = id; go('blockChallengeAsk'); } })),
          ],
        });
      },

      blockChallengeAsk() {
        return StepLayout({
          headline: 'Bloquearam como ' + cat.card(st.blockCard).name + '!',
          subtitle: 'Você acha que é blefe? Se contestar e ele tiver a carta, você perde uma influência.',
          buttons: [
            Btn({ label: 'CONTESTAR O BLOQUEIO', icon: '⚖️', variant: 'red',
              onClick: () => go('blockChallengeResult') }),
            Btn({ label: 'ACEITAR O BLOQUEIO', icon: '👍',
              onClick: () => done('Ação bloqueada', { subtitle: paidNote(),
                result: 'Sua ação foi bloqueada.' }) }),
          ],
        });
      },

      blockChallengeResult() {
        return StepLayout({
          headline: 'O bloqueador mostrou o ' + cat.card(st.blockCard).name + '?',
          subtitle: 'Peça a ele que revele a carta para a mesa.',
          buttons: [
            Btn({ label: 'SIM, ELE TINHA A CARTA', icon: '😕', variant: 'orange',
              onClick: () => go('blockChallengeLost') }),
            Btn({ label: 'NÃO, ESTAVA BLEFANDO!', icon: '🎉', variant: 'green',
              onClick: () => go('resolve') }),
          ],
        });
      },

      blockChallengeLost() {
        return InfluencePicker(game, {
          headline: 'Você perdeu a contestação',
          subtitle: 'Perca uma influência. O bloqueio vale e sua ação falha.',
          onPicked: (uid) => {
            game.loseInfluence(uid);
            if (eliminated()) return;
            done('Ação bloqueada', { subtitle: paidNote(), result: 'Sua ação foi bloqueada.' });
          },
        });
      },

      resolve() {
        const a = st.action;
        switch (a.effect) {
          case 'gain': {
            const stack = CoinStack({ count: game.coins, width: 230 });
            return StepLayout({
              headline: 'Pegue ' + a.amount + (a.amount === 1 ? ' moeda' : ' moedas') + '!',
              subtitle: 'Ação concluída com sucesso.',
              body: h('div', { class: 'center' }, stack.el),
              buttons: [Btn({ label: 'PEGAR AS MOEDAS', icon: '🪙', onClick: (btn) => {
                btn.disabled = true;
                game.addCoins(a.amount, a.name + ': +' + a.amount + '.');
                stack.setCount(game.coins);
                setTimeout(() => done('Você tem ' + moedas(game.coins), {
                  coinsFrom: game.coins, result: a.name + ': +' + moedas(a.amount) + '.' }), 1100);
              } })],
            });
          }
          case 'steal':
            return StepLayout({
              headline: 'Extorsão bem-sucedida!',
              subtitle: 'Agora diga quantas moedas você tomou de ' + nm(st.target) + '.',
              buttons: [Btn({ label: 'CONTINUAR', icon: '➡️', onClick: () => go('stealAmount') })],
            });
          case 'lose':
            return StepLayout({
              headline: nm(st.target) + ' perde uma influência!',
              subtitle: 'Ele escolhe qual carta virar para cima.',
              body: h('div', { class: 'center', style: 'font-size:90px' }, '💥'),
              buttons: [Btn({ label: 'CONCLUIR', icon: '✔', variant: 'green',
                onClick: () => done(nm(st.target) + ' perde uma influência.',
                  { result: a.name + ': ' + nm(st.target) + ' perde uma influência.' }) })],
            });
          case 'exchange':
          default:
            return StepLayout({
              headline: 'Troca liberada!',
              subtitle: 'Você vai comprar 2 cartas da corte e escolher quais manter.',
              buttons: [Btn({ label: 'COMPRAR CARTAS', icon: '🃏', variant: 'green',
                onClick: () => go('exchange') })],
            });
        }
      },

      stealAmount() {
        const a = st.action;
        const btns = [];
        for (let n = a.amount; n >= 1; n--) {
          btns.push(Btn({ label: 'PEGUEI ' + n + (n === 1 ? ' MOEDA' : ' MOEDAS'), icon: '🪙',
            onClick: () => {
              const before = game.coins;
              game.addCoins(n, 'Extorquiu ' + n + ' de ' + nm(st.target) + '.');
              done('Você tem ' + moedas(game.coins), { coinsFrom: before,
                result: 'Extorsão: +' + moedas(n) + ' de ' + nm(st.target) + '.' });
            } }));
        }
        btns.push(Btn({ label: 'ELE NÃO TINHA MOEDAS', variant: 'cream',
          onClick: () => done('Nada para roubar', { result: nm(st.target) + ' não tinha moedas.' }) }));
        return StepLayout({
          headline: 'Quantas moedas você pegou?',
          subtitle: 'O alvo só perde o que tiver (no máximo ' + a.amount + ').',
          buttons: btns,
        });
      },

      exchange() {
        return ExchangeStep(game, () => done('Troca concluída!',
          { subtitle: 'Suas novas cartas já estão na mão.' }));
      },

      done() {
        return DoneStep(game, st.done, 'CONCLUIR TURNO', () => Router.pop(st.done.result));
      },
    };

    render();
    return { el: shell.el,
      onBack: () => !['pickAction', 'pickTarget', 'done'].includes(st.step) };
  }

  // ========================================================= OUTRO JOGADOR AGIU
  function OtherActsFlow(game) {
    const cat = game.catalog;
    const shell = FlowShell('Outro jogador agiu');
    const st = { step: 'pickActor', actor: null, action: null, target: null,
      blockCard: null, challengeLost: false, done: null };
    const nm = (i) => game.playerNames[i];
    const targetsMe = () => st.action.needsTarget && st.target === 0;

    function go(step) { st.step = step; render(); }
    function render() {
      shell.setCanClose(['pickActor', 'pickAction', 'pickTarget', 'respond'].includes(st.step));
      shell.show(steps[st.step]());
    }
    function done(title, o = {}) {
      st.done = { title, subtitle: o.subtitle, coinsFrom: o.coinsFrom, result: o.result || title };
      go('done');
    }
    function eliminated() {
      if (game.isEliminated) { Router.pop('Você foi eliminado!'); return true; }
      return false;
    }

    /** Aplica o efeito da acao sobre mim (se eu for o alvo). */
    function resolveOnMe() {
      const a = st.action;
      const actor = nm(st.actor);
      if (!targetsMe()) {
        done('Ação resolvida', { subtitle: 'Nada acontece com você.',
          result: actor + ': ' + a.name + ' resolvida.' });
        return;
      }
      if (a.effect === 'lose') { go('loseToAction'); return; }
      if (a.effect === 'steal') {
        const before = game.coins;
        const lost = game.spendCoins(a.amount, actor + ' extorquiu você.');
        done(lost === 0 ? 'Você não tinha moedas'
          : 'Você perdeu ' + lost + (lost === 1 ? ' moeda' : ' moedas'), {
          subtitle: 'Entregue-as para ' + actor + '.', coinsFrom: before,
          result: actor + ' extorquiu ' + moedas(lost) + ' de você.' });
        return;
      }
      done('Ação resolvida', { result: actor + ': ' + a.name + ' resolvida.' });
    }

    const steps = {
      pickActor() {
        return StepLayout({
          headline: 'Quem agiu?',
          subtitle: 'Escolha o jogador que anunciou a ação.',
          body: h('div', { class: 'stack-col' }, game.aliveOpponents.map((i, k) =>
            Btn({ label: nm(i), icon: '👤', variant: PALETTE[k % PALETTE.length],
              onClick: () => { st.actor = i; go('pickAction'); } }))),
        });
      },

      pickAction() {
        return StepLayout({
          headline: 'O que ' + nm(st.actor) + ' anunciou?',
          body: h('div', { class: 'stack-col' }, game.ruleSet.actionIds.map((id) => {
            const a = cat.action(id);
            return ActionTile({ action: a, catalog: cat, onTap: () => {
              st.action = a; st.target = null; st.challengeLost = false;
              go(a.needsTarget ? 'pickTarget' : 'respond');
            } });
          })),
          buttons: [back(() => go('pickActor'))],
        });
      },

      pickTarget() {
        const others = game.aliveOpponents.filter((i) => i !== st.actor);
        return StepLayout({
          headline: 'Quem é o alvo de ' + st.action.name + '?',
          body: h('div', { class: 'stack-col' },
            Btn({ label: 'EU SOU O ALVO!', icon: '🎯', variant: 'red',
              onClick: () => { st.target = 0; go('respond'); } }),
            others.map((i) => Btn({ label: nm(i), icon: '👤', variant: 'blue',
              onClick: () => { st.target = i; go('respond'); } }))),
          buttons: [back(() => go('pickAction'))],
        });
      },

      respond() {
        const a = st.action;
        const actor = nm(st.actor);
        const canChallenge = a.isChallengeable && !st.challengeLost;
        const canBlock = a.isBlockable && (a.anyoneCanBlock || targetsMe());
        const claim = a.claimedBy.map((id) => cat.card(id).name).join(' ou ');
        const targetText = a.needsTarget
          ? (targetsMe() ? ' contra VOCÊ' : ' em ' + nm(st.target)) : '';
        const buttons = [];
        if (canChallenge) {
          buttons.push(Btn({ label: 'CONTESTAR (É BLEFE!)', icon: '⚖️', variant: 'red',
            onClick: () => go('challengeResult') }));
        }
        if (canBlock) {
          a.blockedBy.forEach((id) => buttons.push(Btn({
            label: 'BLOQUEAR COMO ' + cat.card(id).name.toUpperCase(), icon: '✋', variant: 'blue',
            onClick: () => { st.blockCard = id; go('blockClaim'); } })));
        }
        buttons.push(Btn({
          label: targetsMe() && a.effect !== 'gain' ? 'ACEITAR' : 'DEIXAR PASSAR',
          icon: '✔', onClick: resolveOnMe }));
        return StepLayout({
          headline: actor + ' usou ' + a.name + targetText,
          subtitle: [claim ? 'Ele diz ser: ' + claim + '.' : null, a.description,
            st.challengeLost ? 'Você já perdeu uma contestação nesta ação.' : null]
            .filter(Boolean).join('\n'),
          buttons,
        });
      },

      // ------------------------------------------------ eu contesto
      challengeResult() {
        const actor = nm(st.actor);
        const names = st.action.claimedBy.map((id) => cat.card(id).name).join(' ou ');
        return StepLayout({
          headline: 'Você contestou ' + actor + '!',
          subtitle: 'Peça para ele mostrar a carta (' + names + ').',
          buttons: [
            Btn({ label: 'ELE ESTAVA BLEFANDO!', icon: '🎉', variant: 'green',
              onClick: () => done(actor + ' perde uma influência', {
                subtitle: 'A ação dele foi cancelada.', result: 'Você pegou ' + actor + ' blefando!' }) }),
            Btn({ label: 'ELE TINHA A CARTA', icon: '😕', variant: 'orange',
              onClick: () => go('challengeLost') }),
          ],
        });
      },

      challengeLost() {
        return InfluencePicker(game, {
          headline: 'Você perdeu a contestação',
          subtitle: 'Perca uma influência. A ação continua.',
          onPicked: (uid) => {
            game.loseInfluence(uid);
            if (eliminated()) return;
            st.challengeLost = true;
            go('respond');
          },
        });
      },

      // ------------------------------------------------ eu bloqueio
      blockClaim() {
        const card = cat.card(st.blockCard);
        return StepLayout({
          headline: 'Diga em voz alta:',
          subtitle: '"Eu sou o ' + card.name + ' e bloqueio a ação!"',
          body: hint('Você pode blefar: o app sabe se você tem mesmo a carta. ' +
            'Se alguém contestar, toque em "Me contestaram".'),
          buttons: [
            Btn({ label: 'NINGUÉM CONTESTOU', icon: '✔', variant: 'green',
              onClick: () => done('Bloqueio concluído', { subtitle: 'A ação foi cancelada.',
                result: 'Você bloqueou a ação.' }) }),
            Btn({ label: 'ME CONTESTARAM!', icon: '⚠️', variant: 'red',
              onClick: () => go(game.holding([st.blockCard]) ? 'blockProved' : 'blockBluff') }),
          ],
        });
      },

      blockProved() {
        const held = game.holding([st.blockCard]);
        return StepLayout({
          headline: 'Você tem a carta! 🎉',
          subtitle: 'Mostre-a para a mesa. Quem contestou perde uma influência e o bloqueio vale.',
          body: RevealedCard(held.cardId),
          buttons: [Btn({ label: 'JÁ MOSTREI, TROCAR CARTA', icon: '🔄', variant: 'green',
            onClick: () => {
              game.replaceCard(held.uid);
              done('Bloqueio vitorioso!', { subtitle: 'A ação foi cancelada.',
                result: 'Você provou o bloqueio.' });
            } })],
        });
      },

      blockBluff() {
        return InfluencePicker(game, {
          headline: 'Você foi pego blefando!',
          subtitle: 'Perca uma influência. O bloqueio cai e a ação acontece.',
          onPicked: (uid) => {
            game.loseInfluence(uid);
            if (eliminated()) return;
            resolveOnMe();
          },
        });
      },

      loseToAction() {
        const actor = nm(st.actor);
        return InfluencePicker(game, {
          headline: actor + ' atacou você!',
          subtitle: 'Escolha qual carta virar para cima.',
          onPicked: (uid) => {
            game.loseInfluence(uid);
            if (eliminated()) return;
            done('Você perdeu uma influência', { result: actor + ': ' + st.action.name + ' acertou você.' });
          },
        });
      },

      done() {
        return DoneStep(game, st.done, 'CONCLUIR', () => Router.pop(st.done.result));
      },
    };

    render();
    return { el: shell.el,
      onBack: () => !['pickActor', 'pickAction', 'pickTarget', 'respond', 'done'].includes(st.step) };
  }

  Object.assign(Coup, { ActionTile, StepLayout, FlowShell, InfluencePicker,
    MyTurnFlow, OtherActsFlow });
})(typeof window !== 'undefined' ? window : globalThis);
