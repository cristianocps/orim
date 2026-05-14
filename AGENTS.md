# Orim — Agent Context & Project State

> This file tracks the current state of the project, known issues, architectural decisions, and guidance for future development sessions.

---

## Last Updated

2026-05-14 (No-op commits do InlineEditor + alinhamento renderer/editor para `text` undefined)

---

## Project Status Overview

Orim is a **collaborative whiteboard platform** built as a Turborepo monorepo. The core infrastructure is in place and functional. Recent work focused on stabilizing the NestJS backend migration, fixing critical frontend crashes, and resolving API errors.

### Current State: **Stable / Development Ready**

| Area | Status | Notes |
|------|--------|-------|
| Auth | ✅ Working | JWT with httpOnly cookies, all flows functional |
| Boards API | ✅ Working | CRUD + element patch/delete + history |
| Canvas Engine | ✅ Working | PixiJS v8 with 12 element types |
| Real-time (WebSocket) | ✅ Working | Socket.io via Vite proxy |
| Undo/Redo | ✅ Working | Local stack with Ctrl+Z / Ctrl+Shift+Z |
| Mobile / Touch | ✅ Working | Pinch-to-zoom, adaptive UI |
| AI Module | ✅ Working | Mock AI (summarize, cluster, action plans) |
| Upload | ✅ Working | MinIO multipart upload |
| App Marketplace | ✅ Working | CRUD + installs + SDK v1 |
| App SDK | ✅ Working | `@orim/app-sdk` with postMessage API |
| DB Migrations | ✅ Working | Prisma schema stable |
| TypeScript | ✅ Passing | `tsc --noEmit` clean |

---

## Recent Fixes & Decisions

### 0.17. No-op commits no InlineEditor + alinhamento de fallback `text` undefined (2026-05-14)

**Sintoma reportado:** "se entrar em modo de edição do texto e sair sem digitar nada o texto antigo some". Reproduz com qualquer text element cuja propriedade `text` esteja `undefined` no model (em vez de `''`).

**Causa raiz: semânticas divergentes pra `text === undefined`.**
- `renderText` desenhava `(el as any).text ?? 'Texto'` — usuário enxergava o placeholder "Texto" no canvas.
- `engine.beginInlineEdit` calculava `initialValue = el.text ?? ''` — editor abria vazio.

Quando o usuário dava double-click, abria o editor (vazio), saía sem digitar, e o `onBlur` disparava `commit('')`. O engine fazia `updateElement(textChild, { text: '' })`, persistia, e o renderer agora desenhava `''` (porque `'' ?? 'Texto' === ''` — o `??` só substitui `null/undefined`). Resultado: o "texto antigo" (que era na verdade um placeholder de renderer) sumia.

**Correção em duas camadas (defensive + raiz).**

1. **InlineEditor agora skipa commits no-op.** Se `value === (request.initialValue ?? '')` o componente chama `engine.endInlineEdit(false)` (cancel) em vez de `endInlineEdit(true, value)`. Isso protege contra QUALQUER divergência futura entre o que o renderer mostra e o que o editor lê — abrir e fechar sem digitar nunca mais escreve nada. Também economiza um round-trip de PATCH.
2. **`renderText` usa `text ?? ''`** (alinhado com `beginInlineEdit`). O placeholder "Texto" só aparece quando ele é literalmente o `text` no model — que é o que `insertElementAt('text')` semeia para text elements top-level.

**Lição genérica:** **Renderers e editores DEVEM compartilhar a mesma função de derivação para qualquer campo editável.** Idealmente expor um helper único (`getDisplayedText(el)`) que ambos consomem; até lá, o "skip-no-op-commit" no editor é a salvaguarda definitiva contra a classe inteira de bugs do tipo "abro e fecho e algo muda".

**Arquivos:** `apps/web/src/components/InlineEditor.tsx`, `apps/web/src/canvas/renderers/builtins/text.ts`.

### 0.16. Auto-fit do texto ao shape pai (wordWrap + fontSize cascateado no resize) (2026-05-14)

**Sintoma reportado:** "o sizing do elemento de texto deveria ser adaptado ao tamanho do elemento pai (por padrão) pois está bem difícil de visualizar". Após o refactor 0.14 (texto como sub-componente), o text child tinha `fontSize` fixo do model e SEM `wordWrap` — então qualquer sticky/card/frame redimensionado deixava o texto minúsculo no meio de um shape enorme, e textos longos extrapolavam o shape sem quebrar linha.

**Decisão de design.** Em vez de o renderer de `text` consultar o parent (que viola o princípio de renderers serem puramente derivados de `el`), o engine virou source-of-truth do layout dos children. Cada text child carrega um `metadata.layoutRole` enumerado (`sticky.center`, `rectangle.center`, `circle.center`, `frame.title`, `card.title`, `card.description`) e o engine converte essa role + o size atual do parent em três coisas: `wordWrapWidth` (largura útil do shape menos padding), `transform.x/y` (posição local), e — só quando o resize aciona — um novo `fontSize` proporcional à razão de crescimento.

**Implementação.**

- **`computeChildTextLayout(parent, child)`** no `engine.ts`: retorna o patch de layout (wrap + posição) baseado no role. Inferência de role pra elementos legados (sem `metadata.layoutRole`, criados pela migration `migrate-text-to-children`) via tipo do parent + ordem dos siblings (card title vs description).
- **`relayoutTextChildren(parentId, fontRatio)`**: itera os direct children type=text e aplica `computeChildTextLayout` + escala fontSize (clampado em [8, 96]) usando o `fontRatio` que o caller passa.
- **`endResize`**: calcula `fontRatio = min(width_ratio, height_ratio)` (ou `newRadius/startRadius` pra circles) e chama `relayoutTextChildren(parentId, fontRatio)`. Resultado: redimensionar um sticky 2× maior também aumenta o texto 2× (até o cap de 96px).
- **`insertElementAt`**: cada text child criado já leva `metadata.layoutRole` e o layout inicial é aplicado ANTES do `engine.createElement` pra evitar flash de "texto na origem sem wrap".
- **`applyInitialChildLayouts()`** + chamada em `BoardEditorPage` após o load: re-fita todos os text children de todos os pais (com `skipEmit: true` pra não saturar a API). Isso garante que boards legados rendam bonito de cara, sem o usuário precisar redimensionar nada.
- **Renderer de texto** (`renderText`): passa `wordWrap: wordWrapWidth > 0`, `wordWrapWidth`, `breakWords: true` (pra URLs/hashes longos não vazarem o shape).
- **Persistência:** `wordWrapWidth` mora no top-level do model → `extractData` joga em `data.wordWrapWidth` no DB → `flattenElement` reconstrói no top-level. `metadata.layoutRole` viaja no campo `metadata`. Sem mudança de schema.

**Defaults atualizados:**
- Sticky: 16→18px
- Rectangle/Circle: 14→18px (eram especialmente difíceis de ler — fundo colorido com texto branco minúsculo)
- Card title: 15→16px
- Card description: 12→13px

**Limite conhecido:** Cards têm dois text children fixos (title + description) sem layout flow real. Adicionar um terceiro text child a um card "manualmente" via API ficaria sem role inferido — fica como extensão futura se a gente abrir a composição de elementos arbitrária.

**Arquivos:** `apps/web/src/canvas/engine.ts`, `apps/web/src/canvas/renderers/builtins/text.ts`, `apps/web/src/pages/BoardEditorPage.tsx`.

### 0.15. Pixi v8 event pooling: flag de evento "viajando" entre dispatches (2026-05-14)

**Sintoma reportado:** "após editar um texto em um elemento, não conseguimos editar o texto de nenhum outro" — segunda regressão do mesmo padrão (a primeira foi o backdrop do `InlineEditor`).

**Causa raiz.** Pixi v8 reusa instâncias de `FederatedPointerEvent` via pool interno (`EventBoundary`) para evitar GC pressure em alta frequência de input. A primeira fix de double-click marcava `(e as any).__orimInlineEditHandled = true` para de-dupar a coalescência do path manual (`pointerdown` timer 500ms) com o path nativo (`pointertap` com `e.detail >= 2`). Como o evento é o MESMO objeto reciclado em dispatches subsequentes, a flag persistia indefinidamente — o próximo `tryBeginInlineEdit` (em outro elemento, outro dia, outro mundo) abortava com "já handled".

Sequência observada:

1. `dblclick` no sticky A → `tryBeginInlineEdit` marca o evento, edita.
2. Pixi devolve o objeto de evento ao pool.
3. Próximo `dblclick` em sticky B → Pixi pega esse objeto do pool, **sem limpar a propriedade ad-hoc**, e despacha.
4. `tryBeginInlineEdit` vê `__orimInlineEditHandled = true` herdado do dispatch anterior → return early → editor nunca abre.

**Correção.** Substituí a flag por uma janela temporal global no engine (`lastInlineEditAttemptAt: number`). 120ms é menor que o gap humano entre dois dblclicks consecutivos (qualquer coisa < 200ms é uma sequência só) mas maior que o intervalo entre o `pointerdown` manual e o `pointertap` nativo que seguem (acontecem no mesmo frame). Resultado: a coalescência continua funcionando dentro do mesmo dblclick e o próximo dblclick passa limpo.

**Lição genérica:** **NUNCA** anexar propriedades custom em objetos `FederatedPointerEvent` no Pixi v8 — eles são reciclados. Para de-duplicar handlers que disparam para o mesmo input, use timestamp window, contadores, ou `WeakRef`-style identificadores que naturalmente expiram.

