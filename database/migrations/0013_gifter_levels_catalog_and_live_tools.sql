-- Creator Hub Live — 0013 consolidated gifting and LIVE room tools.
-- Apply after migrations 0001–0012. Take a database backup first.
-- No user accounts, gift transactions, matches, or leaderboard results are fabricated.

-- Repair legacy gift schema omissions used by server-side wallet code.
alter table public.wallets add column if not exists lifetime_gifts_sent bigint not null default 0;
alter table public.gift_transactions add column if not exists idempotency_key text;
create unique index if not exists gift_transactions_idempotency_unique on public.gift_transactions(idempotency_key) where idempotency_key is not null;

alter table public.gifts add column if not exists emoji text not null default '🎁';
alter table public.gifts add column if not exists catalog_order integer not null default 0;
alter table public.gifts add column if not exists animation_key text not null default 'everyday';
alter table public.gifts add column if not exists sound_key text not null default 'soft';

-- The old seed migration did not guarantee unique gift names. Re-point old transaction
-- foreign keys to one canonical row before removing only duplicate catalogue rows.
with ranked as (
  select id, first_value(id) over(partition by name order by active desc,id) as canonical_id,
         row_number() over(partition by name order by active desc,id) as rn
  from public.gifts
)
update public.gift_transactions t set gift_id=r.canonical_id
from ranked r where t.gift_id=r.id and r.rn>1 and t.gift_id is distinct from r.canonical_id;
with ranked as (
  select id, row_number() over(partition by name order by active desc,id) as rn from public.gifts
)
delete from public.gifts g using ranked r where g.id=r.id and r.rn>1;
create unique index if not exists gifts_name_unique_idx on public.gifts(name);

