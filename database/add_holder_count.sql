-- ====================================================================
-- SEEKTRIX — add a stored, auto-maintained holder count to companies
-- ====================================================================
-- Adds companies.number_of_holders and keeps it exactly in sync with the
-- unclaimed_holders table via a statement-level trigger (efficient for bulk
-- inserts). No app code needs to maintain it — Postgres does, on every
-- insert/delete/update, "simultaneously."
-- ====================================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS number_of_holders integer NOT NULL DEFAULT 0;

-- Backfill current counts
UPDATE companies c
SET number_of_holders = COALESCE((SELECT count(*) FROM unclaimed_holders h WHERE h.company_id = c.id), 0);

-- Keep it in sync going forward
CREATE OR REPLACE FUNCTION trg_sync_holder_count() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE companies c SET number_of_holders = number_of_holders + d.cnt
    FROM (SELECT company_id, count(*) AS cnt FROM new_rows GROUP BY company_id) d
    WHERE c.id = d.company_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE companies c SET number_of_holders = GREATEST(number_of_holders - d.cnt, 0)
    FROM (SELECT company_id, count(*) AS cnt FROM old_rows GROUP BY company_id) d
    WHERE c.id = d.company_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE companies c SET number_of_holders = GREATEST(number_of_holders - d.cnt, 0)
    FROM (SELECT company_id, count(*) AS cnt FROM old_rows GROUP BY company_id) d
    WHERE c.id = d.company_id;
    UPDATE companies c SET number_of_holders = number_of_holders + d.cnt
    FROM (SELECT company_id, count(*) AS cnt FROM new_rows GROUP BY company_id) d
    WHERE c.id = d.company_id;
  END IF;
  RETURN NULL;
END; $fn$;

DROP TRIGGER IF EXISTS holders_count_ins ON unclaimed_holders;
DROP TRIGGER IF EXISTS holders_count_del ON unclaimed_holders;
DROP TRIGGER IF EXISTS holders_count_upd ON unclaimed_holders;

CREATE TRIGGER holders_count_ins AFTER INSERT ON unclaimed_holders
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION trg_sync_holder_count();
CREATE TRIGGER holders_count_del AFTER DELETE ON unclaimed_holders
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION trg_sync_holder_count();
CREATE TRIGGER holders_count_upd AFTER UPDATE ON unclaimed_holders
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION trg_sync_holder_count();