**Arquivos:** `apps/web/src/canvas/engine.ts`.

### 0.14. Texto como sub-componente: hierarquia parent/child em todo shape com texto (2026-05-14)

**Pedido do usuário:** "se considerarmos que cada elemento que pode ter o texto editado ao invés de ser o texto diretamente tem um componente de texto? isso por natureza nos trará o editor com mais funcionalidades e edição inline".

**Mudança arquitetural.** Shapes editáveis (sticky_note, rectangle, circle, card, frame) **deixaram de carregar texto inline em campos próprios** (`text`/`title`/`description`). Cada um agora tem um (ou mais) `text` element como **filho** numa árvore parent/child. Isso unifica:

- O renderer de texto único (`renderText`) atende todos os casos de edição.
- Inline editor + format toolbar operam sempre num `text` element real.
- Cards ganham 2 children (title + description); frames 1 (title); sticky/rect/circle 1; tudo com bounds, fonte, cor, alinhamento gerenciados por `style.*` no próprio child.

**Schema Prisma + migration.** Adicionada coluna `parentId UUID?` em `elements` com FK self-relation `ElementChildren` (`onDelete: SetNull`, cascade no app layer) + index `parentId_idx`. Migração `20260514005550_element_parentid_hierarchy`. Tipos compartilhados (`@orim/shared`) já tinham `BaseElement.parentId`.

**Backend.** `BoardsService.patchElements` aceita `parentId` no Zod schema (`null` desanexa, `undefined` mantém) e ordena ops por dependência de pai (`sortByParentDependency`) antes da `$transaction` para satisfazer a FK quando shape + child chegam no mesmo batch. `deleteElement` faz cascade soft-delete coletando descendentes BFS (cap 10 níveis). `findOne` ordena `parentId NULLS FIRST, createdAt ASC` para garantir que pais carregam antes dos filhos no boot do canvas.

**Frontend (engine).** Três acréscimos centrais:

1. `createElement(el)` — se `el.parentId` referencia um container já montado, anexa **dentro** dele (em vez de `elementsContainer`). Pixi compõe transforms automaticamente: arrastar/redimensionar o pai carrega os filhos; `child.transform.x/y` é interpretado como **local** ao pai. Children que chegam ANTES do pai ficam orphan e são reconectados via `reparentOrphans()` quando o pai monta.
2. `deleteElement(id)` cascateia: coleta descendentes do `elementModels`, deleta deepest-first, cada um emitindo seu próprio `element.deleted` para que `useBoardSync` persista individualmente.
3. `rebuildElementVisual(id)` agora destrói **somente** o visual do renderer (taggeado `__rendererVisual = true` e armazenado em `(c as any).__visual`). Sem isso, qualquer `updateElement` no pai (ex: trocar a cor do sticky) destruía os children Pixi junto, partindo a hierarquia silenciosamente.

**Frontend (drag e selection — Figma-style).**

- **Drag** só inicia para containers em `elementsContainer` (top-level). Filhos não draggam isoladamente — eles seguem o pai pela hierarquia Pixi. Sem essa filtragem, o delta calculado em world coords seria aplicado em local coords do pai, multiplicando por qualquer transform composto.
- **Single-click** chama `resolveSelectionRoot(id)` antes de selecionar — clicar no texto de um sticky seleciona o sticky inteiro, não o text node. Idem para context menu, connector mode e shift-select.
- **Double-click** (já tratado em `tryBeginInlineEdit`) procura o primeiro descendente type='text' do alvo e abre o editor lá. Antes de abrir, **muda a seleção para o text child** para que a barra de formatação (textFormatProvider) opere no nó correto.
- **Após `endInlineEdit`** a seleção volta automaticamente para o root original — usuário sai da edição já com o pai selecionado de novo, pronto para arrastar.

**Frontend (renderers).** `stickyNote`, `rectangle`, `circle`, `frame`, `card` viraram **puro shape** — não desenham mais texto interno nem expõem `__inlineEditor` próprio. O motor delega via `findTextDescendant`. Comportamento visual idêntico para o usuário porque a factory abaixo cria os children com mesmas posições/cores/tamanhos que os renderers usavam antes.

**Frontend (factory).** `engine.insertElementAt(type, ...)` agora cria o pai E os children numa única chamada (children rodam `engine.createElement(ch)` DEPOIS do pai para que o `parentContainer` exista no `elementMap`). Defaults:

| Tipo | Children criados |
|---|---|
| `sticky_note` | 1 text, fontSize 16, color slate-900 |
| `rectangle`, `circle` | 1 text, fontSize 14, white |
| `frame` | 1 text no titlebar (offsetY = -halfH+13), fontSize 13, slate-600, weight 600 |
| `card` | 2 texts: title (offsetY = -halfH+50, fontSize 15, slate-900, weight 600, align left) + description (offsetY = -halfH+90, fontSize 12, slate-500, align left) |

**Frontend (providers).** `cardProvider` lê title/description via `store.getChildren(card.id).filter(c => c.type === 'text')` — `[0]` = title, `[1]` = description. Actions "Editar título"/"Editar descrição" e propriedades correspondentes operam no child id, não mais no card. `frameProvider`, `stickyProvider` idem para seu único text child. `BoardStoreApi` ganhou `getChildren(parentId)` e o store implementa via filtro O(n) (boards têm centenas de elementos, não milhares).

**Migration de dados existentes.** Script `apps/api/prisma/scripts/migrate-text-to-children.ts` percorre todos os shapes legados, extrai `text`/`title`/`description` do JSON `data`, cria child text elements e limpa o data. Idempotente (skip se já existem children text). Rodei contra dev DB: 26 shapes processados, 26 children criados.

```bash
pnpm --filter @orim/api exec tsx prisma/scripts/migrate-text-to-children.ts
```

**Limites conhecidos / dívida.**

- Children não escalam proporcionalmente quando o pai redimensiona — eles ficam ancorados no offset original (Figma faria isso com constraints; v1 vive sem). Sticky/rect/circle nem sentem porque o text fica no centro (0,0); cards e frames podem precisar reposicionar text se o size mudar muito.
- `sticky.toCard` (transformar sticky em card) não move/reparenta o text child existente — ele continua filho do mesmo nó (que agora é card). Visualmente o card vai ter o texto do sticky no offset 0,0 em vez de no slot title. Aceitei como trade-off; refinar quando alguém usar.
- Dragging de texto child individualmente (caso "entrei no nível filho") está desativado por enquanto — a v1 mantém Figma-strict ("clique = pai").
- Nenhum rich-text ainda — cada text element formata o nó inteiro com `style.fontWeight`, `style.color`, etc. Para runs (negrito numa palavra só), trocar `<textarea>` por TipTap/Lexical num próximo passo.

### 0.13. InlineEditor: backdrop comia o clique de transição entre elementos (2026-05-13)

**Sintoma reportado:** "Após editar um elemento o editor não aparece em nenhum outro".

**Causa raiz.** `InlineEditor` envolvia o `<textarea>` em um `<div className="inline-editor-backdrop">` com `position: fixed; inset: 0; z-index: 200`. O backdrop existia para detectar clique-fora-pra-commitar (`if (e.target === e.currentTarget) commit()`), mas como cobre a viewport inteira ele intercepta TODO clique destinado ao canvas. Sequência observada quando o usuário tentava dblclick em um elemento B logo após editar A:

1. `mousedown` em B aparente → na verdade bate no backdrop (z-index 200 > canvas)
2. Backdrop dispara `commit()` → `engine.endInlineEdit(true, value)` → editor desmonta
3. **O evento nunca chega no canvas** — B não recebe o clique
4. Para de fato dar dblclick em B o usuário precisaria de _quatro_ cliques: 1 commit silencioso, 2 reais para B, mais 1 de recuperação. Como ninguém percebe esse gap, parecia que o editor "ficava travado" depois da primeira edição.

**Correção.** Removido o backdrop. O `InlineEditor` agora renderiza só o `<textarea>`/`<input>` flutuante (`position: fixed; z-index: 220`). Click-outside-pra-commitar vem do próprio `onBlur` do input — clicar em qualquer lugar fora desfocaliza, dispara commit, e o evento chega normalmente em quem foi clicado (canvas, outro elemento, sidebar). É como Figma/Miro fazem.

**Ordering de z-index** ficou:

```
canvas      < auto >
inline editor (textarea)  220
floating-toolbar          250  ← acima do editor para Bold/Italic clicáveis
toolbar submenu           260
```

A toolbar e seus submenus mantêm `onMouseDown={(e) => e.preventDefault()}` para não perder o foco do textarea quando o usuário clica num botão de formatação (sem isso, blur dispara antes do click → commit prematuro).

Adicionalmente o editor faz `e.stopPropagation()` no próprio `onMouseDown` para evitar que o canvas inicie um retângulo de seleção quando o usuário arrasta selecionando texto dentro do input.

**Arquivos:** `apps/web/src/components/InlineEditor.tsx`, `apps/web/src/components/InlineEditor.css`.

### 0.12. Edição de texto in-place + formatação compartilhada na toolbar + setas de connector (2026-05-13)

**Pedido do usuário:** "ao clicar duas vezes precisamos permitir a edição do texto in place, alem disso seria bom possibilitarmos formatar o texto usando a barra de contexto. Notei também que a seta das conexões estão quebradas e seria importante configurar as conexões".

**Mudanças:**