-- Gift catalogue: coin prices and titles follow the 90-item supplied CHL catalogue.
-- diamond_value is intentionally left at 0 for new gifts until the platform's creator payout conversion is formally configured.
insert into public.gifts (name,category,emoji,catalog_order,animation_key,sound_key,coin_price,diamond_value,rarity,active)
values
  ('Single Rose', 'EVERYDAY GIFTS', '🌹', 1, 'everyday', 'soft', 1, 0, 'everyday', true),
  ('Heart', 'EVERYDAY GIFTS', '❤️', 2, 'everyday', 'soft', 1, 0, 'everyday', true),
  ('Shining Star', 'EVERYDAY GIFTS', '⭐', 3, 'everyday', 'soft', 1, 0, 'everyday', true),
  ('Applause', 'EVERYDAY GIFTS', '👏', 4, 'everyday', 'soft', 1, 0, 'everyday', true),
  ('Ice Cream', 'EVERYDAY GIFTS', '🍦', 5, 'everyday', 'soft', 1, 0, 'everyday', true),
  ('Finger Heart', 'EVERYDAY GIFTS', '🫰', 6, 'everyday', 'soft', 5, 0, 'everyday', true),
  ('Panda', 'EVERYDAY GIFTS', '🐼', 7, 'everyday', 'soft', 5, 0, 'everyday', true),
  ('Kiss', 'EVERYDAY GIFTS', '💋', 8, 'everyday', 'soft', 5, 0, 'everyday', true),
  ('Pink Tulip', 'EVERYDAY GIFTS', '🌷', 9, 'everyday', 'soft', 10, 0, 'everyday', true),
  ('Coffee', 'EVERYDAY GIFTS', '☕', 10, 'everyday', 'soft', 10, 0, 'everyday', true),
  ('Balloon', 'EVERYDAY GIFTS', '🎈', 11, 'everyday', 'soft', 10, 0, 'everyday', true),
  ('Bravo', 'EVERYDAY GIFTS', '👏✨', 12, 'everyday', 'soft', 15, 0, 'everyday', true),
  ('Flower Bouquet', 'EVERYDAY GIFTS', '💐', 13, 'everyday', 'soft', 20, 0, 'everyday', true),
  ('Swan', 'EVERYDAY GIFTS', '🦢', 14, 'everyday', 'soft', 20, 0, 'everyday', true),
  ('Doughnut', 'EVERYDAY GIFTS', '🍩', 15, 'everyday', 'soft', 30, 0, 'everyday', true),
  ('Teddy Bear', 'EVERYDAY GIFTS', '🧸', 16, 'everyday', 'soft', 30, 0, 'everyday', true),
  ('Birthday Cake', 'EVERYDAY GIFTS', '🎂', 17, 'everyday', 'soft', 50, 0, 'everyday', true),
  ('Sunflower', 'EVERYDAY GIFTS', '🌻', 18, 'everyday', 'soft', 50, 0, 'everyday', true),
  ('Love Letter', 'EVERYDAY GIFTS', '💌', 19, 'everyday', 'soft', 75, 0, 'everyday', true),
  ('Stylish Cap', 'EVERYDAY GIFTS', '🧢', 20, 'everyday', 'soft', 99, 0, 'everyday', true),
  ('Hand Hearts', 'SUPPORTER GIFTS', '🫶', 21, 'supporter', 'soft', 100, 0, 'supporter', true),
  ('Confetti Celebration', 'SUPPORTER GIFTS', '🎊', 22, 'supporter', 'soft', 100, 0, 'supporter', true),
  ('Crystal Gem', 'SUPPORTER GIFTS', '💎', 23, 'supporter', 'soft', 150, 0, 'supporter', true),
  ('Cool Sunglasses', 'SUPPORTER GIFTS', '🕶️', 24, 'supporter', 'soft', 199, 0, 'supporter', true),
  ('Celebration Toast', 'SUPPORTER GIFTS', '🥂', 25, 'supporter', 'soft', 250, 0, 'supporter', true),
  ('Corgi', 'SUPPORTER GIFTS', '🐶', 26, 'supporter', 'soft', 299, 0, 'supporter', true),
  ('Grand Rose Bouquet', 'SUPPORTER GIFTS', '🌹💐', 27, 'supporter', 'soft', 300, 0, 'supporter', true),
  ('Premium Headphones', 'SUPPORTER GIFTS', '🎧', 28, 'supporter', 'soft', 350, 0, 'supporter', true),
  ('Butterfly Wings', 'SUPPORTER GIFTS', '🦋', 29, 'supporter', 'soft', 399, 0, 'supporter', true),
  ('Coral Treasure', 'SUPPORTER GIFTS', '🪸', 30, 'supporter', 'soft', 499, 0, 'supporter', true),
  ('Money Gun', 'PREMIUM GIFTS', '💸', 31, 'premium', 'soft', 500, 0, 'premium', true),
  ('Golden Microphone', 'PREMIUM GIFTS', '🎤', 32, 'premium', 'soft', 550, 0, 'premium', true),
  ('Drum Performance', 'PREMIUM GIFTS', '🥁', 33, 'premium', 'soft', 600, 0, 'premium', true),
  ('Dance Spotlight', 'PREMIUM GIFTS', '💃', 34, 'premium', 'soft', 650, 0, 'premium', true),
  ('Silver Trophy', 'PREMIUM GIFTS', '🏆', 35, 'premium', 'soft', 700, 0, 'premium', true),
  ('Gaming Champion', 'PREMIUM GIFTS', '🎮', 36, 'premium', 'soft', 750, 0, 'premium', true),
  ('Royal Peacock', 'PREMIUM GIFTS', '🦚', 37, 'premium', 'soft', 800, 0, 'premium', true),
  ('Celebration Fireworks', 'PREMIUM GIFTS', '🎆', 38, 'premium', 'soft', 850, 0, 'premium', true),
  ('Ocean Dolphin', 'PREMIUM GIFTS', '🐬', 39, 'premium', 'soft', 900, 0, 'premium', true),
  ('Royal Crown', 'PREMIUM GIFTS', '👑', 40, 'premium', 'soft', 999, 0, 'premium', true),
  ('Galaxy', 'ELITE GIFTS', '🌌', 41, 'elite', 'soft', 1000, 0, 'elite', true),
  ('Royal Peacock Show', 'ELITE GIFTS', '🦚✨', 42, 'elite', 'soft', 1200, 0, 'elite', true),
  ('Dream Wedding', 'ELITE GIFTS', '💒', 43, 'elite', 'soft', 1500, 0, 'elite', true),
  ('Shooting Stars', 'ELITE GIFTS', '🌠', 44, 'elite', 'soft', 1800, 0, 'elite', true),
  ('Ocean Whale', 'ELITE GIFTS', '🐋', 45, 'elite', 'soft', 2000, 0, 'elite', true),
  ('Sunset of Love', 'ELITE GIFTS', '💖🌅', 46, 'elite', 'soft', 2200, 0, 'elite', true),
  ('Super Motorcycle', 'ELITE GIFTS', '🏍️', 47, 'elite', 'soft', 2500, 0, 'elite', true),
  ('Party Bus', 'ELITE GIFTS', '🚌', 48, 'elite', 'soft', 2800, 0, 'elite', true),
  ('Meteor Shower', 'ELITE GIFTS', '☄️', 49, 'elite', 'soft', 3000, 0, 'elite', true),
  ('Rockstar Concert', 'ELITE GIFTS', '🎸', 50, 'elite', 'soft', 3500, 0, 'elite', true),
  ('Golden Dragon', 'ELITE GIFTS', '🐉', 51, 'elite', 'soft', 4000, 0, 'elite', true),
  ('Private Jet', 'ELITE GIFTS', '✈️', 52, 'elite', 'soft', 4888, 0, 'elite', true),
  ('Hero Spaceship', 'LEGENDARY GIFTS', '🚀', 53, 'legendary', 'mythic', 5000, 0, 'legendary', true),
  ('Superstar Performance', 'LEGENDARY GIFTS', '🎭', 54, 'legendary', 'mythic', 6000, 0, 'legendary', true),
  ('Luxury Sports Car', 'LEGENDARY GIFTS', '🏎️', 55, 'legendary', 'mythic', 7000, 0, 'legendary', true),
  ('Golden Eagle', 'LEGENDARY GIFTS', '🦅', 56, 'legendary', 'mythic', 8000, 0, 'legendary', true),
  ('Volcanic Explosion', 'LEGENDARY GIFTS', '🌋', 57, 'legendary', 'mythic', 9000, 0, 'legendary', true),
  ('Interstellar Journey', 'LEGENDARY GIFTS', '🌠🌌', 58, 'legendary', 'mythic', 10000, 0, 'legendary', true),
  ('Global Superstar', 'LEGENDARY GIFTS', '🎤🌟', 59, 'legendary', 'mythic', 12000, 0, 'legendary', true),
  ('Planetary Kingdom', 'LEGENDARY GIFTS', '🪐', 60, 'legendary', 'mythic', 15000, 0, 'legendary', true),
  ('Royal Castle', 'LEGENDARY GIFTS', '🏰', 61, 'legendary', 'mythic', 18000, 0, 'legendary', true),
  ('Creator Hub Shuttle', 'CHAMPION & LEAGUE GIFTS', '🛸', 62, 'champion', 'mythic', 20000, 0, 'champion', true),
  ('Diamond Lion', 'CHAMPION & LEAGUE GIFTS', '🦁', 63, 'champion', 'mythic', 22000, 0, 'champion', true),
  ('Legendary Phoenix', 'CHAMPION & LEAGUE GIFTS', '🔥🐦', 64, 'champion', 'mythic', 25000, 0, 'champion', true),
  ('League Champion', 'CHAMPION & LEAGUE GIFTS', '🏆👑', 65, 'champion', 'mythic', 30000, 0, 'champion', true),
  ('World of Wonders', 'CHAMPION & LEAGUE GIFTS', '🌍✨', 66, 'champion', 'mythic', 35000, 0, 'champion', true),
  ('Dragon Emperor', 'CHAMPION & LEAGUE GIFTS', '🐉👑', 67, 'champion', 'mythic', 40000, 0, 'champion', true),
  ('Cosmic Empire', 'CHAMPION & LEAGUE GIFTS', '🌌👑', 68, 'champion', 'mythic', 45000, 0, 'champion', true),
  ('Diamond Kingdom', 'CHAMPION & LEAGUE GIFTS', '💎🏰', 69, 'champion', 'mythic', 49999, 0, 'champion', true),
  ('Inferno Lion', 'MYTHICAL & ULTIMATE GIFTS', '🦁🔥', 70, 'mythical', 'mythic', 50000, 0, 'mythical', true),
  ('Cosmic Supernova', 'MYTHICAL & ULTIMATE GIFTS', '🌠🚀', 71, 'mythical', 'mythic', 75000, 0, 'mythical', true),
  ('Emperor''s Lion', 'MYTHICAL & ULTIMATE GIFTS', '👑🦁', 72, 'mythical', 'mythic', 100000, 0, 'mythical', true),
  ('Diamond Planet', 'MYTHICAL & ULTIMATE GIFTS', '🌎💎', 73, 'mythical', 'mythic', 150000, 0, 'mythical', true),
  ('Galactic Dragon', 'MYTHICAL & ULTIMATE GIFTS', '🐉🌌', 74, 'mythical', 'mythic', 200000, 0, 'mythical', true),
  ('Imperial Palace', 'MYTHICAL & ULTIMATE GIFTS', '🏰👑', 75, 'mythical', 'mythic', 250000, 0, 'mythical', true),
  ('Infinite Galaxy', 'MYTHICAL & ULTIMATE GIFTS', '🌌💫', 76, 'mythical', 'mythic', 300000, 0, 'mythical', true),
  ('Celestial Phoenix', 'MYTHICAL & ULTIMATE GIFTS', '🦅⚡', 77, 'mythical', 'mythic', 400000, 0, 'mythical', true),
  ('World Emperor', 'MYTHICAL & ULTIMATE GIFTS', '🌍👑', 78, 'mythical', 'mythic', 500000, 0, 'mythical', true),
  ('Eternal Diamond Universe', 'MYTHICAL & ULTIMATE GIFTS', '💎🌌', 79, 'mythical', 'mythic', 750000, 0, 'mythical', true),
  ('Creator Hub Ultimate Universe', 'MYTHICAL & ULTIMATE GIFTS', '👑🌌🔥', 80, 'mythical', 'mythic', 1000000, 0, 'mythical', true),
  ('Yard Certified', 'YARD TINGZ 🇯🇲', '🇯🇲', 81, 'yard_pride', 'island', 50, 0, 'yard_pride', true),
  ('Pretty Like Yard', 'YARD TINGZ 🇯🇲', '🌺', 82, 'yard_pride', 'island', 100, 0, 'yard_pride', true),
  ('Beat A Di Yard', 'YARD TINGZ 🇯🇲', '🥁🇯🇲', 83, 'yard_pride', 'island', 250, 0, 'yard_pride', true),
  ('Road Ready', 'YARD TINGZ 🇯🇲', '🎭', 84, 'yard_pride', 'island', 500, 0, 'yard_pride', true),
  ('Island Life', 'YARD TINGZ 🇯🇲', '🌴🌅', 85, 'yard_pride', 'island', 1000, 0, 'yard_pride', true),
  ('Born Fi Run', 'YARD TINGZ 🇯🇲', '🏃🇯🇲', 86, 'yard_pride', 'island', 2500, 0, 'yard_pride', true),
  ('Cricket Boss', 'YARD TINGZ 🇯🇲', '🏏🏆', 87, 'yard_pride', 'island', 5000, 0, 'yard_pride', true),
  ('Parish Don', 'YARD TINGZ 🇯🇲', '⚽🇯🇲', 88, 'yard_pride', 'island', 10000, 0, 'yard_pride', true),
  ('Yard Champion', 'YARD TINGZ 🇯🇲', '🏆🇯🇲', 89, 'yard_pride', 'island', 25000, 0, 'yard_pride', true),
  ('Caribbean Don', 'YARD TINGZ 🇯🇲', '🌎🇯🇲', 90, 'yard_pride', 'island', 50000, 0, 'yard_pride', true)
