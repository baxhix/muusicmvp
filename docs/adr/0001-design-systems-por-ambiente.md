# ADR-0001: Design Systems por ambiente — Admin · Landing · Plataforma

**Status:** Proposto
**Data:** 2026-06-21
**Deciders:** Marcelo (produto/eng)

---

## Contexto

A muusic tem **três ambientes com linguagens de UI propositalmente diferentes**, mas
hoje os tokens de design não estão separados de forma limpa:

| Ambiente | Onde vive | Linguagem | Estado do DS hoje |
|---|---|---|---|
| **Admin** | app Next **separado** (`admin/`) | clara/utilitária, densa | ✅ **isolado** — `admin/src/app/globals.css` próprio (~141 tokens) + página viva `/design-system` |
| **Plataforma** | `src/app/app/*` → `/app` | dark near-black, verde de marca, roxo/rosa, motion | compartilha o `:root` do `src/app/globals.css` |
| **Landing** | `/teste`, `/para-artistas`, `/blog` (+ `/`) | editorial, Borscha, acento ciano, raios mais suaves | **mesmo `:root`** da Plataforma |

**Forças em jogo:**

1. **Acoplamento Landing↔Plataforma.** As duas vivem no mesmo app `src/` e leem o mesmo
   `:root`. Mudar um token da plataforma (ex.: a escala tipográfica recém-consolidada
   12/14/16/18/22/28, ou `--accent` verde) afeta a landing e vice-versa.
2. **Escopo inconsistente.** O único override de landing — `[data-page="landing"]` — só é
   aplicado em `/` (`src/app/page.tsx`). Logo, `/teste`, `/para-artistas` e `/blog`
   renderizam hoje com os **tokens da Plataforma** (verde, raios da plataforma), apesar de
   serem superfícies de marketing. Já é uma inconsistência visual latente.
3. **Next App Router = CSS global cascateia.** CSS importado em *qualquer* layout aplica no
   app inteiro; não dá pra "isolar" um DS só importando um arquivo diferente por rota. A
   separação precisa ser por **escopo de seletor** (atributo/classe), não por import.
4. **main = produção, sem staging.** Qualquer mudança de token re-resolve em superfícies
   reais. Migração tem que ser incremental, por rota, com QA no preview antes de mergear.
5. O DS da Plataforma foi consolidado há pouco (cores `--purple`/`--pink`, raios 999/8,
   guardrail stylelint) — **não queremos regredir isso** ao mexer na estrutura.

**Objetivo:** dar à **Landing um conjunto de tokens próprio e independente**, sem tocar na
Plataforma, mantendo o Admin como está.

---

## Decisão

Separar **Landing × Plataforma** dentro do `src/` por **escopo de atributo `data-env`**, com
a Plataforma como tema-base (`:root`) e a Landing como tema-variante escopado.

- `:root` → continua sendo a **linguagem da Plataforma** (default; `/app` é a maior
  superfície e já está consolidada → **zero mudança**).
- `[data-env="landing"]` → bloco **completo** de overrides da Landing (não os 6 de hoje:
  cobre cor, acento, raio, e — onde divergir — tipografia/spacing).
- O atributo `data-env="landing"` é setado no **layout de cada rota de landing**
  (no `<body>`/wrapper), substituindo o `data-page="landing"` atual.
- **Admin:** nenhuma mudança (app separado, já isolado).

Modelo mental: **tema-base + variante** (não dois DS 100% duplicados). A Landing herda da
Plataforma o que NÃO redefinir — coerente com "linguagem *um pouco* diferente" e com menos
duplicação/manutenção. A divergência é explícita e auditável num só bloco.

### Mapa rota → ambiente

| Rota | Ambiente | `data-env` |
|---|---|---|
| `/app/*` | Plataforma | `platform` (= `:root`, default) |
| `/auth/*` | Plataforma¹ | `platform` |
| `/teste`, `/para-artistas`, `/blog` | Landing | `landing` |
| `/` (home) | **decisão pendente²** | provável `landing` |
| `/termos`, `/privacidade` | neutro³ | `platform` (default) |

