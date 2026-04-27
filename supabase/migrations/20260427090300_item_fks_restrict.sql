BEGIN;

-- Pre-flight: check there are no NULL item_ids in the affected history tables
-- (NOT NULL constraints already exist, but defensive)

-- consumptions.item_id: CASCADE -> RESTRICT
-- Reason: deleting an item must NOT silently remove consumption history,
-- which would refund users by making their balance recalculation jump up.
ALTER TABLE public.consumptions
  DROP CONSTRAINT IF EXISTS consumptions_item_id_fkey;

ALTER TABLE public.consumptions
  ADD CONSTRAINT consumptions_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES public.items(id)
  ON DELETE RESTRICT;

-- stock_transactions.item_id: CASCADE -> RESTRICT
-- Reason: stock history must survive item deletion attempts.
ALTER TABLE public.stock_transactions
  DROP CONSTRAINT IF EXISTS stock_transactions_item_id_fkey;

ALTER TABLE public.stock_transactions
  ADD CONSTRAINT stock_transactions_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES public.items(id)
  ON DELETE RESTRICT;

-- stock_audit_items.item_id: CASCADE -> RESTRICT
-- Reason: audit history must survive item deletion attempts.
ALTER TABLE public.stock_audit_items
  DROP CONSTRAINT IF EXISTS stock_audit_items_item_id_fkey;

ALTER TABLE public.stock_audit_items
  ADD CONSTRAINT stock_audit_items_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES public.items(id)
  ON DELETE RESTRICT;

-- user_favorites.item_id stays CASCADE - favorites are not history,
-- removing them when an item is removed is acceptable.

COMMIT;
