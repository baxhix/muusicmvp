-- Migration 0046: adicionar coluna `attachments` (jsonb) em messages.
--
-- Suporte a imagens anexadas a mensagens de chat (DMs + grupos).
-- Formato do array: [{ url, mimeType, size, width?, height? }]
--   - url         path relativo servido pelo Next ('/uploads/chat/...')
--   - mimeType    validado no upload (image/jpeg|png|webp|gif)
--   - size        bytes
--   - width|height dimensions em px (sniffed server-side)
--
-- Nullable porque a maioria das mensagens é text-only. O leitor
-- normaliza NULL → [] no toRow().

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "attachments" jsonb;
