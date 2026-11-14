# Coup Offline (versão web)

Companheiro de mesa para jogar **Coup** presencialmente, sem baralho físico.
Cada jogador abre o jogo no **próprio celular**: o app sorteia suas cartas,
controla suas moedas e guia contestações, bloqueios e trocas. Sem conexão
entre os aparelhos, em português, 2 a 6 jogadores.

É um site estático (HTML + CSS + JavaScript puro). Não precisa instalar nada,
nem compilar. Cartas, pilha da corte e moedas são em 3D (CSS 3D e canvas).

## Como usar

### 1. Testar no computador
Abra o arquivo `index.html` com duplo clique. Funciona direto do disco.

### 2. Jogar nos celulares (recomendado)
Coloque a pasta num endereço `https://` e abra o link em cada celular. Opções
gratuitas, todas com "arrastar a pasta":

- **Netlify Drop** (app.netlify.com/drop)
- **GitHub Pages** (suba a pasta num repositório e ative Pages)
- **Cloudflare Pages** ou **Vercel**

Na **primeira visita** o jogo se guarda no aparelho. Depois disso funciona
**sem internet**, mesmo com o celular em modo avião. No Chrome (Android) use
"Instalar app"/"Adicionar à tela inicial"; no Safari (iPhone) use
Compartilhar → "Adicionar à Tela de Início". Fica com ícone e em tela cheia.

### 3. Na mesma rede Wi-Fi, sem hospedar
No computador, dentro da pasta:
```
python3 -m http.server 8000
```
e abra `http://IP-DO-COMPUTADOR:8000` nos celulares. (O modo offline e a
instalação exigem `https://`, então prefira a opção 2 para o dia a dia.)

## Como o jogo funciona

- **Mesa:** suas cartas em 3D (toque para virar, arraste para inclinar), pilha
  da corte, moedas, nomes dos rivais (toque para marcar eliminado).
- **Minha vez:** escolher ação → alvo → anúncio → contestação → bloqueio →
  resolução. Quando alguém contesta, **o app sabe se você tem a carta**: se
  tiver, pede para mostrá-la e a troca por outra; se não tiver, você perde a
  influência e as moedas pagas voltam.
- **Outro jogador agiu:** informe quem agiu, a ação e o alvo; escolha
  contestar, bloquear ou deixar passar. O app tira moedas ou cartas quando
  necessário e sabe se você estava blefando ao bloquear.
- **Embaixador:** compra 2 cartas da corte e você escolhe quais manter.
- **Ajustes manuais** (ícone de controles): ±1 moeda, perder influência,
  histórico.
- A partida é **salva automaticamente** (localStorage) e pode ser retomada.
- Cada celular tem o próprio baralho: podem aparecer mais de 3 cópias de uma
  carta na mesa. O app só controla as suas moedas.

## Estrutura

```
index.html            página única
manifest.webmanifest  instalação como app
sw.js                 service worker (modo offline)
css/style.css         tema cartunesco e 3D
js/catalog.js         cartas, ações e variantes (DADOS)
js/game.js            regras e estado (sem DOM; roda no Node)
js/ui.js              Card3D, DeckPile, CoinStack, diálogos, roteador
js/flows.js           Minha vez, Outro jogador agiu, Troca
js/app.js             telas e inicialização
assets/cards/*.webp   artes das cartas (800 x 1200, 2:3)
icons/                ícones do app
test/game.test.js     testes da lógica
```

## Adicionar uma carta nova

Edite só `js/catalog.js`:

1. Adicione a carta em `CARDS` e salve a arte em `assets/cards/<id>.webp`
   (2:3, cantos transparentes, 800 × 1200).
2. Em `ACTIONS`, crie as ações que ela habilita, ou inclua o id dela em
   `blockedBy` de ações existentes.
3. Em `RULE_SETS`, crie ou edite uma variante com `cardIds` e `actionIds`.
4. Em `sw.js`, inclua a nova imagem em `FILES` e aumente `CACHE_VERSION`.

Telas de ação, fluxos de contestação/bloqueio e o guia de regras são gerados a
partir do catálogo. Um efeito totalmente novo (além de `gain`, `steal`, `lose`
e `exchange`) exige tratamento em `js/flows.js`.

## Atualizar o jogo depois de publicar

O modo offline guarda uma cópia no aparelho. Ao mudar qualquer arquivo,
aumente `CACHE_VERSION` em `sw.js` (ex.: `coup-v2`); assim os celulares pegam
a versão nova na próxima visita online.

## Testes

```
node --test test/game.test.js
```

## Regras

Baseado nas regras oficiais de Coup (Indie Boards & Cards / La Mame Games):
[Dized](https://rules.dized.com/coup/rule/overview/category-overview),
[Board Game Arena](https://pt.boardgamearena.com/doc/Gamehelpcoupcitystate),
[Wikipedia](https://en.wikipedia.org/wiki/Coup_(card_game)).