−1. **InlineEditor: texto somia + sem opções de formatação visível** (`apps/web/src/components/FloatingToolbar.{tsx,css}`, `apps/web/src/canvas/renderers/builtins/*.ts`, `apps/web/src/canvas/engine.ts`).

   **Sintoma reportado:** "Quando o inline editor é ativado o texto some e não exibimos nenhuma opção de formatação do texto".

   **Bug 1 — toolbar escondida atrás do backdrop.** `.inline-editor-backdrop` tinha `z-index: 200` e cobria a viewport inteira (`position: fixed; inset: 0`). `.floating-toolbar` estava em `z-index: 60`. Resultado: a toolbar ficava VISUALMENTE embaixo do backdrop transparente, e qualquer clique nos botões (Bold, Italic, etc.) batia primeiro no backdrop, que dispara `commit()` (porque `e.target === e.currentTarget`) e fecha o editor antes da action rodar. Para o usuário parecia "não tem opção de formatação" — os botões existiam mas eram inertes.

   **Correção:** `.floating-toolbar` foi para `z-index: 250` e `.float-submenu` para `260` (acima do backdrop 200). Adicionalmente, todos os elementos da toolbar e dos submenus ganharam `onMouseDown={(e) => e.preventDefault()}`. Sem esse `preventDefault`, mesmo com z-index correto o `mousedown` no botão tira o foco do `<textarea>` do editor → `onBlur` dispara → commit + fechamento. Com `preventDefault`, o foco fica no textarea e a action só toggla o estilo (bold/italic/cor) sem fechar a edição.

   **Bug 2 — texto "somia" porque cor da overlay não casa com o renderer.** Renderers como `rectangle` desenham texto BRANCO sobre fundo azul mas não escrevem `style.color` no modelo. O engine, ao montar o overlay HTML, fazia fallback para `#1e293b` (escuro) sobre `white` (default do componente). Resultado: usuário com retângulo azul + texto branco rendered → dblclica → editor aparece como caixa BRANCA com texto ESCURO em cima do retângulo azul. As cores não casam, e em alguns combos (texto branco em fundo branco quando `style.color === 0xffffff` mas o engine não tinha esse dado) o texto literalmente fica invisível.

   **Correção:** estendi `InlineEditorDescriptor` com campos `color` e `background` (CSS strings) que cada renderer DEVE preencher com as cores que de fato pintou. Engine prioriza `editor.color`/`editor.background` sobre derivar de `style.color`/`style.fill`. Renderers atualizados:

   - `stickyNote`: usa `pickContrastingColor(fill)` para texto e o próprio `fill` para fundo.
   - `rectangle`/`circle`: usa `style.color` ou white, e `style.fill` ou cor padrão do shape.
   - `text`: cor do texto + fundo `rgba(255,255,255,0.95)` (não tem fill).
   - `card`: `#1e293b` no título sobre `#ffffff`; `#64748b` na descrição sobre `#ffffff`.
   - `frame`: `#475569` sobre `#e2e8f0` (sólido equivalente do título translúcido).
   - `table`: por célula — `#f1f5f9` para header row, `#ffffff` ou `cell.backgroundColor` no resto.

   **Limitação aceita:** o overlay do editor não atualiza style ao vivo quando o usuário toggla Bold/Italic durante a edição. A formatação É aplicada (e visível depois do commit), mas durante a digitação o textarea mantém o style do início. Solução completa exigiria reemitir `inlineEdit.start` apenas para style props sem resetar `value`. Adiada.

0. **`pointerdblclick` não existe em Pixi v8 + suporte a múltiplos editors por elemento** (`apps/web/src/canvas/engine.ts`, `apps/web/src/canvas/renderers/types.ts`, `apps/web/src/canvas/renderers/builtins/{card,table}.ts`).

   **Bug 1 — pointerdblclick não existe.** O handler de duplo-clique em `setupContainerInteractions` ouvia `pointerdblclick`, evento que **não é emitido** pelo `@pixi/events` em v8. Eu corrigi pela primeira vez tentando `dblclick`, mas isso também não existe (verificado lendo `node_modules/pixi.js/lib/events/EventBoundary.mjs:_fireClickAndTap` — Pixi v8 só dispara `click`, `tap`, `pointertap`, `rightclick`, com `e.detail` contendo a contagem de cliques rastreada em janela de 200ms). Funcionou parcialmente em card (e nada em rect/circle) por sorte do meu detector manual `pointerdown` ter casado o timing/posição em alguns casos, mas a janela 350ms/8px era apertada demais.

   Solução final usa **dois caminhos** que funilam em `tryBeginInlineEdit` (idempotente via flag `__orimInlineEditHandled` no evento):

   - `pointertap` com `e.detail >= 2` — usa o contador interno do Pixi (200ms, janela curta mas certeira).
   - Detecção manual no `pointerdown` — janela 500ms/12px, atende cliques humanos mais lentos.

   O check `e.button !== 2` substituiu `e.button === 0 || undefined` porque Pixi v8 às vezes seta `button = -1` para pointer events sintetizados (touch / pen), o que fazia minha detecção anterior nunca disparar lá.

   **Bug 2 — só uma região editável por elemento.** O contrato `__inlineEditor` só permitia um editor por container, então cards (título + descrição) e tabelas (N×M células) ficavam restritos ao primeiro campo. Estendi os tipos para suportar `__inlineEditors: InlineEditorDescriptor[]` com:

   - `field`, `label` para identificação
   - `bounds` (em coords locais do container) para "qual editor para esta posição?"
   - `getValue()` para campos aninhados (ex: `cells[r][c].text`)
   - `applyValue(v)` para retornar o patch (ex: clonar a matriz inteira de cells em vez de gravar `cell_r_c` flat)

   Engine ganhou `pickInlineEditor(container, { field?, worldPoint? })`:
   - Se `field` dado → match exato (usado por toolbar actions tipo "Editar descrição")
   - Senão se `worldPoint` dado → editor cujo `bounds` contém o ponto (dblclick na descrição abre o editor de descrição)
   - Senão → primeiro editor (fallback para dblclick na borda do elemento)

   `endInlineEdit` agora cacheia o descriptor ativo na hora do start e usa `applyValue` se houver, evitando que um rebuild do visual durante a edição mude o campo de destino.

   **Aplicações:**
   - `card.ts`: dois editors (título / descrição). `cardProvider.actions` ganhou "Editar título" e "Editar descrição" como ações separadas no toolbar.
   - `table.ts`: um editor por célula da tabela. `applyValue` clona a matriz inteira de cells e sobrescreve só a célula alvo, garantindo que a sincronização REST/WS não recebe um patch malformado.

1. **InlineEditor sai do lugar errado em layouts com header/sidebar** (`apps/web/src/canvas/engine.ts`, `apps/web/src/components/InlineEditor.tsx`).

   `engine.worldToScreen()` retorna coordenadas internas do canvas (relativas ao `<canvas>` em si). O `InlineEditor` usa `position: fixed`, que é **viewport-relative**. Como o canvas fica abaixo do `BoardHeader` (~60px) e à direita da `LeftToolbar` (~60px), o overlay aparecia drift up-left. Em `beginInlineEdit`, somamos `container.getBoundingClientRect().left/top` para emitir bounds em coords de viewport. O editor agora aparece exatamente sobre o texto.

   Bonus: o `beginInlineEdit` agora respeita escala/rotação do elemento (projetando os 4 cantos do `editor.bounds` via `c.toGlobal` → `world.toLocal` em vez de simplesmente somar `transform.x + bounds.x`), e propaga `fontWeight`, `fontStyle`, `fontFamily`, `textAlign`, `color` e `background` para o overlay HTML — assim o que você digita visualmente substitui o texto renderizado em vez de virar uma caixa branca neutra.

2. **Provider compartilhado de formatação de texto** (`apps/web/src/canvas/actions/providers/textFormat.ts`).

   Antes, só `text` tinha bold/itálico/align/cor/tamanho na toolbar. Sticky notes, retângulos e círculos viam apenas as ações específicas do tipo. Criei um `textFormatProvider` registrado **antes** dos providers por tipo, com `types: ['text', 'sticky_note', 'rectangle', 'circle', 'ellipse']`. As ações vão para o grupo `style` (já em PRIORITY_GROUPS visíveis) e o registry de-dupa por `id`, então não há colisão.

   `text.ts`, `sticky.ts` e `shapes.ts` perderam suas ações de "Editar texto" / Bold / Align — agora vêm do provider compartilhado. Mantive properties específicas (font family no text, presets de cor/tamanho no sticky, etc.).

3. **Renderers respeitam `style.fontWeight`, `fontStyle`, `align`, `color`, `fontSize`** (`apps/web/src/canvas/renderers/builtins/{stickyNote,rectangle,circle,text}.ts`).

   Sem isso, toggle de Bold no FloatingToolbar persistia no store mas não tinha efeito visual. Stickys/retângulos/círculos agora pegam todos os 5 campos do `style`. O `text` renderer também aceita `style.fontSize` como fallback do legacy top-level `fontSize` (o `textFormatProvider` escreve em ambos por compatibilidade).

   Em sticky/retângulo, o `align` também desloca o `txt.position.x` para `-width/2 + 12` (left), `width/2 - 12` (right) ou `0` (center) e ajusta `txt.anchor.x` correspondentemente, em vez de só passar `align` para o `TextStyle` (que apenas afeta wrapping de múltiplas linhas, não a posição do bloco).

