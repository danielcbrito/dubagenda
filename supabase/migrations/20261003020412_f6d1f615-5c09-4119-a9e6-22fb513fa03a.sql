-- 1) Excluir plano com assinantes vira desativação (nunca apaga assinaturas em cascata)
CREATE OR REPLACE FUNCTION public.protect_plan_delete_with_subscribers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.assinaturas a WHERE a.plano_id = OLD.id) THEN
    UPDATE public.planos SET ativo = false WHERE id = OLD.id;
    RETURN NULL; -- cancela a exclusão, mantém o plano para os assinantes
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_protect_plan_delete ON public.planos;
CREATE TRIGGER trg_protect_plan_delete BEFORE DELETE ON public.planos
FOR EACH ROW EXECUTE FUNCTION public.protect_plan_delete_with_subscribers();

ALTER TABLE public.assinaturas DROP CONSTRAINT assinaturas_plano_id_fkey;
ALTER TABLE public.assinaturas ADD CONSTRAINT assinaturas_plano_id_fkey
  FOREIGN KEY (plano_id) REFERENCES public.planos(id) ON DELETE RESTRICT;

-- 2) Renovação de quem já é assinante não disputa vaga
CREATE OR REPLACE FUNCTION public.check_plano_vagas()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
declare
  v_controle_ativo boolean;
  v_limite integer;
  v_ocupadas integer;
begin
  select coalesce(p.controle_vagas_ativo, false), p.vagas
    into v_controle_ativo, v_limite
  from public.planos p where p.id = new.plano_id;

  if not found then raise exception 'PLANO_NAO_ENCONTRADO'; end if;
  if v_controle_ativo = false or v_limite is null or v_limite <= 0 then return new; end if;
  if coalesce(new.status::text, '') not in ('active', 'suspended', 'pending_cash') then return new; end if;

  -- Atualização de uma assinatura que já ocupava vaga neste plano (renovação)
  if tg_op = 'UPDATE' and old.plano_id = new.plano_id
     and old.status::text in ('active','suspended','pending_cash','pending_renewal','past_due') then
    return new;
  end if;

  -- Mesmo cliente já tem/teve assinatura neste plano (renovação/recompra)
  if exists (select 1 from public.assinaturas a
             where a.user_id = new.user_id and a.plano_id = new.plano_id
               and a.id <> new.id) then
    return new;
  end if;

  select count(*) into v_ocupadas from public.assinaturas a
  where a.plano_id = new.plano_id
    and a.status::text in ('active', 'suspended', 'pending_cash')
    and a.user_id <> new.user_id
    and (tg_op <> 'UPDATE' or a.id <> new.id);

  if v_ocupadas >= v_limite then
    raise exception 'PLANO_VAGAS_ESGOTADAS'
      using detail = format('Este plano já atingiu o limite de %s vaga(s).', v_limite),
            hint = 'Cancele uma assinatura ocupando vaga ou aumente o limite do plano.';
  end if;
  return new;
end $$;