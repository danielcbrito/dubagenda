-- RPC: validate_barber_can_receive_pix
-- Returns whether the given barber currently has an active digital wallet
-- with a validated PIX key, meaning the client app may offer PIX as a
-- payment option for that barber. Used as the authoritative server-side
-- check before any PIX charge is created in the future Efí integration.
CREATE OR REPLACE FUNCTION public.validate_barber_can_receive_pix(p_barbeiro_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.carteiras c
    JOIN public.barbeiros b ON b.id = c.barbeiro_id
    WHERE c.barbeiro_id = p_barbeiro_id
      AND b.ativo = true
      AND b.deleted_at IS NULL
      AND c.chave_pix_validada = true
      AND c.chave_pix IS NOT NULL
      AND btrim(c.chave_pix) <> ''
  );
$$;

GRANT EXECUTE ON FUNCTION public.validate_barber_can_receive_pix(uuid) TO authenticated, anon;