¹ `/auth` hoje usa visual landing-ish (pill gradiente, sparkles), mas é **transição pra
plataforma** — proposta: tratar como `platform` e, se quiser o sabor de marca no login,
herdar tokens específicos. A confirmar.
² A home `/` já é landing (`@/components/landing/*` + `data-page="landing"`), mas não foi
marcada como landing na decisão. **Pergunta aberta:** `/` continua landing, ou vira splash/
redirect pra `/app`? O ADR recomenda `landing` por consistência.
³ Legais são neutros; ficam no default (plataforma) salvo decisão contrária.

---

## Opções consideradas

### Opção A — Escopo por atributo `data-env` (recomendada)

Um `globals.css`; `:root` = plataforma, `[data-env="landing"]` = variante; atributo no layout.

| Dimensão | Avaliação |
|---|---|
| Complexidade | **Baixa** — estende o padrão `[data-page]` que já existe |
| Custo/esforço | Baixo-médio (definir o bloco landing + aplicar em 3-4 layouts) |
| Risco em prod | **Baixo/controlável** — Plataforma intacta; landing migra rota a rota |
| Isolamento | Bom — landing escopada; só herda o que não redefine |
| Manutenção | Boa — divergências num bloco só, fácil de auditar |

**Prós:** Next-friendly (cascata global respeitada); Plataforma zero-change; incremental e
reversível; combina com o guardrail stylelint existente.
**Contras:** não é isolamento "físico" (mesmo arquivo/cascata); exige disciplina pra não
vazar tokens entre blocos; a landing precisa redeclarar tudo que quiser garantidamente
independente.

### Opção B — Arquivos de token separados por ambiente

`tokens-platform.css` + `tokens-landing.css`, importados por layout.

| Dimensão | Avaliação |
|---|---|
| Complexidade | Média |
| Risco em prod | Médio |
| Isolamento | **Ilusório sozinho** |

**Prós:** separação clara em arquivo; bom pra leitura.
**Contras:** no App Router, CSS global de qualquer layout vale pro app todo → **dois arquivos
ainda colidem** sem escopo de seletor. Ou seja, B só funciona se for **B + A** (split de
arquivo *com* `data-env`). Vale como evolução de A (extrair o bloco landing pra `landing.css`),
não como alternativa.

### Opção C — Landing vira app Next próprio (como o Admin)

Separar `/teste`, `/para-artistas`, `/blog` num app/deploy isolado.

| Dimensão | Avaliação |
|---|---|
| Complexidade | **Alta** |
| Custo | Alto (novo build/deploy, roteamento, compartilhamento de assets/SEO) |
| Isolamento | **Máximo** |

**Prós:** isolamento total (igual Admin); landing evolui sem nenhum risco à plataforma.
**Contras:** caro e desproporcional pro objetivo ("linguagem *um pouco* diferente"); duplica
infra; quebra navegação interna landing↔app; fora de escopo agora. Reavaliar só se a landing
crescer pra um site de marketing grande e independente.

### Opção D — CSS `@layer` + `data-env`

Como A, mas usando `@layer tokens-platform`, `@layer tokens-landing` pra ordenar cascata.

| Dimensão | Avaliação |
|---|---|
| Complexidade | Média-alta |
| Benefício | Marginal sobre A |

**Prós:** controle fino de precedência.
**Contras:** complexidade extra sem ganho real no nosso caso (especificidade do atributo já
resolve). Overkill agora.

---

## Análise de trade-offs

- **A vs C** é o trade central: *acoplamento controlado* (A) vs *isolamento físico* (C). Como
  o objetivo é divergência leve e a landing navega pro app, A entrega 90% do valor a uma
  fração do custo/risco. C fica como "porta de saída" futura.
- **A vs B:** B não isola sozinho no App Router; é um refinamento de A (split de arquivo).
  Começar com A (bloco no `globals.css`) e extrair pra `landing.css` depois é a rota
  natural — sem decisão irreversível.
