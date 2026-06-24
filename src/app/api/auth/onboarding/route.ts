import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { getCurrentUser } from '@/server/auth/session';
import { maybeRewardReferral } from '@/server/referral/queries';

export const runtime = 'nodejs';

/** Idade a partir de "YYYY-MM-DD" — calculada no servidor (não confia
 *  no `age` enviado pelo cliente). */
function ageFromBirthDateISO(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date();
  let age = t.getFullYear() - y;
  const mo = t.getMonth() + 1;
  const day = t.getDate();
  if (mo < m || (mo === m && day < d)) age -= 1;
  return age;
}

/** Idade mínima pra ter conta na plataforma. */
const MIN_ACCOUNT_AGE = 12;

/**
 * Finaliza o onboarding do usuário recém-cadastrado.
 *
 * Chamado pelo /auth/success do frontend depois que o user
 * preencheu birth-date, profile (displayName) e interests.
 * Persiste tudo no schema + seta is_onboarded=true, o que
 * faz o próximo /api/auth/me retornar isOnboarded=true e o
 * verify page redirecionar pra /app em logins futuros.
 *
 * O email de boas-vindas NÃO sai aqui — agora é disparado
 * direto no /api/auth/request no momento da criação de conta
 * (claim atômico via welcomeEmailSentAt). Esta rota cuida só
 * dos dados do perfil.
 *
 * Auth: requer sessão (cookie). Sem cookie → 401.
 */
const bodySchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  // YYYY-MM-DD; validade rasa, o frontend já validou a data.
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  age: z.number().int().min(0).max(150).optional(),
  isMinor: z.boolean().optional(),
  // Consentimento LGPD de localização escolhido no passo Perfil.
  locationConsent: z.boolean().optional(),
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

  /* Proteção a menores de 12 anos: NÃO podem criar conta. Idade
   * calculada no servidor a partir da data (cliente não é confiável).
   * Se <12, soft-delete o stub recém-criado e recusa — getCurrentUser
   * filtra deletedAt, então a sessão morre na hora. */
  if (parsed.birthDate && ageFromBirthDateISO(parsed.birthDate) < MIN_ACCOUNT_AGE) {
    await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, me.id));
    return NextResponse.json({ error: 'underage' }, { status: 403 });
  }

  // Constrói patch só com os campos presentes — não sobrescreve
  // valores existentes com undefined.
  const patch: Record<string, unknown> = { isOnboarded: true };
  if (parsed.displayName) patch.name = parsed.displayName;
  if (parsed.birthDate) patch.birthDate = parsed.birthDate;
  if (typeof parsed.age === 'number') patch.age = parsed.age;
  if (typeof parsed.isMinor === 'boolean') patch.isMinor = parsed.isMinor;
  // Guard server-side: menor NUNCA consente localização, mesmo que o
  // cliente envie true (o toggle já fica escondido na UI).
  if (typeof parsed.locationConsent === 'boolean') {
    patch.locationConsent = parsed.isMinor ? false : parsed.locationConsent;
  }
  if (parsed.interests) patch.interests = parsed.interests;
  if (parsed.termsAcceptedAt) {
    patch.termsAcceptedAt = new Date(parsed.termsAcceptedAt);
  }

  await db.update(users).set(patch).where(eq(users.id, me.id));

  /* Ativação do referral — este é o momento de "first value" que
   * dispara o reward (não o signup puro, anti-fraude). Se o usuário
   * veio de um convite, credita FP pro referrer + bônus de
   * boas-vindas pra ele. Best-effort: maybeRewardReferral nunca
   * lança, então não compromete a finalização do onboarding. */
  await maybeRewardReferral(me.id);

  return NextResponse.json({ ok: true });
}