4. **Setas de connector seguem a tangente real da linha** (`apps/web/src/canvas/connectors.ts`).

   `drawArrowHead` calculava o ângulo como `atan2(to.y - from.y, to.x - from.x)` — a direção reta entre os endpoints. Para `straight` está correto, mas para `curved` (bezier com cps `(midX, from.y)` e `(midX, to.y)`) e `elbow`, a tangente nos endpoints é **horizontal** (a curva entra/sai do ponto na direção X), não diagonal. Resultado: a seta apontava de viés enquanto a linha aproximava o destino na horizontal — ficava parecendo que a seta estava "solta".

   Adicionei `endTangentFor` e `startTangentFor` que calculam a direção real:
   - `straight`: `normalize(to - from)`
   - `elbow`: direção do último/primeiro segmento
   - `curved`: derivada do bezier em t=1 / t=0 (que aqui é horizontal por construção dos cps)

   `drawArrowHead` agora recebe um vetor tangente em vez de dois pontos, e o tamanho da cabeça escala com `strokeWidth` (`size = 10 + max(0, w-1) * 3`) — sem isso, conectores grossos tinham a base do triângulo do mesmo tamanho da espessura da linha, ficando com cara quadrada. Adicionei também um stroke 1px na cabeça pra ficar nítida em zoom out.

5. **Configuração de connectors** já estava implementada no `connectorProvider.actions` desde a passada anterior (estilo da linha curved/straight/elbow, lineStyle solid/dashed/dotted, arrowStart/arrowEnd com triangle/diamond/circle/none, cor, espessura via property panel, label, presets). O grupo `connector` já está nos `PRIORITY_GROUPS` da `FloatingToolbar`, então as ações aparecem no toolbar quando um connector é selecionado.

**Verificação:** `pnpm tsc --noEmit` limpo + lint limpo.

### 0.11. Toolbar não aparece + alterações não persistem após F5 — race do destroy/init do Pixi (2026-05-13)

**Problema reportado:** "A toolbar continua não aparecendo, além disso as movimentações dos elementos e mudanças de propriedades não estão sendo persistidas e perdemos após um refresh".

**Causa raiz (race entre dois engines do Pixi em StrictMode dev / HMR):**

`React.StrictMode` em dev faz mount → cleanup → mount. O `useEffect` de inicialização do canvas roda esse ciclo:

1. **Mount 1** → `engine_A = initCanvasEngine(container)`. `app.init({...})` é assíncrono e ainda está pendente. `setCanvasEngine(engine_A)`.
2. **Cleanup imediato (StrictMode)** → `engine_A.destroy()`. Como o destroy verificava `if (initialized) app.destroy()`, e `initialized` ainda era `false` (init pendente), pulava a destruição do app. A promise do `app.init()` continuava no ar.
3. **Mount 2** → `engine_B = initCanvasEngine(container)`. Outro `app.init({...})` pendente. `setCanvasEngine(engine_B)` é o que sobra no estado React.
4. **Promise do engine_A resolve** → executa o `then` que faz `container.appendChild(engine_A.canvas)` e `app.stage.on('pointerdown', ...)`. Anexa o canvas órfão **depois** que o React já adotou o engine_B.
5. Promise do engine_B resolve → também anexa seu canvas. Resultado: **dois canvases** no container, ambos capturando ponteiro.

`useBoardSync` registra listeners no engine que está no estado React (`engine_B`). Mas se o canvas de `engine_A` ficar por cima (depende da ordem de resolução das promises), todos os cliques vão para `engine_A`, que emite `selectionChange` / `element.updated` para um `events` map que ninguém escuta.

**Sintomas externos exatamente os reportados:**

- Selecionar elemento "não faz nada": `engine_A` atualiza sua seleção interna mas o handler React está em `engine_B` → `selectedIds` no store fica vazio → FloatingToolbar nunca aparece.
- Drag movimenta visualmente (porque `engine_A` aplica a translação) mas `element.updated` é emitido em `engine_A` → `useBoardSync.onUpdated` (no `engine_B`) nunca dispara → nenhum PATCH é enviado → F5 perde tudo.

Por isso os logs do backend mostravam ~30 PATCHes ao longo da sessão e depois **silêncio total** — o último evento de HMR derrubou e recriou o engine, ganhando o orfão a corrida.

**Correção em `apps/web/src/canvas/engine.ts`:**

1. **Flag `destroyed`** separada de `initialized`. `destroy()` marca `destroyed = true` antes de tudo.
2. **No `then` do `app.init()`**, se `destroyed === true`, chama `app.destroy()` localmente e **não** anexa o canvas nem registra listeners. O engine órfão se destrói silenciosamente.
3. **Limpa `container.firstChild` antes do init** — defesa em profundidade contra leftovers de HMR.
4. **`destroy()` também esvazia o `events` map**, garantindo que qualquer `emit()` atrasado (ex: timer pendente do flush) não chame closures React de um componente desmontado.

**Defesas adicionais aplicadas no mesmo passe:**

5. **Renderer placeholder para tipos desconhecidos** (`apps/web/src/canvas/engine.ts`). A versão anterior fazia `elementModels.delete(el.id)` quando `rendererRegistry.get(el.type)` era `undefined`, o que sumia com o elemento (continuava no store mas o engine não o conhecia). Agora desenha um retângulo vermelho com label do tipo — selecionável, arrastável, persistível. Tipos legados do schema (`line`, `arrow`) sem renderer agora aparecem visualmente em vez de desaparecer.

6. **`FloatingToolbar` clamp + flip** (`apps/web/src/components/FloatingToolbar.tsx`):
   - Clamp à largura do canvas (`engine.app.screen.width - tbWidth - 8`); sem isso, selecionar um elemento próximo da borda direita renderizava a toolbar fora da área visível e o `overflow: hidden` da `.canvas-area` cortava — visualmente igual a "não apareceu".
   - Se não cabe acima da seleção (perto do topo), a toolbar é flipada para BAIXO em vez de ficar oculta por cima da viewport.
   - Fallback de bounds: se `engine.getElementBounds(id)` retorna `null` (elemento ainda não mirroured no engine), usa `transform.x/y` como âncora 1×1 para a toolbar aparecer pelo menos perto de onde o usuário clicou.

7. **Logs de diagnóstico opcionais** — ative com `localStorage.setItem('orim:debug', '1')` no console do navegador. Logs:
   - `[engine] created/destroy/init complete { engineId }` — para correlacionar engines vivos.
   - `[page] selectionChange { engineId, ids }` — confirma se o engine que disparou a seleção é o mesmo que o React está usando.
   - `[sync] listeners attached/detached { engineId, pendingCount }` — confirma onde o useBoardSync se conectou.
   - `[sync] onUpdated { id, patchKeys }` — confirma que cada update chegou no listener.
   - `[sync] flush -> PATCH { count, keepalive }` — confirma os flushes para o backend.

**Arquivos:**

- `apps/web/src/canvas/engine.ts` — flag `destroyed`, init com auto-destroy, limpeza de container, placeholder renderer, `engineId` para diagnósticos.
- `apps/web/src/components/FloatingToolbar.tsx` — clamp/flip de posição + fallback de bounds.
- `apps/web/src/hooks/useBoardSync.ts` — logs de diagnóstico.
- `apps/web/src/pages/BoardEditorPage.tsx` — log de selectionChange com engineId.

**Verificação:** `pnpm tsc --noEmit` (limpo). Lint limpo nos 4 arquivos.

Sobre o `[vite] ws proxy socket error: Error: read ECONNRESET` no terminal — é apenas o proxy WS do Vite registrando que o navegador encerrou abruptamente uma conexão (refresh / aba fechada / HMR). Não afeta a persistência (PATCHes vão por HTTP, não WS) e não está relacionado ao bug acima.

### 0.10. Revisão completa dos componentes do whiteboard (2026-05-13)

**Problema reportado:** "Precisamos revisar a funcionalidade de todos os componentes do whiteboard, alguns quando adicionamos ao quadro não são renderizados, outros não exibem a barra de opções, outros não são redimensionados corretamente, o comportamento dos componentes está bem estranho".

Auditei todos os 11 tipos de elementos × 4 dimensões (renderer, action provider, resize, anchors). Encontrei e corrigi:

**1. Toolbar invisível para conectores.** `engine.getElementBounds(id)` retornava `null` para connectors porque eles vivem em `connectorsMap`, não em `elementMap`. A `FloatingToolbar` aborta quando `getElementBounds` é null, então a barra nunca aparecia ao selecionar um connector. Adicionado fallback que computa bbox a partir dos endpoints (com pad de 8 px para a barra não ficar em cima da linha).

**2. Cantos de resize cresciam simetricamente em torno do centro (todos os tipos).** A lógica antiga só anchorava o lado oposto para handles cardinais (n/s/e/w). Para handles de canto (nw/ne/sw/se), `newX/newY` ficavam em `startTransform`, ou seja, o centro do elemento ficava parado e o elemento crescia simetricamente — o canto oposto ao arrastado também se movia. Reescrito `applyResize` com modelo limpo:

   - Computa `newLeft/newRight/newTop/newBottom` em coordenadas de mundo, anchorando as arestas que NÃO estão sendo movidas.
   - Aplica clamp de tamanho mínimo na aresta móvel (não na ancorada).
   - Calcula `newBoundsCenter` e converte de volta para `transform` preservando o offset entre `transform` e `boundsCenter` (constante por tipo).

