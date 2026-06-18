
-- Health snapshots table
CREATE TABLE public.health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  connections_active int,
  connections_max int,
  connections_pct numeric,
  db_size_mb numeric,
  cache_hit_pct numeric,
  deadlocks bigint,
  rollbacks bigint,
  errors_5m int,
  total_runs_5m int,
  error_rate_pct numeric,
  severity text NOT NULL DEFAULT 'ok',
  notes jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.health_snapshots TO authenticated;
GRANT ALL ON public.health_snapshots TO service_role;

ALTER TABLE public.health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins view health"
ON public.health_snapshots FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_health_snapshots_captured_at ON public.health_snapshots(captured_at DESC);

-- Security-definer function exposing the live metrics needed for snapshots
CREATE OR REPLACE FUNCTION public.get_health_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  _active int;
  _max int;
  _dbsize numeric;
  _cache numeric;
  _deadlocks bigint;
  _rollbacks bigint;
BEGIN
  SELECT count(*) INTO _active FROM pg_stat_activity WHERE state IS NOT NULL;
  SELECT setting::int INTO _max FROM pg_settings WHERE name = 'max_connections';
  SELECT (pg_database_size(current_database())::numeric / 1024 / 1024) INTO _dbsize;

  SELECT
    CASE WHEN sum(blks_hit + blks_read) = 0 THEN 100
    ELSE round(100.0 * sum(blks_hit)::numeric / nullif(sum(blks_hit + blks_read), 0), 2)
    END,
    sum(deadlocks), sum(xact_rollback)
  INTO _cache, _deadlocks, _rollbacks
  FROM pg_stat_database WHERE datname = current_database();

  RETURN jsonb_build_object(
    'connections_active', _active,
    'connections_max', _max,
    'connections_pct', round(100.0 * _active::numeric / nullif(_max, 0), 2),
    'db_size_mb', round(_dbsize, 2),
    'cache_hit_pct', _cache,
    'deadlocks', _deadlocks,
    'rollbacks', _rollbacks
  );
END $$;

REVOKE ALL ON FUNCTION public.get_health_metrics() FROM public;
GRANT EXECUTE ON FUNCTION public.get_health_metrics() TO service_role;
