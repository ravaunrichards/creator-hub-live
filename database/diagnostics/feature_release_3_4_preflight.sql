-- Creator Hub Creator Network 3.4.0 — READ-ONLY release preflight.
-- Run against the intended Supabase project before applying or changing anything.
-- This script reads metadata only: it does not create, update, delete or seed data.

with expected(table_name, column_name, feature) as (
  values
    ('profiles','id','Identity'), ('profiles','username','Creator profiles'), ('profiles','privacy','Privacy controls'),
    ('posts','id','Social feed'), ('posts','caption','Social feed'), ('posts','media','Social media'), ('posts','audience','Social privacy'), ('posts','is_draft','Social publishing'), ('posts','is_test','Test content exclusion'),
    ('follows','follower_id','Follow graph'), ('follows','followee_id','Follow graph'), ('follows','status','Follow privacy'),
    ('likes','post_id','Likes'), ('likes','user_id','Likes'), ('comments','post_id','Comments'), ('comments','author_id','Comments'), ('comments','body','Comments'),
    ('reposts','post_id','Reposts'), ('reposts','user_id','Reposts'), ('saves','post_id','Saved posts'), ('saves','user_id','Saved posts'),
    ('conversations','id','Messaging'), ('conversation_members','conversation_id','Messaging membership'), ('conversation_members','user_id','Messaging membership'),
    ('messages','conversation_id','Messaging'), ('messages','sender_id','Messaging'), ('messages','body','Messaging'),
    ('notifications','user_id','Notifications'), ('notifications','data','Notifications'), ('notifications','read','Notifications'),
    ('coin_packages','coins','Coin packages'), ('coin_packages','price','PayPal checkout'), ('coin_packages','currency','PayPal checkout'), ('coin_packages','active','PayPal checkout'),
    ('teams','description','Teams form'), ('teams','parish','Teams form'), ('teams','max_members','Team membership'), ('teams','recruiting','Team membership'),
    ('user_settings','user_id','Account settings'), ('live_schedules','creator_id','LIVE scheduling'), ('live_schedules','starts_at','LIVE scheduling'), ('live_schedules','status','LIVE scheduling'), ('paypal_payout_info','user_id','Creator payout settings'),
    ('diamond_withdrawals','user_id','Creator withdrawals'), ('course_progress','user_id','Creator Academy sync'), ('course_progress','course_id','Creator Academy sync')
)
select e.feature, e.table_name, e.column_name,
       (c.column_name is not null) as present,
       case when c.column_name is null then 'MISSING — reconcile schema before using this feature' else 'OK' end as status
from expected e
left join information_schema.columns c
  on c.table_schema='public' and c.table_name=e.table_name and c.column_name=e.column_name
order by e.feature, e.table_name, e.column_name;

select f.feature_name, (to_regprocedure(f.signature) is not null) as present,
       case when to_regprocedure(f.signature) is null then 'MISSING — required only for this feature/route' else 'OK' end as status
from (values
  ('Direct message creation','public.create_or_get_direct_conversation(uuid)'),
  ('Persistent account settings','public.save_my_user_settings(jsonb,jsonb,jsonb)'),
  ('Creator analytics','public.get_my_creator_metrics()'),
  ('Public creator rankings','public.get_public_creator_rankings(text,integer)'),
  ('Gift debit/credit atomicity','public.send_gift(uuid,uuid,uuid,uuid,text)'),
  ('Creator payout request','public.request_creator_payout(uuid,bigint,text,text)'),
  ('Admin payout update','public.admin_update_creator_payout(uuid,text,numeric,text,text,text,uuid)')
) as f(feature_name, signature)
order by f.feature_name;

select 'creator-content' as storage_bucket,
       exists(select 1 from storage.buckets b where b.id='creator-content') as present,
       case when exists(select 1 from storage.buckets b where b.id='creator-content') then 'OK' else 'MISSING — apply reviewed migration 0022 or configure storage manually' end as status;

-- NOTE: A missing item is not permission to blindly rerun the entire migration chain.
-- Review actual migration history, production data and each prerequisite before changing schema.