**3. Frame inflava cumulativamente.** O renderer de frame desenhava o título em `y < -h/2` (fora do retângulo do corpo). `localBounds` ficava `(-w/2, -h/2 - 28, w, h + 28)` — 28 px maior que `size.height`. A cada resize, `applyResize` calculava `newSize.height = startBounds.height + delta = (h + 28) + delta`, e a próxima rodada partia de `h + 56`, e assim por diante. Refatorado o renderer (`apps/web/src/canvas/renderers/builtins/frame.ts`) para colocar o title bar DENTRO do corpo, no topo. Agora `localBounds == size`, e a matemática nova de resize independe disso (já trata offset corretamente).

**4. Tabelas não redimensionavam.** `Table` não tem campo `size` (só `colWidths` / `rowHeights`), então o ramo `if ((el as any).size)` nunca disparava e o patch só mudava `transform`. Adicionado ramo dedicado: escala `colWidths` e `rowHeights` proporcionalmente ao delta de bounds. `endResize` também inclui esses arrays no patch final para persistência.

**5. Drawings, text e imagens sem `size` não redimensionavam.** Mesmo problema de (4). Adicionado fallback que escala via `transform.scaleX/Y` para QUALQUER tipo sem `size/radius/colWidths`. A matemática compensa o deslocamento causado pela escala (`newTransform = newBoundsCenter - newScale * localOffset`) — sem essa compensação, drawings (cujo `transform.x = 0` e pontos estão em coordenadas de mundo) "saltavam" lateralmente durante o resize. Para drawings e text com `transform = (0,0)`, `localOffset = startBoundsCenter / startScale`, garantindo que a aresta ancorada permanece exatamente no mesmo ponto após o resize.

**6. Tipos sem renderer registrado criavam containers fantasma.** Antes: se `rendererRegistry.get(el.type)` retornasse `undefined` (por exemplo, dado corrompido com `type: 'unknown'` da regressão anterior), o container era criado vazio, registrado em `elementMap` mas sem visual. Resize handles ao redor de `(0, 0)`, hit-test inutilizável, debug confuso. Agora `createElement` faz `console.warn` e descarta o elemento (também remove do `elementModels` para não vazar para serializações futuras).

**Arquivos:**

- `apps/web/src/canvas/engine.ts` — novo `applyResize`, novo `endResize` (inclui `colWidths/rowHeights` no patch), novo `createElement` com guard de renderer ausente, `getElementBounds` com fallback para conectores.
- `apps/web/src/canvas/renderers/builtins/frame.ts` — title bar dentro do corpo.

**Verificação:**

- `pnpm tsc --noEmit` (limpo).
- Auditoria manual: todos os 11 tipos de elemento têm renderer + provider de ações registrados (`apps/web/src/canvas/renderers/index.ts` + `apps/web/src/canvas/actions/index.ts`).

### 0. Whiteboard Usability Overhaul (2026-05-13)

Major refactor implementing the plan in `~/.cursor/plans/whiteboard-usability_*.plan.md`:

- **Engine refactor (`apps/web/src/canvas/engine.ts`)**
  - Drag emits final `element.updated` on `pointerup` so positions persist.
  - Pluggable selection / hover / lock states with proper visual handles.
  - Real working resize handles (8 corners) with size + position recompute.
  - External connection handles on hover (top/right/bottom/left).
  - Connector endpoint handles when a connector is selected (drag to reattach).
  - Inline edit request emit (`inlineEdit.start`) for HTML overlay editing.
  - Right-click → `contextMenu` event with screen coords + target id.
  - `applyMutation`-style API: `createElement`, `updateElement`, `deleteElement`, `setLocked`, `bringToFront/Back/Forward/Backward`, `alignSelection`, `distributeSelection`, `groupSelection`, `duplicateElement`, `insertElementAt`.
  - Selection emits `{ ids, primaryId }` (SelectionInfo) instead of bare array.

- **Pluggable connection system (`apps/web/src/canvas/connectors.ts`)**
  - Renderers can declare custom anchors via `__getAnchors`.
  - Connectors use `ConnectorEndpoint` (element+anchor or free point).
  - Customizable style: type (straight/curved/elbow), arrow start/end (none/triangle/diamond/circle), line style (solid/dashed/dotted), color, width, label.
  - Drag-to-connect with live preview, snap to anchors, "release on empty space → quick create" menu (`QuickCreateMenu`).

- **Action registry (`apps/web/src/canvas/actions/`)**
  - `ContextActionRegistry` mirrors the renderer registry pattern.
  - Global provider (duplicate, lock/unlock, group/ungroup, ordering, alignment, IA, delete) + per-type providers (sticky, text, shapes, frame, card, table, drawing, image, connector).
  - Same registry feeds `FloatingToolbar`, `ContextMenu`, and `PropertiesPanel`.

- **UI components**
  - `FloatingToolbar`: dynamic groups + submenus, positioned above selection screen rect.
  - `ContextMenu`: right-click menu with sections + nested submenus.
  - `InlineEditor`: HTML overlay positioned on canvas using engine `worldToScreen`.
  - `PropertiesPanel`: derived from registry; supports text/textarea/number/slider/color/select/toggle/tags fields.
  - `RemoteSelections`: HTML overlay drawing dashed boxes around selections of other users.
  - `SaveStatus`: small badge showing `idle / pending / syncing / error / offline`.
  - `QuickCreateMenu`: opens after dragging a connector into empty space.

- **Realtime sync (`apps/web/src/hooks/useBoardSync.ts` + `useSocket.ts`)**
  - Frontend emits `element:created/updated/transient/deleted` to the gateway and persists via REST as fallback (debounced 350ms + flush on `beforeunload`).
  - Echo prevention: store mutations originated from the wire are wrapped in `applyRemote(...)`, which sets `isRemoteMutation`; while flagged, store actions tell the engine to skip emit so we don't loop back through `useBoardSync` → socket.
  - `useBoardSync` mirrors engine emissions (drag, resize, inline edit) back into the Zustand store, so UI selectors / actions providers always see fresh state without each provider doing it manually.
  - Drag emits `element.transient` for live broadcasting; final `element.updated` persists.
  - Selection broadcast via `selection:changed` for collaboration ghosts.
  - Image upload now actually emits `element.created` and persists.

- **Backend (`apps/api/src/`)**
  - `BoardsService.patchElements` and `deleteElement` now check membership/role.
  - Gateway aligned with new payload shapes (`{ id, patch }`, `selection.changed`, etc.) and persists through `BoardsService` when an element is created via WS.
  - `findOne` validates board membership.

- **Shared (`packages/shared/src`)**
  - `ConnectorElement` now uses `ConnectorEndpoint` (legacy `fromId/toId/fromAnchor/toAnchor` retained for backward compat).
  - Added `ImageElement`, `ElementMetadata` (with `locked/zIndex/groupId/hidden`), connector style enums, `card`/`drawing`/`table`/`image` listed in `elementTypes`.

### 0.9. Estado do board perdido em F5 (2026-05-13)

**Problema reportado:** "Ainda estamos com o problema de perder o estado do board em um f5".

**Causa raiz (combinação de dois bugs em `useBoardSync`):**

1. **Closure obsoleta no `beforeunload`.** O handler de `beforeunload` era registrado em `useEffect(..., [])` (deps vazias), capturando o `flush` do PRIMEIRO render. Nesse momento, `useBoardSync(boardId, canvasEngine, socket)` ainda recebia `canvasEngine === null` (a engine só existe depois do init effect). Esse `flush` "antigo" tinha `engine = null` para sempre.

2. **`pendingRef` armazenava só o patch parcial.** Em `onUpdated`, a fila guardava `Partial<CanvasElement>` (ex: `{ transform: {...} }`). No flush, o op completo era reconstruído via `engine?.getElement(id) ?? patch`. Funcionava no flush debounced normal (engine válido), mas no flush do beforeunload (closure congelada com engine=null), caía no fallback `?? patch`. O op ia para o backend com:

   ```ts
   { id, type: 'unknown', data: {}, transform: {...}, style: {}, metadata: {} }
   ```

3. **Backend faz upsert sobrescrevendo os campos.** `boards.service.ts` aceita qualquer string em `type` e sobrescreve sempre. Resultado: a row do elemento no DB ficava com `type='unknown'` e `data={}`. No próximo F5, `flattenElement` devolvia um elemento `type: 'unknown'` que nenhum renderer reconhece — o elemento sumia visualmente.

   Reprodução: arrastar um elemento → F5 antes do debounce de 350ms terminar → após reload o elemento volta sem aparecer / sem dados.

**Correção em `apps/web/src/hooks/useBoardSync.ts`:**

1. **`pendingRef` agora armazena `Map<string, CanvasElement>` (snapshot completo).** Em `onUpdated`, fazemos `pendingRef.current.set(id, engine.getElement(id))` para capturar o estado merged completo. O flush não depende mais de re-consultar a engine.
2. **`flushRef` para o beforeunload.** `const flushRef = useRef(flush); flushRef.current = flush;` é atualizado a cada render, e o handler chama `flushRef.current({ keepalive: true })`. Sempre usa a closure mais nova (engine atual + boardId atual).
3. **Defesa em profundidade no flush.** Se o snapshot por algum motivo não tiver `type`, o op é descartado com warning em vez de mandar lixo para o backend. Melhor perder uma atualização do que corromper a row inteira.

**Por que isso só aparecia no F5:** o flush debounced normal (rodando depois que `canvasEngine` virou não-null) sempre tinha engine válido e reconstruía os ops corretamente. O F5 era o único caminho que disparava o flush via closure obsoleta.

### 0.8. `world.pivot` com sinal invertido — desalinhamento cursor↔render (2026-05-13)

**Problema reportado:** "Isso acontece até mesmo para a seleção de elementos, a seleção mostra uma posição completamente diferente do cursor do mouse".

