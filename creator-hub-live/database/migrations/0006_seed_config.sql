-- =====================================================================
-- Creator Hub Live \u2014 0006 configuration seed (NOT fake users/content)
-- This seeds ONLY platform configuration rows: leagues, coin packages, and a
-- starter gift catalog. It creates ZERO fake users, posts, followers, viewers,
-- or balances. Safe to run in production.
-- =====================================================================

-- Leagues: A, A1-A3, B1-B5, C1-C5, D1-D5 (D5 lowest).
insert into public.leagues(code,tier,rank) values
  ('A','A',1),('A1','A',2),('A2','A',3),('A3','A',4),
  ('B1','B',5),('B2','B',6),('B3','B',7),('B4','B',8),('B5','B',9),
  ('C1','C',10),('C2','C',11),('C3','C',12),('C4','C',13),('C5','C',14),
  ('D1','D',15),('D2','D',16),('D3','D',17),('D4','D',18),('D5','D',19)
on conflict (code) do nothing;

-- Coin packages (admin-configurable; prices are examples in USD).
insert into public.coin_packages(coins,price,currency,sort) values
  (100,0.99,'USD',1),(500,4.99,'USD',2),(1000,9.99,'USD',3),
  (2500,24.99,'USD',4),(5000,49.99,'USD',5),(10000,99.99,'USD',6)
on conflict do nothing;

-- Starter gift catalog. graphic_url/animation_url left null \u2014 drop ORIGINAL
-- or properly licensed assets into the 'gifts' storage bucket and set URLs.
insert into public.gifts(name,category,coin_price,diamond_value,rarity) values
  ('Spark','regular',1,1,'regular'),
  ('Heart','regular',5,3,'regular'),
  ('Rocket','premium',100,60,'premium'),
  ('Crown','exclusive',500,320,'exclusive'),
  ('Galaxy','luxury',5000,3400,'luxury'),
  ('Team Flag','team',50,30,'team'),
  ('Match Fire','match',20,12,'match'),
  ('Season Star','seasonal',200,130,'seasonal')
on conflict do nothing;
