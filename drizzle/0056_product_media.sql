-- Produtos: mídia unificada (imagens + vídeos) com ordem própria.
--
-- Antes os produtos só tinham `image_urls` (string[]). Agora a galeria
-- aceita imagens E vídeos numa única lista ordenada — `media` é
-- [{ "type": "image" | "video", "url": "..." }], onde a ORDEM do array
-- é a sequência que o usuário vê (primeiro item = capa).
--
-- Idempotente: pode rodar onde a coluna já exista.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "media" jsonb DEFAULT '[]'::jsonb NOT NULL;

-- Backfill: produtos antigos que só têm image_urls ganham media derivada
-- (cada URL vira {type:'image', url}). Só roda onde media ainda está vazia
-- mas image_urls tem conteúdo.
UPDATE "products"
SET "media" = (
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('type', 'image', 'url', u)),
    '[]'::jsonb
  )
  FROM jsonb_array_elements_text("image_urls") AS u
)
WHERE jsonb_array_length("media") = 0
  AND jsonb_array_length("image_urls") > 0;