on conflict (name) do update set
  category=excluded.category, emoji=excluded.emoji, catalog_order=excluded.catalog_order,
  animation_key=excluded.animation_key, sound_key=excluded.sound_key,
  coin_price=excluded.coin_price, diamond_value=excluded.diamond_value, rarity=excluded.rarity;
-- Disable legacy starter/placeholder gifts not in this 90-item approved catalogue;
-- old gift transaction history is retained for audit and progression.
update public.gifts set active=false where name not in ('Single Rose', 'Heart', 'Shining Star', 'Applause', 'Ice Cream', 'Finger Heart', 'Panda', 'Kiss', 'Pink Tulip', 'Coffee', 'Balloon', 'Bravo', 'Flower Bouquet', 'Swan', 'Doughnut', 'Teddy Bear', 'Birthday Cake', 'Sunflower', 'Love Letter', 'Stylish Cap', 'Hand Hearts', 'Confetti Celebration', 'Crystal Gem', 'Cool Sunglasses', 'Celebration Toast', 'Corgi', 'Grand Rose Bouquet', 'Premium Headphones', 'Butterfly Wings', 'Coral Treasure', 'Money Gun', 'Golden Microphone', 'Drum Performance', 'Dance Spotlight', 'Silver Trophy', 'Gaming Champion', 'Royal Peacock', 'Celebration Fireworks', 'Ocean Dolphin', 'Royal Crown', 'Galaxy', 'Royal Peacock Show', 'Dream Wedding', 'Shooting Stars', 'Ocean Whale', 'Sunset of Love', 'Super Motorcycle', 'Party Bus', 'Meteor Shower', 'Rockstar Concert', 'Golden Dragon', 'Private Jet', 'Hero Spaceship', 'Superstar Performance', 'Luxury Sports Car', 'Golden Eagle', 'Volcanic Explosion', 'Interstellar Journey', 'Global Superstar', 'Planetary Kingdom', 'Royal Castle', 'Creator Hub Shuttle', 'Diamond Lion', 'Legendary Phoenix', 'League Champion', 'World of Wonders', 'Dragon Emperor', 'Cosmic Empire', 'Diamond Kingdom', 'Inferno Lion', 'Cosmic Supernova', 'Emperor''s Lion', 'Diamond Planet', 'Galactic Dragon', 'Imperial Palace', 'Infinite Galaxy', 'Celestial Phoenix', 'World Emperor', 'Eternal Diamond Universe', 'Creator Hub Ultimate Universe', 'Yard Certified', 'Pretty Like Yard', 'Beat A Di Yard', 'Road Ready', 'Island Life', 'Born Fi Run', 'Cricket Boss', 'Parish Don', 'Yard Champion', 'Caribbean Don');

