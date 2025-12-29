-- Criar bucket de storage para fotos de barbeiros
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('barber-photos', 'barber-photos', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Política para qualquer pessoa visualizar as fotos (são públicas)
CREATE POLICY "Fotos de barbeiros são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'barber-photos');

-- Política para barbeiros fazerem upload de suas próprias fotos
CREATE POLICY "Barbeiros podem fazer upload de suas fotos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'barber-photos' 
  AND auth.uid() IS NOT NULL
);

-- Política para barbeiros atualizarem suas próprias fotos
CREATE POLICY "Barbeiros podem atualizar suas fotos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'barber-photos' 
  AND auth.uid() IS NOT NULL
);

-- Política para barbeiros deletarem suas próprias fotos
CREATE POLICY "Barbeiros podem deletar suas fotos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'barber-photos' 
  AND auth.uid() IS NOT NULL
);