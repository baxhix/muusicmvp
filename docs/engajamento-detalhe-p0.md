# Detalhamento dos itens P0 — engajamento

> Companion de [`engajamento.md`](./engajamento.md). Cada item P0
> com 2 parágrafos: **O que é** + **Como impacta**.

---

## P0.1 — Activation event definido e instrumentado

**O que é**: definir e cravar no analytics o evento que marca
"este usuário ativou o produto" — proposta atual: completou
onboarding + entrou em pelo menos 1 comunidade + ganhou os
primeiros 100 Fanpoints. Hoje a plataforma não tem essa definição;
sabemos quantos usuários entram, mas não sabemos quem "pegou" o
produto.

**Como impacta**: sem activation event não dá pra medir D1/D7/D30
com honestidade, não dá pra A/B test (qual variação ativa mais?),
não dá pra priorizar (que feature mexe o ponteiro?). É a métrica
que sustenta todas as outras decisões do roadmap — sem ela, P0.2
a P0.7 ficam medindo no escuro.

---

## P0.2 — Pipeline de conteúdo diário garantido

**O que é**: acordo operacional com a equipe do artista pra
garantir **3 a 7 posts novos/dia** no feed, com cadência fixa
(horários combinados), slots semanais distribuídos por tipo
(foto, vídeo, mensagem, story de bastidor) e um banco de fallback
pré-aprovado pra cobrir dias que a equipe não consegue produzir.

**Como impacta**: feed sem novidade é museu. Em 72h sem post novo
o usuário para de abrir o app — não importa quanto push, quanto
streak, quanto reward a gente investiu. Sem essa garantia
operacional, todo o resto do roadmap perde efeito porque o user
volta pra ver nada novo e desinstala.

---

## P0.3 — Onboarding tooltips (3 pós-flyTo)

**O que é**: 3 tooltips sequenciais que aparecem logo depois do
welcome cinematográfico (flyTo pra Brasil), cobrindo:
(1) o que são Fanpoints e como ganhar; (2) onde fica o chat e
comunidades; (3) como subir no ranking de superfãs. Skippable mas
sem fechar sozinhos — força o user a passar pelos 3.

**Como impacta**: hoje o usuário entra na home e fica perdido —
animação bonita, zero contexto. Esse vazio é responsável pela
queda de D1 entre 40-60% que vemos em apps similares sem
onboarding educativo. Ensinar nos 3 primeiros minutos converte
exploradores curiosos em usuários ativos com intenção.

---

## P0.4 — Empty-state com CTA em comunidades

**O que é**: cada comunidade nova precisa de seed (5-10 posts
iniciais pré-publicados pela equipe do artista ou por superfãs
convidados) + empty-state com CTA explícito "seja o primeiro a
postar" oferecendo reward em Fanpoints pra quebrar o constrangimento
de espaço vazio.

**Como impacta**: comunidade vazia mata o feature antes de respirar.
User entra, vê nada, fecha, nunca mais volta — e isso contamina a
percepção do produto inteiro ("comunidade na Fanverse é morta").
Sem seed + CTA, comunidades viram cemitérios visíveis na home e
o feature perde valor mesmo com tudo o mais funcionando.

---

## P0.5 — Push permission prompt em momento high-value

**O que é**: tirar o prompt de permissão de push do signup (onde
o user ainda não viu valor e a taxa de accept fica em ~30-40%) e
disparar logo DEPOIS da primeira ação significativa — primeira
mensagem enviada, primeiro Fanpoint ganho, primeiro like recebido.
Show value first, ask permission later.

**Como impacta**: sem push, retorno D7+ cai pela metade — usuário
simplesmente esquece. Mas push pedido cedo demais é negado e fica
negado pra sempre (iOS não permite reprompt). Esse timing change
pode dobrar a taxa de accept (de ~35% pra 60-70%), o que multiplica
o efeito de todos os outros esforços de retenção downstream.

---

## P0.6 — Decisão sobre multi-artist (sim/não)

**O que é**: hoje toda a plataforma está hardcoded pra Ana Castela
(`anaAlbums.ts`, assets `ana-castela.png`, copies, brand colors).
Se a visão é "Fanverse-as-platform" (vários artistas), precisa de
refator pra abstrair: data layer com tabela `artists`, asset
pipeline por artista, theming, roteamento. Decisão estratégica
ANTES de técnica.

**Como impacta**: toda feature de spending (P0.7), feed algorítmico
(P1.8), friend graph (P2.3), creator tools (P2.8) é afetada por
essa escolha. Decidir agora destrava o restante do roadmap;
postergar gera retrabalho em cima de retrabalho — cada feature nova
sai hardcoded e depois tem que ser reescrita. É a decisão de
arquitetura mais crítica do estágio atual.

---

## P0.7 — Spending mechanic de Fanpoints

**O que é**: pelo menos UMA forma do usuário **gastar** Fanpoints
em produção no lançamento — marketplace pequeno (skins de perfil,
moldura de avatar), sorteio (concorrer a meet-and-greet ou item
exclusivo), unlock de conteúdo (faixa demo, vídeo de bastidor),
ou customização. Hoje pontos só somam, viram número morto.

**Como impacta**: pontos sem gasto não viciam — viram contador
irrelevante. A gamificação inteira depende do loop `earn → spend
→ earn`. Sem spend, todo investimento em Fanpoints (regras de
ganho, eventos, multiplicadores) perde tração: o usuário entende
rápido que o número não muda nada na vida dele e ignora.
Lançamento sem spending é gamificação de fachada.
