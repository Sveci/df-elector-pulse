-- Normalize cargo values from labels to values
UPDATE public.organization SET cargo = 'deputado_federal' WHERE cargo = 'Deputado Federal';
UPDATE public.organization SET cargo = 'deputado_estadual' WHERE cargo = 'Deputado Estadual';
UPDATE public.organization SET cargo = 'deputado_distrital' WHERE cargo = 'Deputado Distrital';
UPDATE public.organization SET cargo = 'senador' WHERE cargo = 'Senador' OR cargo = 'Senadora';
UPDATE public.organization SET cargo = 'governador' WHERE cargo = 'Governador' OR cargo = 'Governadora';
UPDATE public.organization SET cargo = 'prefeito' WHERE cargo = 'Prefeito' OR cargo = 'Prefeita';
UPDATE public.organization SET cargo = 'vereador' WHERE cargo = 'Vereador' OR cargo = 'Vereadora';
UPDATE public.organization SET cargo = 'presidente' WHERE cargo = 'Presidente da República';
UPDATE public.organization SET cargo = 'vice_presidente' WHERE cargo = 'Vice-Presidente da República';
UPDATE public.organization SET cargo = 'vice_governador' WHERE cargo = 'Vice-Governador' OR cargo = 'Vice-Governadora';
UPDATE public.organization SET cargo = 'vice_prefeito' WHERE cargo = 'Vice-Prefeito' OR cargo = 'Vice-Prefeita';
UPDATE public.organization SET cargo = 'secretario_estadual' WHERE cargo = 'Secretário Estadual' OR cargo = 'Secretária Estadual';
UPDATE public.organization SET cargo = 'secretario_municipal' WHERE cargo = 'Secretário Municipal' OR cargo = 'Secretária Municipal';
UPDATE public.organization SET cargo = 'administrador_regional' WHERE cargo = 'Administrador Regional' OR cargo = 'Administradora Regional';
UPDATE public.organization SET cargo = 'conselheiro_tutelar' WHERE cargo = 'Conselheiro Tutelar' OR cargo = 'Conselheira Tutelar';