**Causa raiz:** `updateWorldTransform` em `apps/web/src/canvas/engine.ts` configurava o `world.pivot` com **sinal invertido**:

```ts
world.position.set(cx, cy);
world.scale.set(viewport.zoom);
world.pivot.set(-viewport.x, -viewport.y); // ← ERRADO
```

A semântica de pivot no Pixi é "qual ponto local é ancorado a `position`". Como `screenToWorld((cx, cy)) === (viewport.x, viewport.y)` (centro da tela mostra esse ponto do mundo), o pivot precisa ser `(viewport.x, viewport.y)`, não o negado. Com o sinal errado, o Pixi renderizava tudo deslocado por **2×viewport** em relação a onde `screenToWorld` colocava — mas como `world.toLocal` é o inverso da matriz do Pixi, qualquer função que misturasse `screenToWorld` (matemática nossa) com `world.toLocal`/`container.toGlobal` (matemática do Pixi) ficava em sistemas de coordenadas diferentes assim que o usuário panava ou zoomava (com vp=0,0 ambos os sinais dão pivot=0,0 e o bug ficava escondido).

**Sintomas que TODOS vinham daqui:**
- Retângulo de seleção aparece longe do elemento clicado.
- Conector "voltou a ter problema de posicionamento, as primeiras funcionam mas depois de algumas interações o destino é completamente alterado" — `findNearestAnchor` comparava `worldPoint` (de `screenToWorld`) com `parent.toLocal(...)` (do Pixi); ficava off por 2×vp.
- `getElementAtScreenPoint` errava qual elemento estava sob o cursor.
- Drag pickup, hover handles, resize handles — qualquer coisa baseada em hit-test usava o ponto errado.

**Correção:**

1. **`apps/web/src/canvas/engine.ts`** — `world.pivot.set(viewport.x, viewport.y)` (sem negação).
2. **`apps/web/src/canvas/engine.ts`** — `drawGrid` usava `-viewport.x/-viewport.y` para calcular o range visível (consistente com o pivot errado). Trocado para `+viewport.x/+viewport.y`, alinhado com a matemática real de `screenToWorld`.

**Por que isso não quebra dados existentes:** todo `transform.x/y` salvo veio originalmente de `screenToWorld(cursor)` ou drag `c.position.set` baseado em `screenToWorld`. Ou seja, os números no banco já estão na "matemática certa". O bug era apenas Pixi pintando esses números no lugar errado quando vp ≠ 0. Após a fix, os mesmos números renderizam onde sempre deveriam.

### 0.7. Cursor:move ainda excessivo + conexões "fugindo" do alvo (2026-05-13)

**Problema reportado:** "Ainda estamos enviando muitas requisições no cursor move, e voltamos a ter o problema de posicionamento das conexões, as primeiras funcionam mas depois de algumas interações o destino é completamente alterado".

**Diagnóstico:**

1. **Cursor:move:** o coalesce por `requestAnimationFrame` (rodada 0.6) ainda permite **até 60 emits/seg**, o que para um whiteboard colaborativo continua elevado.
2. **Connector "destination completamente alterado":** `getElementAtScreenPoint` iterava `elementMap` em ordem de inserção e deixava o **último match ganhar**. Isso quebra após qualquer mudança de z-order (`bringToFront` / `sendToBack` / `bringForward` / `sendBackward`) ou após elementos serem deletados/recriados — a ordem em `elementMap` deixa de refletir a ordem visual de pintura, e o conector acaba grudando em um elemento atrás visualmente em vez do que está em cima do ponteiro. "As primeiras funcionam" porque, antes de qualquer reordenação, ordem de inserção = ordem visual.

**Correções:**

1. **`apps/web/src/pages/BoardEditorPage.tsx`** — throttle de `cursor:move` agora é por **tempo (60ms ≈ 16Hz)** com leading + trailing edge: o primeiro movimento emite na hora, os subsequentes esperam o intervalo, e o último ponto sempre é entregue via `setTimeout`. Reduz tráfego em ~4x comparado ao rAF puro.
2. **`apps/web/src/hooks/useBoardSync.ts`** — mesmo modelo (60ms time-based) aplicado ao `element:transient` no envio.
3. **`apps/web/src/canvas/engine.ts`** — `getElementAtScreenPoint` reescrito para **iterar `elementsContainer.children` em ordem reversa** (top-of-z-order primeiro) e retornar o **primeiro match**. Isso espelha exatamente a ordem de pintura, então o elemento visualmente em cima é o que vence.
4. **`apps/web/src/canvas/engine.ts`** — `Container.name = el.id` é deprecado em Pixi v8; agora também marcamos `(container as any).__elementId = el.id` para fazer reverse-lookup id ↔ container de forma estável (usado no novo `getElementAtScreenPoint`).

**Resultado esperado:** WS cai de ~60 para ~16 cursor events/seg/usuário; conexões sempre apontam para o elemento que está visualmente sob o ponteiro independentemente da quantidade de operações de z-order anteriores.

### 0.6. WebSocket spam + suspeita de race na persistência (2026-05-13)

**Problema reportado:** "olhando as requisições no websocket, enviamos até as movimentações do cursor, isso faz sentido? pode ser que estejamos enfrentando um problema de race condition, porque quando as movimentações dos elementos não estão sendo persistidas".

**Diagnóstico:** o frontend estava bombardeando a conexão sem throttle algum:
- `cursor:move` era emitido em **todo `mousemove`** do DOM (com mouse de alta taxa de polling pode ser >120Hz).
- `element:transient` era emitido em **todo `pointermove`** durante drag, **por elemento arrastado** (selecionar 5 e arrastar = ~600 mensagens/seg).
- Receber `element.transient` chamava `engine.updateElement` (com pipeline completo: position + iterar todos os connectors + `renderSelection`) por mensagem, sem coalescer.
- `cursor.moved` chamava `setState` no `RemoteCursors` por mensagem, re-renderizando para todos os usuários a cada cursor.

Não havia race condition no fluxo de persistência REST em si (`pendingRef` é uma `Map` por id, `flush()` substitui a referência antes de aguardar a resposta), mas o backlog WS competia pelo event-loop do Node e do browser, atrasando os PATCHes a ponto de algumas atualizações desaparecerem em cenários de drag rápido + tab close / refresh imediato.

**Correções:**
1. **`apps/web/src/pages/BoardEditorPage.tsx`** — `trackCursor` agora coalesce via `requestAnimationFrame`: no máximo 1 emit `cursor:move` por frame.
2. **`apps/web/src/hooks/useBoardSync.ts`** — `onTransient` acumula `Map<id, transform>` e flush via `rAF`. `onUpdated` (evento de pointerup / commit / property change) descarta qualquer transient pendente para o mesmo id, já que o patch "settled" supersede.
3. **`apps/web/src/hooks/useSocket.ts`** — recepção de `element.transient` também coalesce em rAF, aplicando só o último transform por id por frame em `engine.updateElement`.
4. **`apps/web/src/components/RemoteCursors.tsx`** — `cursor.moved` acumula em ref e flush via rAF. Único `setState` por frame independentemente de quantos remotes estão movendo o mouse.
5. **`apps/web/src/lib/api.ts`** — `patchElements` e `deleteElement` aceitam `keepalive: true` (necessário para o flush no `beforeunload` sobreviver à navegação).
6. **`apps/web/src/hooks/useBoardSync.ts`** — `flush()` agora tem guard contra concorrência (`flushingRef` + `reflushRef`): se um flush é disparado enquanto outro está em voo, ele não inicia uma segunda PATCH em paralelo — marca "preciso flushar de novo" e o flush atual re-executa quando termina. Isso elimina possibilidade real de duas PATCHes pisarem na mesma linha do DB. O flush no `beforeunload` agora passa `{ keepalive: true }`.

**Resultado esperado:** tráfego WS cai de centenas de mensagens/seg para até 60/seg, persistência mais consistente especialmente em refresh/close logo após arrastar, e sem renders supérfluos durante presença ativa.

### 0.5. Toolbar mal posicionada (2026-05-13)

**Problema:** depois do fix de "toolbar não aparecendo", a `FloatingToolbar` voltou a aparecer mas em posição completamente errada (longe do elemento selecionado).

**Causa:** estava usando `position: fixed` com coords vindas de `engine.getSelectionScreenRect()` (que devolve coords absolutas de viewport via `getBoundingClientRect()` + `worldToScreen`). Esse approach é frágil: qualquer ancestral com `transform`, `filter`, `perspective` ou `will-change` re-âncora o `fixed` para esse ancestral em vez do viewport, e a animação `floatIn` (definida em `.floating-toolbar`) usa `transform: translateY(...)`, criando um stacking context que pode interagir mal com browsers em algumas situações. Resultado: a toolbar acabava no canto da tela em vez de acima da seleção.

**Correção:** trocou para `position: absolute` relativo ao `.canvas-area` (que já é `position: relative` e parent direto da toolbar). Em vez de chamar `getSelectionScreenRect`, agora a toolbar itera sobre `selectedIds`, lê `engine.getElementBounds(id)` (coords de mundo) e converte cada canto via `engine.worldToScreen(...)`, que devolve coords relativas ao top-left do canvas-container. Como o canvas-container preenche 100% do canvas-area, os mesmos números servem para `position: absolute` na toolbar.

Também adicionado um `requestAnimationFrame` extra após o tick inicial para casos onde `offsetWidth` ainda não está medido corretamente no primeiro paint (HMR, primeiro render lento).

