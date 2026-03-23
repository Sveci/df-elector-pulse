-- ─────────────────────────────────────────────────────────────────────────────
-- whatsapp_chatbot_flows: visual flow builder flows
-- Each tenant can have many flows. Each flow holds a nodes[] and edges[] JSON.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.whatsapp_chatbot_flows (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  name           text not null default 'Novo Fluxo',
  description    text,
  is_active      boolean not null default true,
  is_published   boolean not null default false,
  published_at   timestamptz,
  nodes          jsonb not null default '[]'::jsonb,
  edges          jsonb not null default '[]'::jsonb,
  version        integer not null default 1,
  tags           text[] not null default '{}',
  color          text,
  icon           text,
  trigger_count  integer not null default 0,
  execution_count integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- RLS
alter table public.whatsapp_chatbot_flows enable row level security;

-- Policy: tenant isolation via profiles
create policy "tenant_isolation_flows"
  on public.whatsapp_chatbot_flows
  for all
  using (
    tenant_id = (
      select tenant_id from public.profiles
      where id = auth.uid()
      limit 1
    )
  )
  with check (
    tenant_id = (
      select tenant_id from public.profiles
      where id = auth.uid()
      limit 1
    )
  );

-- Updated_at trigger
create or replace function public.set_chatbot_flows_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_chatbot_flows_updated_at
  before update on public.whatsapp_chatbot_flows
  for each row execute function public.set_chatbot_flows_updated_at();

-- Index for faster tenant lookups
create index if not exists idx_chatbot_flows_tenant_updated
  on public.whatsapp_chatbot_flows(tenant_id, updated_at desc);