- **Tema-variante vs DS duplicado:** redeclarar 100% dos tokens na landing daria isolamento
  perfeito mas dobra manutenção e diverge "demais" pro pedido. Variante (override deltas) é o
  ponto certo — e o `data-env` deixa trivial endurecer pra duplicação total se um dia precisar.

---

## Token map proposto (ponto de partida — refinar com a landing)

`:root` (Plataforma — **inalterado**): `--bg #000`, `--ink/-soft/-mute/-faint`, `--accent #3DDB74`
(verde), `--purple #9333ea`, `--pink #ec4899`, gradientes `--grad-*`, escala `--text-*`
12/14/16/18/22/28, `--space-*`, `--z-*`, raios.

`[data-env="landing"]` (variante — expande o `[data-page="landing"]` de hoje):
- **Cor/superfície:** `--bg #08080A` + `--bg-grad`, `--surface*`, `--line*` (já existem).
- **Acento:** `--accent #7DD3FC` (ciano) — identidade da landing (já existe).
- **Forma:** `--r-sm 4 / --r-md 8 / --r-lg 14 / --r-xl 24` (já existem; mais suaves que a
  plataforma).
- **Tipografia (novo):** se a landing quiser escala editorial própria (Borscha display +
  corpo maior), declarar `--text-*` aqui. **A definir com você** — hoje a landing herda a
  escala da plataforma.
- **Spacing (novo, opcional):** ritmo mais arejado de marketing, se desejado.

> O que exatamente diverge em tipografia/spacing é uma **decisão de design da landing** —
> este ADR cria a *estrutura*; os valores entram num passo seguinte (idealmente com uma
> página viva "Landing DS", espelhando o `/design-system` do Admin e o
> `/design-system-plataforma`).

---

## Consequências

**Fica mais fácil:**
- Evoluir a linguagem da landing sem risco à plataforma (e vice-versa).
- Onboarding: 3 DS nomeados e escopados, cada um com sua página viva.
- Corrigir a inconsistência atual (`/teste` etc. deixam de herdar tokens da plataforma).

**Fica mais difícil / atenção:**
- **Mudança visual visível** em `/teste`, `/para-artistas`, `/blog` ao adotarem `data-env=
  landing` (hoje usam tokens da plataforma). É *intencional*, mas precisa de QA por rota.
- O guardrail stylelint é global hoje; pode precisar de regras por ambiente no futuro.
- Disciplina: novos componentes de landing devem assumir `data-env=landing` no ancestral.

**Revisitar quando:**
- A landing virar um site de marketing grande/independente → reconsiderar Opção C.
- Surgir necessidade de 3º tema na plataforma (ex.: white-label por artista).

---

## Action items (ordem de migração — incremental, main=prod)

1. [ ] **Decisão:** confirmar `/` (landing vs splash) e `/auth` (platform vs sabor de marca).
2. [ ] **Estrutura (aditiva, zero efeito):** renomear/expandir `[data-page="landing"]` →
       `[data-env="landing"]` no `globals.css`, com o conjunto completo de overlays. Nada
       aplica ainda → zero mudança visual. Validar com PostCSS + guardrail.
3. [ ] **Aplicar por rota, com QA no preview, uma de cada vez:** `/teste` → `/para-artistas`
       → `/blog` (setar `data-env="landing"` no layout/wrapper; screenshot antes/depois).
4. [ ] **Home `/`:** migrar `data-page` → `data-env` conforme decisão do item 1.
5. [ ] **Plataforma:** garantir que `/app` e `/auth` ficam no default (`:root`) — checar que
       nenhum ancestral herda `data-env=landing` indevidamente.
6. [ ] **(Opcional) Tipografia/spacing da landing:** definir divergências com você + página
       viva "Landing DS".
7. [ ] **(Opcional) Guardrail por ambiente:** se a landing ganhar paleta própria, escopar
       regras do stylelint.
8. [ ] Atualizar a página `/design-system-plataforma` (admin) pra refletir a separação dos 3.

**Riscos & mitigação:** main=produção → cada passo de aplicação (item 3+) vai em **branch com
QA no preview** antes do merge; a estrutura (item 2) é aditiva e segura; Plataforma não muda.