**Arquivo:** `apps/web/src/components/FloatingToolbar.tsx`

### 0.4. Toolbar somindo no left-click + conector grudando à esquerda (2026-05-13)

**Problemas:**
1. A `FloatingToolbar` voltou a aparecer apenas no right-click — em left-click ela não pintava.
2. As linhas de conexão sempre apareciam encostadas na lateral esquerda do elemento de destino, independente de onde o usuário soltou o conector.

**Causas:**
- `FloatingToolbar` gateava todo o JSX em `if (!position) return null`. A `position` só era setada dentro do `useEffect` por `setInterval` + comparação de coords. Se o primeiro `getSelectionScreenRect()` voltasse `null` (race com `app.init()` ainda terminando, troca rápida de seleção etc.) ela nunca atualizava — o efeito não chamava `setPosition` para o caso `null`, então o `position` ficava `null` para sempre. No right-click o fluxo continuava até o `ContextMenu`, dando a falsa sensação de que "só funciona no botão direito".
- `findNearestAnchor` comparava `worldPoint` (em coords de mundo, vindo de `screenToWorld`) com `container.toGlobal(localPt)` (coords globais/screen). Como global ≈ world × zoom + offset, o anchor com menor X global "ganhava" sempre — visualmente isso é a borda esquerda do elemento. Bug existia desde sempre, mas só ficou perceptível agora que o render do conector já não mascarava o erro.
- `QuickCreateMenu` usava `anchorId: 'left'` hardcoded ao re-anchorar o conector no novo elemento criado.

**Correções:**
- `FloatingToolbar` reescrita: render condicionado a `ctx + selectedIds + grouped.length`, posicionamento em `useLayoutEffect` (síncrono pré-paint), e quando `position` ainda é `null` o toolbar é renderizado oculto (`visibility: hidden` em `-9999,-9999`) para que o `ref` exista e o `tick()` consiga medir o `offsetWidth/Height`. Assim o primeiro frame visível já tem posição correta.
- `findNearestAnchor` agora converte cada anchor para coords de mundo via `container.parent.toLocal(container.toGlobal(localPt))` antes de comparar com `worldPoint`. A comparação acontece no mesmo espaço.
- `QuickCreateMenu` chama `engine.computeNearestAnchor(elementId, worldPoint)` (novo método público) que delega para `findNearestAnchor`. Default `'center'` se a engine não responder.

**Arquivos:**
- `apps/web/src/components/FloatingToolbar.tsx`
- `apps/web/src/canvas/connectors.ts`
- `apps/web/src/canvas/engine.ts` (interface `CanvasEngine` + `computeNearestAnchor`)
- `apps/web/src/components/QuickCreateMenu.tsx`

### 0.3. Conector na posição errada + memory leak (2026-05-13)

**Problemas:**
1. Ao conectar dois elementos, a linha do conector aparecia em coordenadas erradas (ficava correta apenas depois de mover o mundo / arrastar um dos elementos).
2. O navegador travava após algum tempo de uso — leak claro.

**Causas:**
- `createConnectorContainer` chamava `update()` (que faz `container.toLocal(globalPt)`) **antes** do container ser adicionado ao `connectorsContainer`. Sem parent, `toLocal` não aplica a inversa do `world.transform`, então a linha era desenhada em coordenadas-globais como se fossem coordenadas de mundo. O `refreshConnectors` corrigia depois, mas a primeira renderização ficava errada.
- `Container.removeChildren()` no Pixi v8 apenas detacha os filhos — **não libera os GraphicsContext / texturas**. O engine usava `removeChildren()` em todos os ciclos de re-render: `renderHover`, `renderSelection`, `rebuildElementVisual`, `clearGuides`, `drawGrid`. Cada hover, cada seleção, cada mudança de cor vazava buffers GPU. Com uso prolongado, a tab consumia centenas de MB e travava no GC.
- `FloatingToolbar` usava `setInterval(updatePos, 100)` chamando `setPosition({left, top})` com referência nova a cada tick — re-render React 10× por segundo enquanto havia seleção, mesmo idle.

**Fix:**
- Em `connectors.ts`: removida a chamada de `update()` no fim de `createConnectorContainer`; o caller agora é responsável por chamar `__updateConnector` *após* `addChild`. Em `rebuildConnector`, isso é feito explicitamente após o `connectorsContainer.addChild(c)`.
- Novo helper `destroyChildren(container)` em `engine.ts` que faz `removeChildren()` + `child.destroy({ children: true })` em cada item. Aplicado em `drawGrid`, `clearGuides`, `renderSelection`, `renderHover`, `rebuildElementVisual`, no clear do hover durante drag/connector-drag e no fim do drag.
- `deleteElement` e `rebuildConnector` agora destroem com `{ children: true }` para liberar recursos aninhados.
- Em `createElement`, ao criar um elemento, em vez de fazer `rebuildConnector(cid)` em **todos** os conectores (que destruía e recriava cada um), agora apenas chama `__updateConnector` nos conectores que realmente referenciam o elemento recém-criado.
- `FloatingToolbar` e `RemoteSelections` mantêm `last*` locais e só chamam `setState` quando os valores realmente mudam — sem re-renders ociosos.

**Arquivos:**
- `apps/web/src/canvas/connectors.ts`
- `apps/web/src/canvas/engine.ts`
- `apps/web/src/components/FloatingToolbar.tsx`
- `apps/web/src/components/RemoteSelections.tsx`

### 0.2. Engine recriado, right-click sem seleção, handles de conexão sumindo (2026-05-13)

**Problemas:**
1. Excluir elementos parecia falhar de forma intermitente.
2. A `FloatingToolbar` só aparecia depois de clicar com o botão direito (ContextMenu), nunca após left-click.
3. Ao mover o cursor para clicar nos pontos de conexão externos do hover, eles sumiam antes do clique chegar.

**Causas:**
- O `useEffect` em `BoardEditorPage` que monta o engine dependia de `handleSelect/handleContextMenu/...`, que por sua vez dependiam de `sendSelection` (do `useSocket`). Quando o usuário logado mudava de `null` para `User`, o `useSocket` reconectava o socket, recriava `sendSelection`, propagava até `handleSelect`, e o engine inteiro era destruído e remontado — perdendo seleção, listeners e visuais. Isso explicava por que a exclusão / seleção / toolbar pareciam falhar de forma aleatória.
- O right-click só emitia `contextMenu` sem mexer na seleção, então a `FloatingToolbar` (que depende de `selectedIds.length > 0`) nunca era exibida quando o usuário só usava o botão direito.
- Os 4 círculos de conexão externos eram filhos do `hoverContainer`. Quando o cursor saía do bounding-box do elemento (caminho natural até os handles), o `pointerout` no container chamava `setHovered(null)` imediatamente, removendo os handles antes do cursor chegar neles.

**Fix:**
- Em `BoardEditorPage`, os handlers (`handleSelect`, `handleContextMenu`, `handleInlineEditStart/End`, `handleConnectorOpenEnd`) ficam em refs (`handleSelectRef.current = useCallback(...)`), e o `useEffect` do engine usa wrappers (`(info) => handleSelectRef.current(info)`). As deps do `useEffect` viraram apenas `[boardId, setEngine, setElements]`, todos estáveis. O engine agora é criado exatamente uma vez por board.
- No engine, o `pointerdown` com `e.button === 2` (em elementos e conectores) agora também adiciona o alvo a `selectedIds` (caso ainda não esteja) antes de emitir `contextMenu`. Resultado: ao clicar com botão direito, ContextMenu e FloatingToolbar aparecem juntos.
- `setHovered` reescrito com `hoverClearTimer` (180 ms). Sair do elemento agenda a limpeza; entrar em qualquer handle ou voltar ao elemento cancela o timer (`cancelHoverClear`). Cada handle ganhou também uma área de hit invisível 2× maior e listeners de `pointerover`/`pointerout` próprios para tornar o hover bem mais permissivo. O `destroy()` e o início real do drag também cancelam o timer.
- `SaveStatus` ganhou `pointer-events: none` para não engolir cliques na região inferior esquerda do canvas.

**Arquivos:**
- `apps/web/src/pages/BoardEditorPage.tsx`
- `apps/web/src/canvas/engine.ts`
- `apps/web/src/components/SaveStatus.css`

### 0.1. Persistência de ações + ghost no drag (2026-05-13)

**Problemas:**
1. Mudanças de posição (drag) não persistiam após F5 quando vinham acompanhadas de mudanças de propriedade feitas pela toolbar/menu/painel.
2. Ações de toolbar / context menu / painel direito (cor, lock, status, tags, etc.) mudavam visualmente mas se perdiam após reload.
3. Ao arrastar um elemento, ficava um "fantasma" com os pontos de conexão (handles externos) na posição original.

**Causas:**
- `boardStore` chamava `engine.updateElement` com `skipEmit: true` para todas as mutações originadas no React (toolbar, painel, atalhos). Isso impedia o `useBoardSync` (que escuta apenas `engine.on('element.updated')`) de receber qualquer mutação iniciada via Zustand. Apenas drag persistia, porque o engine fazia o emit final em `pointerup`.
- Os "hover handles" (outline + 4 círculos de conexão) ficavam desenhados em `hoverContainer` em coordenadas-mundo da posição original e nunca eram limpos quando o drag começava.