-- Gifter thresholds: level is earned from verified, unreversed gift coin spend.
create table if not exists public.gifter_level_thresholds (level integer primary key check(level between 0 and 51), coin_threshold bigint not null unique check(coin_threshold >= 0), emoji text not null, title text not null, badge_category text not null check (badge_category in ('Visiting Supporter','Dedicated Supporter','Elite Supporter','Legendary Supporter')));
insert into public.gifter_level_thresholds(level,coin_threshold,emoji,title,badge_category) values
  (0,0,'🌱','Newcomer','Visiting Supporter'),
  (1,1,'🌹','First Gift','Visiting Supporter'),
  (2,5,'❤️','Kind Supporter','Visiting Supporter'),
  (3,10,'👏','Friendly Gifter','Visiting Supporter'),
  (4,20,'🎈','Rising Supporter','Visiting Supporter'),
  (5,35,'🫶','Bronze Supporter','Visiting Supporter'),
  (6,50,'⭐','Star Supporter','Visiting Supporter'),
  (7,75,'💐','Generous Supporter','Visiting Supporter'),
  (8,100,'🎁','Gift Collector','Visiting Supporter'),
  (9,150,'🥉','Bronze Gifter','Visiting Supporter'),
  (10,200,'🌟','Dedicated Supporter','Dedicated Supporter'),
  (11,300,'🥈','Silver Supporter','Dedicated Supporter'),
  (12,400,'🎊','Celebration Gifter','Dedicated Supporter'),
  (13,500,'🏅','Loyal Gifter','Dedicated Supporter'),
  (14,750,'🥈','Silver Gifter','Dedicated Supporter'),
  (15,1000,'👑','Gold Supporter','Dedicated Supporter'),
  (16,1500,'🔥','Passionate Gifter','Dedicated Supporter'),
  (17,2000,'🏆','Gold Gifter','Dedicated Supporter'),
  (18,3000,'💠','Platinum Supporter','Dedicated Supporter'),
  (19,4000,'💎','Platinum Gifter','Dedicated Supporter'),
  (20,5000,'🦚','Elite Supporter','Elite Supporter'),
  (21,7500,'👑','Elite Gifter','Elite Supporter'),
  (22,10000,'🌠','Rising Elite','Elite Supporter'),
  (23,15000,'💠','Diamond Supporter','Elite Supporter'),
  (24,20000,'💎','Diamond Gifter','Elite Supporter'),
  (25,30000,'🦁','Royal Supporter','Elite Supporter'),
  (26,40000,'👑','Royal Gifter','Elite Supporter'),
  (27,50000,'🌌','Cosmic Supporter','Elite Supporter'),
  (28,65000,'☄️','Cosmic Gifter','Elite Supporter'),
  (29,80000,'🔥','Legendary Supporter','Elite Supporter'),
  (30,100000,'🏆','Legendary Gifter','Elite Supporter'),
  (31,125000,'🐉','Dragon Supporter','Elite Supporter'),
  (32,150000,'🐉','Dragon Gifter','Elite Supporter'),
  (33,175000,'🌍','Global Supporter','Elite Supporter'),
  (34,200000,'🌍','Global Gifter','Elite Supporter'),
  (35,250000,'⚡','Supreme Supporter','Legendary Supporter'),
  (36,300000,'⚡','Supreme Gifter','Legendary Supporter'),
  (37,350000,'🔱','Imperial Supporter','Legendary Supporter'),
  (38,400000,'🔱','Imperial Gifter','Legendary Supporter'),
  (39,450000,'🌠','Celestial Supporter','Legendary Supporter'),
  (40,500000,'🌠','Celestial Gifter','Legendary Supporter'),
  (41,550000,'🏰','Emperor Supporter','Legendary Supporter'),
  (42,600000,'🏰','Emperor Gifter','Legendary Supporter'),
  (43,650000,'👑','Mythical Supporter','Legendary Supporter'),
  (44,700000,'👑','Mythical Gifter','Legendary Supporter'),
  (45,750000,'💫','Immortal Supporter','Legendary Supporter'),
  (46,800000,'💫','Immortal Gifter','Legendary Supporter'),
  (47,850000,'🌌','Universal Supporter','Legendary Supporter'),
  (48,900000,'🌌','Universal Gifter','Legendary Supporter'),
  (49,950000,'🏆','CHL Legend','Legendary Supporter'),
  (50,975000,'🔥','CHL Grand Legend','Legendary Supporter'),
  (51,1000000,'👑🌌','CHL Ultimate Gifter','Legendary Supporter')
