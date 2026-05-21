/**
 * Slug helper compartilhado entre forms do blog (categorias,
 * autores, posts, tags). Gera versões URL-safe + preview ao
 * vivo enquanto o usuário digita o nome.
 *
 * Implementação propositalmente sem deps externas — Intl.Normalize
 * + regex resolvem 99% dos casos PT-BR. Quando o backend cair, a
 * mesma função vive lá pra consistência server↔client.
 */

export function slugify(input: string): string {
  return input
    .normalize('NFD')                      // separa diacríticos
    .replace(/[̀-ͯ]/g, '')       // remove diacríticos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')          // só letras/números/espaços/hífens
    .replace(/\s+/g, '-')                  // espaços → hífen
    .replace(/-+/g, '-')                   // colapsa múltiplos hífens
    .replace(/^-|-$/g, '');                // trim hífens das pontas
}

/** Garante que o slug é único dentro de uma coleção existente.
 *  Se houver conflito, sufixa com `-2`, `-3`, etc. Usado pelo
 *  servidor ao gravar; o cliente confia que o backend resolve
 *  conflito mas pode validar localmente pra UX. */
export function ensureUniqueSlug(
  desired: string,
  existing: string[],
): string {
  const taken = new Set(existing);
  if (!taken.has(desired)) return desired;
  let i = 2;
  while (taken.has(`${desired}-${i}`)) i++;
  return `${desired}-${i}`;
}
