INSERT INTO public.user_tenants (user_id, tenant_id, is_default) VALUES
('e439f2b9-f08b-4f91-a496-49466c0e230a', '7a31e968-7374-410b-b9f6-5d1e7b6802a5', true),
('755b4b6e-31a8-4a95-a2f9-034e841c80b3', '7a31e968-7374-410b-b9f6-5d1e7b6802a5', true),
('a1bf35ed-bec0-4825-a1ad-04d4d5eec86f', '7a31e968-7374-410b-b9f6-5d1e7b6802a5', true),
('9ac85ec5-1306-4d9f-8851-77f4925e8411', '7a31e968-7374-410b-b9f6-5d1e7b6802a5', true),
('a24279c2-ef26-4c07-9c34-32e8f596a2dd', '7a31e968-7374-410b-b9f6-5d1e7b6802a5', true),
('3fabd41f-d5e0-44fc-bfd4-187b4359677d', '7a31e968-7374-410b-b9f6-5d1e7b6802a5', true),
('51860da1-f6cd-40a8-a4a3-a10a21253fe9', '7a31e968-7374-410b-b9f6-5d1e7b6802a5', true),
('82aa19d8-21a3-42cb-be08-8fbe208c7e89', '7a31e968-7374-410b-b9f6-5d1e7b6802a5', true),
('b8767e3c-cfff-41d9-a268-a38cd14ffbda', '7a31e968-7374-410b-b9f6-5d1e7b6802a5', true)
ON CONFLICT DO NOTHING;