on conflict (level) do update set coin_threshold=excluded.coin_threshold, emoji=excluded.emoji, title=excluded.title, badge_category=excluded.badge_category;

create table if not exists public.gift_transaction_reversals (
  transaction_id uuid primary key references public.gift_transactions(id) on delete cascade,
  reversed_coins bigint not null check(reversed_coins > 0),
  reason text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.gifter_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  eligible_coins_spent bigint not null default 0 check(eligible_coins_spent >= 0),
  gifts_sent bigint not null default 0 check(gifts_sent >= 0),
  distinct_gift_types bigint not null default 0 check(distinct_gift_types >= 0),
  yard_gifts_sent bigint not null default 0 check(yard_gifts_sent >= 0),
  yard_distinct_gift_types bigint not null default 0 check(yard_distinct_gift_types >= 0),
  gifter_level integer not null default 0 check(gifter_level between 0 and 51),
  level_title text not null default 'Newcomer',
  badge_category text not null default 'Visiting Supporter',
  updated_at timestamptz not null default now()
);

create or replace function public.recalculate_gifter_progress(p_user uuid)
returns public.gifter_progress language plpgsql security definer set search_path=public as $$
declare v_coins bigint; v_gifts bigint; v_variety bigint; v_yard_gifts bigint; v_yard_variety bigint; v_level integer; v_title text; v_badge text; outrow public.gifter_progress;
begin
  if p_user is null then raise exception 'GIFTER_USER_REQUIRED'; end if;
  select coalesce(sum(greatest(t.coin_cost-coalesce(r.reversed_coins,0),0)),0),
         count(*) filter(where greatest(t.coin_cost-coalesce(r.reversed_coins,0),0)>0),
         count(distinct t.gift_id) filter(where greatest(t.coin_cost-coalesce(r.reversed_coins,0),0)>0),
         count(*) filter(where greatest(t.coin_cost-coalesce(r.reversed_coins,0),0)>0 and upper(g.category) like 'YARD TINGZ%'),
         count(distinct t.gift_id) filter(where greatest(t.coin_cost-coalesce(r.reversed_coins,0),0)>0 and upper(g.category) like 'YARD TINGZ%')
    into v_coins,v_gifts,v_variety,v_yard_gifts,v_yard_variety
    from public.gift_transactions t
    join public.gifts g on g.id=t.gift_id
    left join public.gift_transaction_reversals r on r.transaction_id=t.id
   where t.sender_id=p_user;
  select level,title,badge_category into v_level,v_title,v_badge
    from public.gifter_level_thresholds where coin_threshold<=v_coins order by level desc limit 1;
  v_level:=coalesce(v_level,0); v_title:=coalesce(v_title,'Newcomer'); v_badge:=coalesce(v_badge,'Visiting Supporter');
  insert into public.gifter_progress(user_id,eligible_coins_spent,gifts_sent,distinct_gift_types,yard_gifts_sent,yard_distinct_gift_types,gifter_level,level_title,badge_category,updated_at)
  values(p_user,v_coins,v_gifts,v_variety,v_yard_gifts,v_yard_variety,v_level,v_title,v_badge,now())
  on conflict(user_id) do update set eligible_coins_spent=excluded.eligible_coins_spent,gifts_sent=excluded.gifts_sent,distinct_gift_types=excluded.distinct_gift_types,yard_gifts_sent=excluded.yard_gifts_sent,yard_distinct_gift_types=excluded.yard_distinct_gift_types,gifter_level=excluded.gifter_level,level_title=excluded.level_title,badge_category=excluded.badge_category,updated_at=now()
  returning * into outrow;
  update public.profiles set gifter_level=v_level,updated_at=now() where id=p_user;
  return outrow;
