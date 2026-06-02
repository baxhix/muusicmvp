# Roadmap de engajamento e comportamento de uso

> **Status**: priorização inicial, gerada em discussão com o cliente
> e recuperada do transcript da sessão Claude `glittery-wishing-sprout`
> (`~/.claude/projects/-Users-marcelodemaribaxhix-Documents-Clientes-muusicMVP/`).
> Datas de origem: 28-mai-2026 / 02-jun-2026.
>
> **Convenções**: Effort `S` (≤1 dia) · `M` (2-5 dias) · `L` (>1 semana).
> Criticidade indica peso na decisão de priorização; Categoria
> ajuda a balancear o sprint entre eixos.

---

## P0 — Críticos (bloqueadores de lançamento / impacto imediato)

| # | Item | Effort | Criticidade | Categoria |
|---|---|---|---|---|
| P0.1 | Activation event definido e instrumentado | M | Crítico | Operacional |
| P0.2 | Pipeline de conteúdo diário garantido | M | Crítico | Operacional |
| P0.3 | Onboarding tooltips (3 pós-flyTo) | S | Alto | UX |
| P0.4 | Empty-state com CTA em comunidades | S | Crítico | UX |
| P0.5 | Push permission prompt em momento high-value | S | Alto | Engagement |
| P0.6 | Decisão sobre multi-artist (sim/não) | M | Crítico | Estratégia |
| P0.7 | Spending mechanic de Fanpoints | L | Crítico | Produto |

## P1 — Próximo sprint (alto impacto, sem ser bloqueador)

| # | Item | Effort | Criticidade | Categoria |
|---|---|---|---|---|
| P1.1 | Streak counter | S | Alto | Retenção |
| P1.2 | Countdown de eventos | S | Alto | FOMO |
| P1.3 | Confetti micro pra marcos baixos | S | Médio | Reward |
| P1.4 | Share button + OG card | M | Alto | Growth |
| P1.5 | Referral program | M | Alto | Growth |
| P1.6 | Daily Drop | M | Alto | Retenção |
| P1.7 | Toast com action | S | Médio | Engagement |
| P1.8 | Feed algorítmico básico | L | Alto | Retenção |

## P2 — Backlog (médio prazo)

| # | Item | Effort | Criticidade | Categoria |
|---|---|---|---|---|
| P2.1 | Tier system em todo lugar | M | Alto | Status |
| P2.2 | Live attendance badge | S | Médio | Status |
| P2.3 | Friend graph | L | Alto | Growth |
| P2.4 | Comunidades por cidade | M | Médio | Comunidade |
| P2.5 | Wrapped mensal | M | Médio | Growth |
| P2.6 | Paid Superchat | L | Alto | Monetização |
| P2.7 | Badge gallery | S | Médio | Status |
| P2.8 | Creator tools admin | L | Médio | Operacional |

---

## Ordem sugerida de execução dentro do P0

Todo P0 é "crítico ou alto"; a ordem abaixo otimiza dependências e
desbloqueia o resto:

1. **P0.6 — Decisão multi-artist** — destrava arquitetura de
   spending, feed e creator tools.
2. **P0.1 — Activation event** — sem métrica não dá pra medir o
   ganho dos outros itens.
3. **P0.2 — Pipeline de conteúdo diário** — sem feed novo a cada
   dia, retenção desmorona.
4. **P0.4 — Empty-state comunidades** — bloqueante de UX hoje.
5. **P0.7 — Spending mechanic de Fanpoints** — esforço `L`, mas
   crítico de produto. Começar cedo pra paralelizar com os outros.
6. **P0.3 — Onboarding tooltips** — `S`, ganho rápido de UX.
7. **P0.5 — Push prompt high-value** — `S`, alavanca de retenção
   D1/D7 (cobrar permissão num momento de "uau", não no boot).

Depois disso, P1 com foco em **Retenção** primeiro (Streak,
Daily Drop, Feed algorítmico) → **Growth** (Share, Referral) →
**Reward** (Confetti).

---

## Detalhamento técnico

Specs de implementação, critérios de aceite e métricas pros itens
do P0 vivem (parcialmente) nos transcripts da sessão de origem.
Quando um item for puxado pra sprint, extrair os specs e criar um
issue/branch dedicado.
