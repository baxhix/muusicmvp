import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { getCurrentUser } from '@/server/auth/session';
import { sendWelcomeEmail } from '@/server/email/welcome';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * Finaliza o onboarding do usuário recém-cadastrado.
 *
 * Chamado pelo /auth/success do frontend depois que o user
 * preencheu birth-date, profile (displayName) e interests.
 * Persiste tudo no schema + seta is_onboarded=true, o que
 * faz o próximo /api/auth/me retornar isOnboarded=true e o
 * verify page redirecionar pra /app em logins futuros.
 *
 * Após persistir, dispara email de boas-vindas EXATAMENTE UMA
 * VEZ via UPDATE atômico que marca welcome_email_sent_at.
 * Falha do email não invalida o onboarding — só é logado.
 *
 * Auth: requer sessão (cookie). Sem cookie → 401.
 */
const bodySchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  // YYYY-MM-DD; validade rasa, o frontend já validou a data.
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  age: z.number().int().min(0).max(150).optional(),
  isMinor: z.boolean().optional(),
  interests: z.array(z.string().max(40)).max(50).optional(),
  termsAcceptedAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // Constrói patch só com os campos presentes — não sobrescreve
  // valores existentes com undefined.
  const patch: Record<string, unknown> = { isOnboarded: true };
  if (parsed.displayName) patch.name = parsed.displayName;
  if (parsed.birthDate) patch.birthDate = parsed.birthDate;
  if (typeof parsed.age === 'number') patch.age = parsed.age;
  if (typeof parsed.isMinor === 'boolean') patch.isMinor = parsed.isMinor;
  if (parsed.interests) patch.interests = parsed.interests;
  if (parsed.termsAcceptedAt) {
    patch.termsAcceptedAt = new Date(parsed.termsAcceptedAt);
  }

  await db.update(users).set(patch).where(eq(users.id, me.id));

  /* Boas-vindas: claim atômico via UPDATE com WHERE NULL.
   * Returning retorna a row se foi a primeira vez (e portanto
   * o claim foi nosso). Se já tinha timestamp, returning vem
   * vazio e a gente não envia.
   *
   * Em paralelo: race condition entre 2 chamadas simultâneas do
   * onboarding leva apenas uma a "vencer" o claim — Postgres
   * garante atomicidade do UPDATE. Sem chance de double-send. */
  const claimed = await db
    .update(users)
    .set({ welcomeEmailSentAt: new Date() })
    .where(
      and(eq(users.id, me.id), isNull(users.welcomeEmailSentAt)),
    )
    .returning({ id: users.id, email: users.email, name: users.name });

  if (claimed.length > 0) {
    const row = claimed[0];
    const displayName =
      parsed.displayName ?? row.name ?? row.email?.split('@')[0] ?? 'fã';
    // Fire-and-forget: o response do onboarding NÃO espera o email.
    // Resend pode demorar 1-3s e o usuário já está vendo a tela de
    // sucesso. Falha aqui é só log — não invalida o onboarding.
    void sendWelcomeEmail({ to: row.email, userName: displayName }).catch(
      (err: unknown) => {
        logger.error('email.welcome.send-failed', err, {
          userId: row.id,
        });
      },
    );
  }

  return NextResponse.json({ ok: true });
}
