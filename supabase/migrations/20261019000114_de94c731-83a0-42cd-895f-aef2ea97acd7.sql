DO $$
DECLARE old_claims text:=current_setting('request.jwt.claims',true);
old_sub text:=current_setting('request.jwt.claim.sub',true);
old_role text:=current_setting('request.jwt.claim.role',true);
rejected boolean:=false;
BEGIN
PERFORM set_config('request.jwt.claim.sub','a46b3160-c1ca-478c-8a8b-68f50a82d27d',true);
PERFORM set_config('request.jwt.claim.role','authenticated',true);
PERFORM set_config('request.jwt.claims','{"sub":"a46b3160-c1ca-478c-8a8b-68f50a82d27d","role":"authenticated"}',true);
ASSERT public.owns_cancellation_debt('73d61f2f-b369-41f3-8915-8e6de52d6378','767c51a7-7323-4933-8fc5-9a666f6baa7c','65b929ae-b44a-4270-8f56-d2d38c16fd91');
ASSERT NOT public.owns_cancellation_debt('00000000-0000-0000-0000-000000000001','767c51a7-7323-4933-8fc5-9a666f6baa7c','65b929ae-b44a-4270-8f56-d2d38c16fd91');
BEGIN
UPDATE public.informacoes_empresa SET ativo=false WHERE id=114 AND tenant_id='73d61f2f-b369-41f3-8915-8e6de52d6378';
ASSERT FOUND, 'fixture missing';
BEGIN
UPDATE public.informacoes_empresa SET valor=(valor::jsonb||'{"valor_taxa":999}'::jsonb)::text WHERE id=114;
EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
END;
ASSERT rejected, 'barber must not change debt amount';
rejected:=false;
BEGIN
UPDATE public.informacoes_empresa SET valor=(valor::jsonb||'{"status":"pago"}'::jsonb)::text WHERE id=114;
EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
END;
ASSERT rejected, 'barber must not forge payment';
RAISE EXCEPTION 'rollback_test' USING ERRCODE='Z0001';
EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
END;
PERFORM set_config('request.jwt.claim.sub','65b929ae-b44a-4270-8f56-d2d38c16fd91',true);
ASSERT NOT public.owns_cancellation_debt('73d61f2f-b369-41f3-8915-8e6de52d6378','767c51a7-7323-4933-8fc5-9a666f6baa7c','65b929ae-b44a-4270-8f56-d2d38c16fd91'), 'self release denied';
PERFORM set_config('request.jwt.claim.sub',COALESCE(old_sub,''),true);
PERFORM set_config('request.jwt.claim.role',COALESCE(old_role,''),true);
PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
END $$;