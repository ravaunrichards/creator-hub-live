-- Run after 0027_payment_gift_schema_contract_repair.sql.
with required(table_name, column_name) as (
  values
    ('payments', 'metadata'),
    ('payments', 'package_id'),
    ('gifts', 'asset_key'),
    ('gifts', 'sound_url')
)
select
  'public.' || required.table_name as table_name,
  required.column_name,
  exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = required.table_name
      and c.column_name = required.column_name
  ) as exists
from required
order by required.table_name, required.column_name;
