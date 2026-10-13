-- CHL gift catalogue pricing correction — exact approved 90-gift list.
-- Manual installation only. Run the complete file in the intended Supabase SQL Editor.
-- Updates coin_price and category only; preserves gift IDs, diamond_value, artwork,
-- active flags and transaction history. Actual send_gift RPC reads public.gifts.coin_price.
-- The transaction aborts before any update if a catalogue name is missing or duplicated.

begin;

create temporary table chl_gift_catalogue_update (
  name text primary key,
  coin_price integer not null check (coin_price between 1 and 100000),
  category text not null
) on commit drop;

insert into chl_gift_catalogue_update (name, coin_price, category) values
  ('Applause', 1, 'EVERYDAY GIFTS'),
  ('Heart', 1, 'EVERYDAY GIFTS'),
  ('Ice Cream', 2, 'EVERYDAY GIFTS'),
  ('Shining Star', 3, 'EVERYDAY GIFTS'),
  ('Single Rose', 5, 'EVERYDAY GIFTS'),
  ('Finger Heart', 5, 'EVERYDAY GIFTS'),
  ('Kiss', 7, 'EVERYDAY GIFTS'),
  ('Panda', 9, 'EVERYDAY GIFTS'),
  ('Balloon', 10, 'EVERYDAY GIFTS'),
  ('Coffee', 10, 'EVERYDAY GIFTS'),
  ('Pink Tulip', 15, 'EVERYDAY GIFTS'),
  ('Bravo', 15, 'EVERYDAY GIFTS'),
  ('Flower Bouquet', 20, 'EVERYDAY GIFTS'),
  ('Swan', 25, 'EVERYDAY GIFTS'),
  ('Doughnut', 30, 'EVERYDAY GIFTS'),
  ('Teddy Bear', 35, 'EVERYDAY GIFTS'),
  ('Birthday Cake', 40, 'EVERYDAY GIFTS'),
  ('Sunflower', 45, 'EVERYDAY GIFTS'),
  ('Yard Certified', 50, 'YARD TINGZ 🇯🇲'),
  ('Love Letter', 75, 'EVERYDAY GIFTS'),
  ('Stylish Cap', 99, 'EVERYDAY GIFTS'),
  ('Confetti Celebration', 100, 'SUPPORTER GIFTS'),
  ('Hand Hearts', 100, 'SUPPORTER GIFTS'),
  ('Pretty Like Yard', 125, 'YARD TINGZ 🇯🇲'),
  ('Crystal Gem', 150, 'SUPPORTER GIFTS'),
  ('Cool Sunglasses', 199, 'SUPPORTER GIFTS'),
  ('Beat A Di Yard', 225, 'YARD TINGZ 🇯🇲'),
  ('Celebration Toast', 250, 'SUPPORTER GIFTS'),
  ('Corgi', 299, 'SUPPORTER GIFTS'),
  ('Grand Rose Bouquet', 300, 'SUPPORTER GIFTS'),
  ('Premium Headphones', 350, 'SUPPORTER GIFTS'),
  ('Butterfly Wings', 399, 'SUPPORTER GIFTS'),
  ('Coral Treasure', 450, 'SUPPORTER GIFTS'),
  ('Money Gun', 500, 'PREMIUM GIFTS'),
  ('Road Ready', 500, 'YARD TINGZ 🇯🇲'),
  ('Golden Microphone', 550, 'PREMIUM GIFTS'),
  ('Drum Performance', 600, 'PREMIUM GIFTS'),
  ('Dance Spotlight', 650, 'PREMIUM GIFTS'),
  ('Silver Trophy', 700, 'PREMIUM GIFTS'),
  ('Gaming Champion', 750, 'PREMIUM GIFTS'),
  ('Royal Peacock', 800, 'PREMIUM GIFTS'),
  ('Celebration Fireworks', 850, 'PREMIUM GIFTS'),
  ('Ocean Dolphin', 900, 'PREMIUM GIFTS'),
  ('Royal Crown', 999, 'PREMIUM GIFTS'),
  ('Galaxy', 1000, 'ELITE GIFTS'),
  ('Island Life', 1200, 'YARD TINGZ 🇯🇲'),
  ('Royal Peacock Show', 1500, 'ELITE GIFTS'),
  ('Dream Wedding', 1800, 'ELITE GIFTS'),
  ('Shooting Stars', 2000, 'ELITE GIFTS'),
  ('Ocean Whale', 2200, 'ELITE GIFTS'),
  ('Sunset of Love', 2500, 'ELITE GIFTS'),
  ('Born Fi Run', 2800, 'YARD TINGZ 🇯🇲'),
  ('Super Motorcycle', 3000, 'ELITE GIFTS'),
  ('Party Bus', 3500, 'ELITE GIFTS'),
  ('Meteor Shower', 4000, 'ELITE GIFTS'),
  ('Rockstar Concert', 4500, 'ELITE GIFTS'),
  ('Golden Dragon', 5000, 'ELITE GIFTS'),
  ('Private Jet', 5500, 'ELITE GIFTS'),
  ('Cricket Boss', 6000, 'YARD TINGZ 🇯🇲'),
  ('Hero Spaceship', 7000, 'LEGENDARY GIFTS'),
  ('Superstar Performance', 8000, 'LEGENDARY GIFTS'),
  ('Luxury Sports Car', 9000, 'LEGENDARY GIFTS'),
  ('Golden Eagle', 10000, 'LEGENDARY GIFTS'),
  ('Volcanic Explosion', 12000, 'LEGENDARY GIFTS'),
  ('Interstellar Journey', 15000, 'LEGENDARY GIFTS'),
  ('Parish Don', 18000, 'YARD TINGZ 🇯🇲'),
  ('Global Superstar', 20000, 'LEGENDARY GIFTS'),
  ('Planetary Kingdom', 22000, 'LEGENDARY GIFTS'),
  ('Royal Castle', 25000, 'LEGENDARY GIFTS'),
  ('Creator Hub Shuttle', 28000, 'CHAMPION & LEAGUE GIFTS'),
  ('Diamond Lion', 30000, 'CHAMPION & LEAGUE GIFTS'),
  ('Legendary Phoenix', 35000, 'CHAMPION & LEAGUE GIFTS'),
  ('Yard Champion', 35000, 'YARD TINGZ 🇯🇲'),
  ('League Champion', 40000, 'CHAMPION & LEAGUE GIFTS'),
  ('World of Wonders', 45000, 'CHAMPION & LEAGUE GIFTS'),
  ('Dragon Emperor', 49999, 'CHAMPION & LEAGUE GIFTS'),
  ('Cosmic Empire', 50000, 'CHAMPION & LEAGUE GIFTS'),
  ('Diamond Kingdom', 55000, 'CHAMPION & LEAGUE GIFTS'),
  ('Caribbean Don', 60000, 'YARD TINGZ 🇯🇲'),
  ('Inferno Lion', 65000, 'MYTHICAL & ULTIMATE GIFTS'),
  ('Cosmic Supernova', 70000, 'MYTHICAL & ULTIMATE GIFTS'),
  ('Emperor''s Lion', 75000, 'MYTHICAL & ULTIMATE GIFTS'),
  ('Diamond Planet', 80000, 'MYTHICAL & ULTIMATE GIFTS'),
  ('Galactic Dragon', 85000, 'MYTHICAL & ULTIMATE GIFTS'),
  ('Imperial Palace', 90000, 'MYTHICAL & ULTIMATE GIFTS'),
  ('Infinite Galaxy', 92000, 'MYTHICAL & ULTIMATE GIFTS'),
  ('Celestial Phoenix', 94000, 'MYTHICAL & ULTIMATE GIFTS'),
  ('World Emperor', 96000, 'MYTHICAL & ULTIMATE GIFTS'),
  ('Eternal Diamond Universe', 98000, 'MYTHICAL & ULTIMATE GIFTS'),
  ('Creator Hub Ultimate Universe', 100000, 'MYTHICAL & ULTIMATE GIFTS');

do $$
declare
  matched_count integer;
  unmatched_names text;
begin
  select count(*) into matched_count
  from chl_gift_catalogue_update c
  where (select count(*) from public.gifts g where lower(btrim(g.name)) = lower(btrim(c.name))) = 1;

  if matched_count <> 90 then
    select string_agg(c.name, ', ' order by c.name) into unmatched_names
    from chl_gift_catalogue_update c
    where (select count(*) from public.gifts g where lower(btrim(g.name)) = lower(btrim(c.name))) <> 1;
    raise exception 'CHL_GIFT_CATALOGUE_PREFLIGHT_FAILED: expected 90 unique existing gift rows; missing or duplicated names: %', coalesce(unmatched_names, '(unknown)');
  end if;
end $$;

update public.gifts g
set coin_price = c.coin_price,
    category = c.category
from chl_gift_catalogue_update c
where lower(btrim(g.name)) = lower(btrim(c.name));

-- In the same SQL Editor session, after the migration succeeds, verify the full catalogue:
-- select name, coin_price, category, active from public.gifts
-- order by coin_price asc, name asc;

commit;
