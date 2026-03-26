-- Cron para auto-discovery de proposições a cada 12 horas
SELECT cron.schedule(
  'auto-discover-proposicoes',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/auto-discover-proposicoes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY') || '"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
