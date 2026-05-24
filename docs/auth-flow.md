# Fluxo de autenticação — muusic

Sistema **passwordless** baseado em magic link + OTP fallback de 6
dígitos. Sessão via cookie httpOnly compartilhado entre subdomínios
(`muusic.live` + `admin.muusic.live`).

## Visão geral

```
USUÁRIO                  WEB (Next.js API)              EMAIL
  │
  │ POST /api/auth/request
  ├─────────────────────────►│
  │   { email }              │
  │                          │ rate limit por IP + email
  │                          │ (TokenBucket)
  │                          │
  │                          │ INSERT INTO tokens (
  │                          │   token_hash = SHA-256(raw),
  │                          │   user_id, kind='magic',
  │                          │   code = '123456',
  │                          │   expires_at = now + 15min
  │                          │ )
  │                          │
  │                          │ sendMagicLink(email, raw, code)
  │                          │  └─ Resend com timeout + retry
  │                          ├──────────────────────────►│
  │                          │                            │
  │   200 { ok: true }       │
  │◄─────────────────────────┤
  │
  │ Email chega com:
  │  - Link: /api/auth/verify?token=<raw>
  │  - Código: 123456
  │
  ┌───────────────────────────────────────────────────┐
  │  Caminho A: Click no link (desktop, mesma sessão) │
  └───────────────────────────────────────────────────┘
  │
  │ GET /api/auth/verify?token=<raw>
  ├─────────────────────────►│
  │                          │ hash = SHA-256(raw)
  │                          │
  │                          │ db.transaction:
  │                          │   UPDATE tokens SET consumed_at=now
  │                          │   INSERT tokens (kind='session', ...)
  │                          │
  │                          │ Set-Cookie: muusic_session=<new_raw>
  │                          │   httpOnly, secure, sameSite=lax,
  │                          │   domain=.muusic.live
  │   302 → /app             │
  │◄─────────────────────────┤
  │
  ┌───────────────────────────────────────────────────┐
  │  Caminho B: OTP de 6 dígitos (mobile, copy paste) │
  └───────────────────────────────────────────────────┘
  │
  │ POST /api/auth/verify
  ├─────────────────────────►│
  │   { email, code }        │ rate limit (anti brute-force)
  │                          │
  │                          │ SELECT FROM tokens WHERE
  │                          │   user_id = (lookup email),
  │                          │   code = '123456',
  │                          │   kind='magic',
  │                          │   expires_at > now,
  │                          │   consumed_at IS NULL
  │                          │
  │                          │ (mesma transação)
  │                          │
  │   200 { ok: true }       │
  │   + Set-Cookie session   │
  │◄─────────────────────────┤
```

## Componentes

### Tokens (tabela `tokens`)

Polimorfismo via coluna `kind`. Um único table cobre:

| `kind`  | TTL    | Single-use | Carrega |
|---------|--------|------------|---------|
| `magic` | 15min  | sim (consumed_at) | userId, code 6-dígitos |
| `session` | 30 dias | não — vive até expiração | userId |

**Por que hash, não plaintext?** Se o DB vazar, o atacante tem o
hash; precisa quebrá-lo (SHA-256 inverso) pra usar o cookie. Custo
real de operar.

### Magic link

- `generateToken()` produz 32 bytes random → base64url (43 chars).
- Hash SHA-256 vai pro DB; raw vai pro email/cookie.
- Mesma row carrega **link + OTP** — usuário escolhe.
- `code` = 6 dígitos numéricos.

### Sessão

- TTL 30 dias.
- Cookie `muusic_session`:
  - `httpOnly` (JS não lê)
  - `secure` (HTTPS-only em prod)
  - `sameSite=lax` (CSRF mitigation)
  - `domain=.muusic.live` (compartilha com admin)
- `getCurrentUser()` lê cookie, hash → lookup → user.
- `destroySession()` deleta a row + zera o cookie.

## Segurança

### Rate limiting

| Endpoint | Bucket | Limite |
|---|---|---|
| `POST /api/auth/request` | per-IP + per-email | 5 burst, 5/min |
| `POST /api/auth/verify`  | per-IP             | 10 burst, 3/min |

Per-email é defesa contra **email bombing** (mesmo email recebendo
N magic links de IPs diferentes). Per-IP é defesa básica.

### CSRF

- Cookie `sameSite=lax` impede o browser de enviar o cookie em
  requests cross-site (POST de outro origin).
- CORS allowlist explícita em `middleware.ts` rejeita origins
  desconhecidos com credentials.

### Brute-force OTP

- 6 dígitos = 10⁶ = 1M combinações.
- Rate limit por IP: 10 burst, 3/min. Atacante precisa de **~7 dias**
  pra tentar todas as combinações de UM código.
- TTL do magic = 15min. Mesmo com IPs múltiplos, janela curta.
- Token single-use: cada `consume` invalida.

### Atomicidade

`consumeMagicAndCreateSession()` envolve UPDATE + INSERT numa
`db.transaction()`. Sem isso, falha entre passos deixava o magic
consumido sem session criada — usuário precisaria pedir novo link.

### Rotação de sessão

- Cada login cria nova session row (a antiga não invalida — usuário
  pode estar logado em mobile e desktop).
- Logout deleta só a session corrente (`destroySession`).
- Limpeza de sessões expiradas: cron job (vide schema, ainda manual).

## Fluxos especiais

### Cross-subdomain (admin)

1. Usuário loga em `muusic.live` → cookie `domain=.muusic.live`.
2. Acessa `admin.muusic.live` → browser envia o mesmo cookie.
3. `AdminAuthGate` chama `GET /api/auth/me` em `muusic.live` com
   `credentials: 'include'`.
4. CORS allowlist em `middleware.ts` autoriza o response.

### Welcome flow (novo usuário)

1. Login bem-sucedido.
2. Backend checa `users.is_onboarded`. Se false → redirect pra
   `/auth/onboarding/<step>`.
3. Cada step persiste no DB. Último step marca `is_onboarded=true`.
4. Após onboarding, redirect pro `/app?welcome=new` que dispara
   animação de globo + fade dos elementos.

### Returning user com welcome

`/app?welcome=returning` força a animação mesmo pra quem já onboardou.

## Como testar localmente

```bash
# 1. Configure .env (vide .env.example)
RESEND_API_KEY=re_xxx
EMAIL_FROM='muusic <noreply@yourdomain.com>'
AUTH_SECRET=$(openssl rand -base64 48)

# 2. Crie um usuário admin manualmente no DB
psql $DATABASE_URL -c "INSERT INTO users (email, role) VALUES ('seu@email.com', 'admin')"

# 3. Rode o servidor
npm run dev

# 4. Acesse http://localhost:3000/auth
# 5. Email chega pelo Resend; click no link OU digite o código.
```

Em dev sem `RESEND_API_KEY`: o sistema falha no `sendMagicLink`.
Workaround: log do `code` no console e digitar manualmente em
`/auth/verify`.

## Tabela de status codes

| Cenário | Status | Body |
|---|---|---|
| Magic link enviado | 200 | `{ ok: true }` |
| OTP válido (verify) | 200 | `{ ok: true }` |
| Body malformado | 400 | `{ error: 'invalid_body' }` |
| Email inválido / OTP errado | 400 | `{ error: 'invalid_code' }` |
| Token expirado / consumido | redirect | `?auth=expired` |
| Rate limit | 429 | `{ error: 'rate_limited' }` |
| Resend down | 502 | `{ error: 'email_failed' }` |
| Erro inesperado | 500 | `{ error: 'internal_error' }` |