end; $$;

create or replace function public.trg_refresh_gifter_progress()
returns trigger language plpgsql security definer set search_path=public as $$
declare who uuid; old_who uuid; new_who uuid; old_tx_id uuid; new_tx_id uuid;
begin
  if TG_TABLE_NAME='gift_transactions' then
    if TG_OP <> 'INSERT' then old_who:=old.sender_id; end if;
    if TG_OP <> 'DELETE' then new_who:=new.sender_id; end if;
  else
    if TG_OP <> 'INSERT' then old_tx_id:=old.transaction_id; end if;
    if TG_OP <> 'DELETE' then new_tx_id:=new.transaction_id; end if;
    if old_tx_id is not null then select sender_id into old_who from public.gift_transactions where id=old_tx_id; end if;
    if new_tx_id is not null then select sender_id into new_who from public.gift_transactions where id=new_tx_id; end if;
  end if;
  if old_who is not null then perform public.recalculate_gifter_progress(old_who); end if;
  if new_who is not null and new_who is distinct from old_who then perform public.recalculate_gifter_progress(new_who); end if;
  if TG_OP='DELETE' then return old; else return new; end if;
end; $$;
drop trigger if exists gift_transaction_refresh_gifter on public.gift_transactions;
create trigger gift_transaction_refresh_gifter after insert or update or delete on public.gift_transactions for each row execute function public.trg_refresh_gifter_progress();
drop trigger if exists gift_reversal_refresh_gifter on public.gift_transaction_reversals;
create trigger gift_reversal_refresh_gifter after insert or update or delete on public.gift_transaction_reversals for each row execute function public.trg_refresh_gifter_progress();

create or replace function public.validate_gift_reversal()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_cost bigint;
begin
  select coin_cost into v_cost from public.gift_transactions where id=new.transaction_id for update;
  if v_cost is null or new.reversed_coins > v_cost then raise exception 'INVALID_GIFT_REVERSAL_AMOUNT'; end if;
  if length(trim(coalesce(new.reason,'')))<3 then raise exception 'GIFT_REVERSAL_REASON_REQUIRED'; end if;
  return new;
end; $$;
drop trigger if exists gift_reversal_validate on public.gift_transaction_reversals;
create trigger gift_reversal_validate before insert or update on public.gift_transaction_reversals for each row execute function public.validate_gift_reversal();

create table if not exists public.gifter_achievement_definitions (code text primary key, name text not null, description text not null, criteria jsonb not null);
insert into public.gifter_achievement_definitions(code,name,description,criteria) values
('first_gift','First Gift','Send your first eligible gift.','{"giftCount":1}'::jsonb),
('gift_enthusiast','Gift Enthusiast','Send 10 eligible gifts.','{"giftCount":10}'::jsonb),
('gift_supporter','Gift Supporter','Send 100 eligible gifts.','{"giftCount":100}'::jsonb),
('gift_champion','Gift Champion','Send 500 eligible gifts.','{"giftCount":500}'::jsonb),
('master_gifter','Master Gifter','Send 1,000 eligible gifts.','{"giftCount":1000}'::jsonb),
('gift_legend','Gift Legend','Send 5,000 eligible gifts.','{"giftCount":5000}'::jsonb),
('variety_starter','Variety Starter','Send 3 different gift types.','{"variety":3}'::jsonb),
('gift_explorer','Gift Explorer','Send 5 different gift types.','{"variety":5}'::jsonb),
('gift_collector','Gift Collector','Send 10 different gift types.','{"variety":10}'::jsonb),
('catalogue_explorer','Catalogue Explorer','Send 20 different gift types.','{"variety":20}'::jsonb),
('yard_tingz_starter','Yard Tingz Starter','Send a Yard Tingz 🇯🇲 gift.','{"yardGiftCount":1}'::jsonb),
('island_celebration','Island Celebration','Send 5 different Yard Tingz 🇯🇲 gift types.','{"yardVariety":5}'::jsonb)
on conflict(code) do update set name=excluded.name,description=excluded.description,criteria=excluded.criteria;