**Fix:**
- Substituído o uso de `skipEmit` rígido pela flag `isRemoteMutation` no store, ativada via novo helper `applyRemote(run)`. Mutações locais agora sempre dispararam emit no engine; mutações vindas do socket usam `applyRemote` para evitar loop.
- `useBoardSync` agora também espelha cada emit do engine de volta para o Zustand (via `useBoardStore.setState`), mantendo o estado React em sincronia com drag/resize/inline edit sem cada provider precisar duplicar lógica.
- `useSocket` simplificado para usar `applyRemote`; removido o frágil `__orimEchoMark`.
- Engine: ao detectar movimento real durante drag (`dragSession.moved` torna `true`), `hoverContainer.removeChildren()` é chamado para apagar os handles. Ao final do drag, `hoveredId` é resetado para que o próximo `pointerover` re-renderize na posição nova.
- Adicionado `console.error('[useBoardSync] patch failed', ...)` e `readErrorMessage` em `lib/api.ts` para facilitar diagnóstico futuro.

**Arquivos:**
- `apps/web/src/stores/boardStore.ts`
- `apps/web/src/hooks/useBoardSync.ts`
- `apps/web/src/hooks/useSocket.ts`
- `apps/web/src/canvas/engine.ts`
- `apps/web/src/lib/api.ts`

### 1. Vite Proxy Rewrite (2026-05-13)

**Problem:** `/api/auth/register` was being forwarded to `/api/auth/register` on the backend (404) instead of `/auth/register`.

**Fix:** Added `rewrite: (path) => path.replace(/^\/api/, '')` to the Vite proxy config.

**File:** `apps/web/vite.config.ts`

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
  '/socket.io': {
    target: 'http://localhost:3001',
    changeOrigin: true,
    ws: true,
  },
}
```

### 2. PixiJS `app.destroy()` Crash (2026-05-13)

**Problem:** `app.destroy()` was called before `app.init()` completed, causing `this._cancelResize is not a function`.

**Fix:** Added `initialized` flag and `try/catch` in `destroy()`.

**File:** `apps/web/src/canvas/engine.ts`

```typescript
let initialized = false;
app.init({ ... }).then(() => { initialized = true; ... });

destroy() {
  if (initialized) {
    try { app.destroy(true, { children: true }); } catch { /* ignore */ }
  }
  // ... remove event listeners
}
```

### 3. PATCH `/boards/:id/elements` 500 Error (2026-05-13)

**Problem:** The endpoint returned 500 for all element operations. Root cause was twofold:

1. **Prisma `upsert` with empty ID:** When creating new elements (no `id`), `where: { id: op.id ?? '' }` passed an empty string to Prisma, which failed with `Error creating UUID, invalid length: expected length 32 for simple format, found 0`.
2. **Missing required fields in `create`:** `data` and `transform` were `undefined` in the Prisma `create` block when not provided by the frontend.
3. **Zod validation errors returning 500:** The `GlobalExceptionFilter` treated all non-HttpException errors as 500, including `ZodError`.

**Fix:**
- Replaced `upsert` with explicit `update` (when `id` exists) / `create` (when no `id`) logic.
- Added `(op.data ?? {})` and `(op.transform ?? {})` fallbacks in `create`.
- Made `data` and `transform` optional in the Zod schema.
- Updated `GlobalExceptionFilter` to handle `ZodError` as 400 Bad Request with issue details.

**Files:**
- `apps/api/src/boards/boards.service.ts`
- `apps/api/src/common/http-exception.filter.ts`

---

## Architecture Decisions

### Backend: NestJS + Fastify (not Express)

The API uses `@nestjs/platform-fastify` instead of the default Express adapter. This affects:
- Cookie handling via `@fastify/cookie`
- File uploads via `@fastify/multipart`
- CORS via `@fastify/cors`
- Exception filter uses `FastifyReply` instead of Express `Response`

**Important:** When writing new controllers, remember to use Fastify-compatible request/response types.

### Database: JSONB for Element Data

All element type-specific properties are stored in a single `data` JSONB column. The Prisma schema does not have separate tables per element type. This keeps the schema simple but requires careful typing on the frontend.

### Auth: httpOnly Cookies (not localStorage)

Tokens are stored in httpOnly cookies to prevent XSS theft. The frontend must send `credentials: 'include'` on all fetch requests. The Vite proxy must preserve cookies (`changeOrigin: true`).

### WebSocket Path

Frontend connects via `io('/', { transports: ['websocket'], withCredentials: true })`. Vite proxies `/socket.io` to the backend. If this fails in production, connect directly to `io('http://localhost:3001', ...)`.

### Monorepo: ESM-First

All packages use `"type": "module"` and `.js` extensions in TypeScript imports. The shared package is built with `tsup`.

---

## Known Limitations & TODOs

### High Priority

- [ ] **No database seed script** — Test users were created manually. Need a `prisma/seed.ts` for reproducible dev environments.
- [ ] **AI is mocked** — `AIService` uses keyword matching, not a real LLM. Integrate OpenAI/Claude API.
- [ ] **No email service** — Password reset is not implemented.
- [ ] **No board sharing / invites** — Members are only created on board creation. Need invite links and email invites.
- [ ] **No permissions check on element operations** — Any authenticated user can PATCH any board's elements.

### Medium Priority

- [ ] **Bundle size** — BoardEditorPage chunk is ~376KB gzipped (PixiJS). Consider lazy-loading PixiJS or tree-shaking.
- [ ] **No optimistic updates on element patch** — `useBoardSync` flushes after 500ms; no immediate UI feedback.
- [ ] **No offline support** — Changes are lost if the browser closes before flush.
- [ ] **No real tests** — No unit or e2e tests exist.
- [ ] **Socket.io rooms not cleaned up** — `handleDisconnect` removes from local `users` map but doesn't verify Redis cleanup.
- [ ] **MinIO public URLs** — Uploaded files are accessible by URL guessing (no signed URLs).

### Low Priority / Polish

- [ ] **Drawing mode** — Freehand drawing exists but needs smoothing/serialization improvement.
- [ ] **Connector routing** — Only basic straight/curved/elbow connectors; no auto-routing around obstacles.
- [ ] **Table editing** — Tables render but inline cell editing is limited.
- [ ] **Presentation mode** — Exists but transitions are basic.
- [ ] **App marketplace** — No payment/subscription system for apps.

---

## Code Conventions

### Backend
- Use `.js` extensions in all TypeScript imports (ESM requirement)
- Validate all inputs with Zod schemas
- Use `HttpException` for expected errors; everything else is caught by `GlobalExceptionFilter`
- Prisma queries should use `$transaction` for batch operations

### Frontend
- Use `.js` extensions in all TypeScript imports
- Prefer Zustand for global state; use local state for component-level UI
- Canvas engine events: `element.created`, `element.updated`, `element.deleted`
- API client lives in `apps/web/src/lib/api.ts`

### Shared
- Types and schemas go in `packages/shared/src/`
- Export from `packages/shared/src/index.ts`

---

## Environment Quick Reference

```bash
# Infrastructure
docker compose up -d   # Postgres, Redis, MinIO

# API
cd apps/api && pnpm dev          # Port 3001
pnpm prisma migrate dev          # Run migrations
pnpm prisma studio               # DB GUI

# Web
cd apps/web && pnpm dev          # Port 3000

# Full monorepo
pnpm dev                         # Runs both via turbo
```

### Service Ports

| Service | Port | Credentials |
|---------|------|-------------|
| Web | 3000 | — |
| API | 3001 | — |
| PostgreSQL | 5432 | `orim` / `orim_secret` |
| Redis | 6379 | — |
| MinIO API | 9000 | `orim` / `orim_secret_key` |
| MinIO Console | 9001 | `orim` / `orim_secret_key` |

---

## Test Data

### Users

```sql
SELECT id, email, name FROM users;
-- 33d5b181-c55c-49ad-b012-b767a4a9e5ff | test@example.com | Test
-- 0f7ef8ff-6071-40d7-b6e3-3114978f12ba | upload@test.com  | Upload
```

Password for both: `123456`

### Boards

Query to find boards:
```sql
SELECT id, name, owner_id FROM boards;
```

---

## Debugging Tips

### API not responding?
```bash
curl http://localhost:3001/health
# Check: lsof -i :3001
# Kill:  kill -9 $(lsof -t -i:3001)
```

### WebSocket not connecting?
- Check Vite proxy in `apps/web/vite.config.ts`
- Check browser DevTools → Network → WS tab
- Try connecting directly to `ws://localhost:3001/socket.io`

### Database issues?
```bash
# Reset everything (DANGER: loses data)
docker compose down -v && docker compose up -d
pnpm db:migrate
```

### TypeScript errors?
```bash
pnpm tsc --noEmit
```

---

## Next Session Suggestions

Based on current state, here are the most impactful next tasks:

1. **Add Prisma seed script** — Create `prisma/seed.ts` with test users, boards, and sample elements.
2. **Implement board permissions** — Check if the requesting user is a member before allowing element mutations.
3. **Add board sharing / invites** — Generate invite links, send emails, allow public read-only boards.
4. **Integrate real AI** — Replace mock AI with OpenAI/Claude API calls.
5. **Add tests** — Start with API integration tests (Supertest) and canvas engine unit tests.
6. **Optimize bundle** — Lazy-load PixiJS, code-split marketplace page.
7. **Add offline support** — Use IndexedDB to queue changes when offline.
8. **Email service** — Set up SendGrid/Resend for password reset and invites.

---

## Contact / Context

This project is actively developed. When starting a new session:
1. Read this file first
2. Check `README.md` for architecture overview
3. Run `pnpm dev` and verify `curl http://localhost:3001/health` responds
4. Check the latest git log for recent changes
