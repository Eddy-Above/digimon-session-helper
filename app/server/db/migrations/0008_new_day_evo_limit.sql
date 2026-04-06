ALTER TABLE tamers ADD COLUMN used_per_day_orders text NOT NULL DEFAULT '[]';
ALTER TABLE tamers ADD COLUMN digivolutions_used_today integer NOT NULL DEFAULT 0;
