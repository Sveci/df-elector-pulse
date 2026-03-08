-- Fix lideres insert policy to allow non-RA tenants (who use localidade instead of cidade_id)
DROP POLICY IF EXISTS "lideres_insert_public_self_registration" ON public.lideres;

CREATE POLICY "lideres_insert_public_self_registration"
ON public.lideres
FOR INSERT
WITH CHECK (
  (nome_completo IS NOT NULL) 
  AND (telefone IS NOT NULL) 
  AND (is_active = true)
  AND (cidade_id IS NOT NULL OR localidade IS NOT NULL)
);