CREATE OR REPLACE FUNCTION public.get_barber_booking_payment_accounts(p_barbeiro_id uuid, p_tenant_id uuid)
RETURNS TABLE(status text, provider text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.status, a.provider
  FROM public.barber_payment_accounts a
  JOIN public.barbeiros b ON b.id = a.barbeiro_id AND b.tenant_id = a.tenant_id
  WHERE auth.uid() IS NOT NULL
    AND a.barbeiro_id = p_barbeiro_id
    AND a.tenant_id = p_tenant_id
    AND b.ativo = true
    AND b.deleted_at IS NULL
    AND a.status = 'approved'
    AND a.provider IN ('mercadopago', 'woovi');
$$;
REVOKE ALL ON FUNCTION public.get_barber_booking_payment_accounts(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_barber_booking_payment_accounts(uuid, uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.get_barber_booking_payment_accounts(uuid, uuid) IS 'Safe tenant-scoped booking PIX availability; exposes only approved supported account status and provider, never financial or personal details.';