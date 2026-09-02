CREATE OR REPLACE FUNCTION public.validate_cupom(p_tenant_id uuid, p_codigo text, p_user_id uuid, p_valor_base numeric DEFAULT NULL::numeric)
 RETURNS TABLE(valido boolean, motivo text, cupom_id uuid, tipo_desconto text, valor_desconto numeric, valor_descontado numeric, valor_final numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c record; usos_total int; usos_cliente int; v_desc numeric;
BEGIN
  SELECT * INTO c FROM public.cupons
  WHERE tenant_id = p_tenant_id AND lower(codigo) = lower(p_codigo) LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false,'Cupom não encontrado',NULL::uuid,NULL::text,NULL::numeric,NULL::numeric,p_valor_base; RETURN;
  END IF;
  IF NOT c.ativo THEN
    RETURN QUERY SELECT false,'Cupom inativo',c.id,c.tipo_desconto,c.valor_desconto,NULL::numeric,p_valor_base; RETURN;
  END IF;
  IF c.valido_ate IS NOT NULL AND c.valido_ate < now() THEN
    RETURN QUERY SELECT false,'Cupom expirado',c.id,c.tipo_desconto,c.valor_desconto,NULL::numeric,p_valor_base; RETURN;
  END IF;
  IF c.valido_de > now() THEN
    RETURN QUERY SELECT false,'Cupom ainda não está válido',c.id,c.tipo_desconto,c.valor_desconto,NULL::numeric,p_valor_base; RETURN;
  END IF;
  IF c.escopo = 'privado' AND c.cliente_user_id IS DISTINCT FROM p_user_id THEN
    RETURN QUERY SELECT false,'Cupom não pertence a este cliente',c.id,c.tipo_desconto,c.valor_desconto,NULL::numeric,p_valor_base; RETURN;
  END IF;
  IF c.max_usos_total IS NOT NULL THEN
    SELECT count(*) INTO usos_total FROM public.cupom_usos u WHERE u.cupom_id = c.id;
    IF usos_total >= c.max_usos_total THEN
      RETURN QUERY SELECT false,'Limite total de usos atingido',c.id,c.tipo_desconto,c.valor_desconto,NULL::numeric,p_valor_base; RETURN;
    END IF;
  END IF;
  IF c.max_usos_por_cliente IS NOT NULL THEN
    SELECT count(*) INTO usos_cliente FROM public.cupom_usos u
      WHERE u.cupom_id = c.id AND u.user_id = p_user_id;
    IF usos_cliente >= c.max_usos_por_cliente THEN
      RETURN QUERY SELECT false,'Você já usou este cupom o máximo de vezes',c.id,c.tipo_desconto,c.valor_desconto,NULL::numeric,p_valor_base; RETURN;
    END IF;
  END IF;

  v_desc := NULL;
  IF p_valor_base IS NOT NULL THEN
    IF c.tipo_desconto = 'percentual' THEN
      v_desc := round(p_valor_base * (c.valor_desconto / 100.0), 2);
    ELSE
      v_desc := least(c.valor_desconto, p_valor_base);
    END IF;
  END IF;

  RETURN QUERY SELECT true,'OK'::text,c.id,c.tipo_desconto,c.valor_desconto,v_desc,
    CASE WHEN p_valor_base IS NULL THEN NULL ELSE greatest(p_valor_base - COALESCE(v_desc,0), 0) END;
END $function$;