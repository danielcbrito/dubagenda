
-- Portfolio de cortes dos barbeiros
CREATE TABLE public.barbeiro_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbeiro_id UUID NOT NULL REFERENCES public.barbeiros(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by barber
CREATE INDEX idx_barbeiro_portfolio_barbeiro_id ON public.barbeiro_portfolio(barbeiro_id);

-- Enable RLS
ALTER TABLE public.barbeiro_portfolio ENABLE ROW LEVEL SECURITY;

-- Everyone can view portfolio images (public page)
CREATE POLICY "Portfolio images are publicly viewable"
ON public.barbeiro_portfolio
FOR SELECT
TO anon, authenticated
USING (true);

-- Barbers can manage their own portfolio
CREATE POLICY "Barbers can insert their own portfolio"
ON public.barbeiro_portfolio
FOR INSERT
TO authenticated
WITH CHECK (
  barbeiro_id IN (
    SELECT id FROM public.barbeiros WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Barbers can update their own portfolio"
ON public.barbeiro_portfolio
FOR UPDATE
TO authenticated
USING (
  barbeiro_id IN (
    SELECT id FROM public.barbeiros WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Barbers can delete their own portfolio"
ON public.barbeiro_portfolio
FOR DELETE
TO authenticated
USING (
  barbeiro_id IN (
    SELECT id FROM public.barbeiros WHERE user_id = auth.uid()
  )
);

-- Admins can manage all portfolio images
CREATE POLICY "Admins can manage all portfolio"
ON public.barbeiro_portfolio
FOR ALL
TO authenticated
USING (public.is_admin());

-- Storage bucket for portfolio images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'barber-portfolio',
  'barber-portfolio',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Portfolio images are publicly accessible"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'barber-portfolio');

CREATE POLICY "Authenticated users can upload portfolio images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'barber-portfolio');

CREATE POLICY "Users can delete their portfolio images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'barber-portfolio');