create or replace function public.send_gift(p_sender uuid,p_recipient uuid,p_gift uuid,p_live uuid,p_idempotency_key text)
returns public.gift_transactions language plpgsql security definer set search_path=public as $$
declare g public.gifts; tx public.gift_transactions; sender_balance bigint; recipient_diamonds bigint;
begin
  if p_sender is null or p_recipient is null or p_gift is null then raise exception 'INVALID_GIFT'; end if;
  if p_sender=p_recipient then raise exception 'CANNOT_GIFT_SELF'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key))<16 or length(p_idempotency_key)>200 then raise exception 'GIFT_IDEMPOTENCY_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key,0));
  select * into tx from public.gift_transactions where idempotency_key=p_idempotency_key limit 1;
  if tx.id is not null then return tx; end if;
  select * into g from public.gifts where id=p_gift and active=true for share;
  if g.id is null then raise exception 'GIFT_NOT_AVAILABLE'; end if;
  if coalesce(g.diamond_value,0)<=0 then raise exception 'GIFT_PAYOUT_NOT_CONFIGURED'; end if;
  insert into public.wallets(user_id) values(p_sender) on conflict(user_id) do nothing;
  insert into public.wallets(user_id) values(p_recipient) on conflict(user_id) do nothing;
  perform user_id from public.wallets where user_id in (p_sender,p_recipient) order by user_id for update;
  select coin_balance into sender_balance from public.wallets where user_id=p_sender;
  if sender_balance<g.coin_price then raise exception 'INSUFFICIENT_COINS'; end if;
  select diamond_balance into recipient_diamonds from public.wallets where user_id=p_recipient;
  update public.wallets set coin_balance=coin_balance-g.coin_price,lifetime_gifts_sent=lifetime_gifts_sent+1,updated_at=now() where user_id=p_sender;
  insert into public.coin_ledger(user_id,amount,balance_before,balance_after,source,provider,reference,reason,idempotency_key)
    values(p_sender,-g.coin_price,sender_balance,sender_balance-g.coin_price,'gift_sent',null,g.id::text,g.name,'gift-send:'||p_idempotency_key);
  insert into public.gift_transactions(gift_id,sender_id,recipient_id,live_id,coin_cost,diamond_value,idempotency_key)
    values(g.id,p_sender,p_recipient,p_live,g.coin_price,g.diamond_value,p_idempotency_key) returning * into tx;
  update public.wallets set diamond_balance=diamond_balance+g.diamond_value,updated_at=now() where user_id=p_recipient;
  insert into public.diamond_ledger(user_id,amount,balance_before,balance_after,source,reference,idempotency_key)
    values(p_recipient,g.diamond_value,recipient_diamonds,recipient_diamonds+g.diamond_value,'gift_received',tx.id::text,'gift-received:'||tx.id::text);
  return tx;
end; $$;

