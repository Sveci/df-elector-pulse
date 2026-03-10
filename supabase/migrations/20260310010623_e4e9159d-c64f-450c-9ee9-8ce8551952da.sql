-- Vincular super_admin ao tenant Acácio Favacho
INSERT INTO user_tenants (user_id, tenant_id, role, is_default) VALUES
('44f8f661-93ea-4e36-a887-1224b077c225', '27ed4243-35e5-45fc-bcfc-1d1f969b7377', 'admin', true)
ON CONFLICT DO NOTHING;

-- Vincular super_admin ao tenant David Sveci
INSERT INTO user_tenants (user_id, tenant_id, role, is_default) VALUES
('44f8f661-93ea-4e36-a887-1224b077c225', '7a31e968-7374-410b-b9f6-5d1e7b6802a5', 'admin', false)
ON CONFLICT DO NOTHING;

-- Vincular admin Sveci ao tenant David Sveci
INSERT INTO user_tenants (user_id, tenant_id, role, is_default) VALUES
('3afd75b6-47ce-450a-bb91-8010a61781fa', '7a31e968-7374-410b-b9f6-5d1e7b6802a5', 'admin', true)
ON CONFLICT DO NOTHING;