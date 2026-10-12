-- Creator Hub Creator Network — official 18-division tier catalog.
-- Additive/idempotent: updates catalog labels/ranks only; does not move teams or alter results.
-- Apply manually only after confirming migrations 0006 and 0008 are already installed.

begin;

insert into public.leagues(code, tier, rank) values
  ('D5','Bronze III',1),
  ('D4','Bronze II',2),
  ('D3','Bronze I',3),
  ('D2','Silver III',4),
  ('D1','Silver II',5),
  ('C5','Silver I',6),
  ('C4','Gold IV',7),
  ('C3','Gold III',8),
  ('C2','Gold II',9),
  ('C1','Gold I',10),
  ('B5','Platinum IV',11),
  ('B4','Platinum III',12),
  ('B3','Platinum II',13),
  ('B2','Platinum I',14),
  ('B1','Diamond IV',15),
  ('A3','Heroic',16),
  ('A2','Master',17),
  ('A1','Grandmaster',18)
on conflict (code) do update set tier=excluded.tier, rank=excluded.rank;

-- Legacy code A is retained for referential compatibility but is not an official division.
update public.leagues set tier='Legacy (not a competitive division)', rank=0 where code='A';

commit;