-- Atomic multi-gift sends. All entries commit together or none are charged.
create or replace function public.send_gift_combo(p_sender uuid,p_recipient uuid,p_gift uuid,p_live uuid,p_idempotency_key text,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare idx integer; tx public.gift_transactions; result_rows jsonb := '[]'::jsonb;
begin
  if p_quantity is null or p_quantity < 2 or p_quantity > 10 then raise exception 'INVALID_GIFT_QUANTITY'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(p_idempotency_key)>180 then raise exception 'GIFT_IDEMPOTENCY_REQUIRED'; end if;
  for idx in 1..p_quantity loop
    tx := public.send_gift(p_sender,p_recipient,p_gift,p_live,p_idempotency_key||':'||idx::text);
    result_rows := result_rows || jsonb_build_array(to_jsonb(tx));
  end loop;
  return result_rows;
end; $$;

-- LIVE room roles, viewer presence, and counted interactions.
create table if not exists public.live_room_moderators (live_id uuid not null references public.live_sessions(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, assigned_by uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now(), primary key(live_id,user_id));
create table if not exists public.live_viewer_presence (live_id uuid not null references public.live_sessions(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, joined_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), primary key(live_id,user_id));
create table if not exists public.live_interaction_events (id uuid primary key default gen_random_uuid(), live_id uuid not null references public.live_sessions(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, kind text not null check(kind in ('tap','share')), created_at timestamptz not null default now());
create index if not exists live_interactions_rate_idx on public.live_interaction_events(live_id,user_id,kind,created_at desc);
create table if not exists public.live_interaction_totals (live_id uuid not null references public.live_sessions(id) on delete cascade, kind text not null check(kind in ('tap','share')), total bigint not null default 0 check(total>=0), updated_at timestamptz not null default now(), primary key(live_id,kind));

create or replace function public.record_live_interaction(p_live uuid,p_user uuid,p_kind text)
returns public.live_interaction_totals language plpgsql security definer set search_path=public as $$
declare n int; outrow public.live_interaction_totals; room_status text;
begin
  if p_kind not in ('tap','share') then raise exception 'INVALID_INTERACTION_KIND'; end if;
  select status into room_status from public.live_sessions where id=p_live;
  if room_status is distinct from 'live' then raise exception 'LIVE_NOT_ACTIVE'; end if;
  if p_kind='tap' then
    select count(*) into n from public.live_interaction_events where live_id=p_live and user_id=p_user and kind='tap' and created_at>now()-interval '1 second';
    if n>=10 then raise exception 'INTERACTION_RATE_LIMITED'; end if;
  end if;
  insert into public.live_interaction_events(live_id,user_id,kind) values(p_live,p_user,p_kind);
  insert into public.live_interaction_totals(live_id,kind,total,updated_at) values(p_live,p_kind,1,now())
    on conflict(live_id,kind) do update set total=public.live_interaction_totals.total+1,updated_at=now() returning * into outrow;
  return outrow;
end; $$;

-- Serialize guest-cap checks and allocate non-conflicting visible guest slots.
create or replace function public.enforce_guest_cap() returns trigger language plpgsql security definer set search_path=public as $$
declare active_guests int; cap int; free_slot int;
begin
  if new.status='accepted' then
    select max_guests into cap from public.live_sessions where id=new.live_id for update;
    if cap is null then raise exception 'LIVE_ROOM_NOT_FOUND'; end if;
    select count(*) into active_guests from public.live_guests where live_id=new.live_id and status='accepted' and id<>new.id;
    if active_guests>=cap then raise exception 'GUEST_CAP_REACHED'; end if;
    if new.slot is null or exists(select 1 from public.live_guests g where g.live_id=new.live_id and g.status='accepted' and g.slot=new.slot and g.id<>new.id) then
      select min(slot_number) into free_slot from generate_series(1,cap) as slots(slot_number)
      where not exists(select 1 from public.live_guests g where g.live_id=new.live_id and g.status='accepted' and g.slot=slots.slot_number);
      if free_slot is null then raise exception 'GUEST_CAP_REACHED'; end if;
      new.slot:=free_slot;
    end if;
  else
    new.slot:=null;
  end if;
  return new;
end; $$;
-- Existing accepted guests may share a slot from earlier releases; normalize before
-- enforcing unique accepted seats. Historical guest rows and invitation states remain.
with ranked as (
  select id, row_number() over(partition by live_id order by joined_at nulls last, id) as seat
  from public.live_guests where status='accepted'
)
update public.live_guests g set slot=r.seat from ranked r where g.id=r.id and g.slot is distinct from r.seat;
create unique index if not exists live_guests_unique_accepted_slot on public.live_guests(live_id,slot) where status='accepted' and slot is not null;

alter table public.gift_transaction_reversals enable row level security;
alter table public.gifter_progress enable row level security;
alter table public.gifter_level_thresholds enable row level security;
alter table public.gifter_achievement_definitions enable row level security;
alter table public.live_room_moderators enable row level security;
alter table public.live_viewer_presence enable row level security;
alter table public.live_interaction_events enable row level security;
alter table public.live_interaction_totals enable row level security;
drop policy if exists gifter_thresholds_public_read on public.gifter_level_thresholds;
create policy gifter_thresholds_public_read on public.gifter_level_thresholds for select to anon,authenticated using (true);
drop policy if exists gifter_achievements_public_read on public.gifter_achievement_definitions;
create policy gifter_achievements_public_read on public.gifter_achievement_definitions for select to anon,authenticated using (true);
revoke all on public.gift_transaction_reversals, public.gifter_progress, public.live_room_moderators, public.live_viewer_presence, public.live_interaction_events, public.live_interaction_totals from anon,authenticated;
grant select on public.gifter_level_thresholds,public.gifter_achievement_definitions to anon,authenticated;
revoke all on function public.recalculate_gifter_progress(uuid) from public,anon,authenticated;
grant execute on function public.recalculate_gifter_progress(uuid) to service_role;
revoke all on function public.send_gift(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.send_gift(uuid,uuid,uuid,uuid,text) to service_role;
revoke all on function public.send_gift_combo(uuid,uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.send_gift_combo(uuid,uuid,uuid,uuid,text,integer) to service_role;
revoke all on function public.record_live_interaction(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.record_live_interaction(uuid,uuid,text) to service_role;

-- Protect system-managed privilege/progression fields from owner self-editing.
revoke insert, update on table public.profiles from anon,authenticated;
grant update (username,display_name,bio,avatar_url,cover_url,country,language,links,creator_category,is_creator,privacy,updated_at) on table public.profiles to authenticated;

-- Backfill actual historical gifts only; never seed user transactions or fake progress.
do $$ declare p record; begin for p in select id from public.profiles loop perform public.recalculate_gifter_progress(p.id); end loop; end $$;
