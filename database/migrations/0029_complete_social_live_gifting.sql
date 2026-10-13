-- Creator Hub Creator Network 0029: complete social/LIVE gifting coverage.
-- Manual only: back up Supabase first. Preflight fails closed if any approved gift row is missing or duplicated.
begin;
do $$ begin
  if to_regclass('public.profiles') is null or to_regclass('public.gifts') is null or to_regclass('public.live_sessions') is null or to_regclass('public.live_guests') is null or to_regclass('public.messages') is null or to_regclass('public.conversation_members') is null then
    raise exception '0029 prerequisites missing; reconcile migrations before applying.';
  end if;
end $$;

alter table public.gifts add column if not exists emoji text;
alter table public.gifts add column if not exists sort_order integer;
alter table public.gifts add column if not exists asset_key text;
alter table public.messages add column if not exists edited_at timestamptz;
create index if not exists gifts_active_catalogue_order_idx on public.gifts(active,sort_order,coin_price);

create temporary table chcn_approved_gift_update (
  sort_order integer primary key,
  name text not null unique,
  coin_price bigint not null check (coin_price between 1 and 1000000),
  category text not null,
  emoji text not null,
  asset_key text not null unique
) on commit drop;
insert into chcn_approved_gift_update(sort_order,name,coin_price,category,emoji,asset_key) values
(1,'Single Rose',1,'EVERYDAY GIFTS','🌹','single-rose'),
(2,'Heart',1,'EVERYDAY GIFTS','❤️','heart'),
(3,'Shining Star',1,'EVERYDAY GIFTS','⭐','shining-star'),
(4,'Applause',1,'EVERYDAY GIFTS','👏','applause'),
(5,'Ice Cream',1,'EVERYDAY GIFTS','🍦','ice-cream'),
(6,'Finger Heart',5,'EVERYDAY GIFTS','🫰','finger-heart'),
(7,'Panda',5,'EVERYDAY GIFTS','🐼','panda'),
(8,'Kiss',5,'EVERYDAY GIFTS','💋','kiss'),
(9,'Pink Tulip',10,'EVERYDAY GIFTS','🌷','pink-tulip'),
(10,'Coffee',10,'EVERYDAY GIFTS','☕','coffee'),
(11,'Balloon',10,'EVERYDAY GIFTS','🎈','balloon'),
(12,'Bravo',15,'EVERYDAY GIFTS','👏✨','bravo'),
(13,'Flower Bouquet',20,'EVERYDAY GIFTS','💐','flower-bouquet'),
(14,'Swan',20,'EVERYDAY GIFTS','🦢','swan'),
(15,'Doughnut',30,'EVERYDAY GIFTS','🍩','doughnut'),
(16,'Teddy Bear',30,'EVERYDAY GIFTS','🧸','teddy-bear'),
(17,'Birthday Cake',50,'EVERYDAY GIFTS','🎂','birthday-cake'),
(18,'Sunflower',50,'EVERYDAY GIFTS','🌻','sunflower'),
(19,'Love Letter',75,'EVERYDAY GIFTS','💌','love-letter'),
(20,'Stylish Cap',99,'EVERYDAY GIFTS','🧢','stylish-cap'),
(21,'Hand Hearts',100,'SUPPORTER GIFTS','🫶','hand-hearts'),
(22,'Confetti Celebration',100,'SUPPORTER GIFTS','🎊','confetti-celebration'),
(23,'Crystal Gem',150,'SUPPORTER GIFTS','💎','crystal-gem'),
(24,'Cool Sunglasses',199,'SUPPORTER GIFTS','🕶️','cool-sunglasses'),
(25,'Celebration Toast',250,'SUPPORTER GIFTS','🥂','celebration-toast'),
(26,'Corgi',299,'SUPPORTER GIFTS','🐶','corgi'),
(27,'Grand Rose Bouquet',300,'SUPPORTER GIFTS','🌹💐','grand-rose-bouquet'),
(28,'Premium Headphones',350,'SUPPORTER GIFTS','🎧','premium-headphones'),
(29,'Butterfly Wings',399,'SUPPORTER GIFTS','🦋','butterfly-wings'),
(30,'Coral Treasure',499,'SUPPORTER GIFTS','🪸','coral-treasure'),
(31,'Money Gun',500,'PREMIUM GIFTS','💸','money-gun'),
(32,'Golden Microphone',550,'PREMIUM GIFTS','🎤','golden-microphone'),
(33,'Drum Performance',600,'PREMIUM GIFTS','🥁','drum-performance'),
(34,'Dance Spotlight',650,'PREMIUM GIFTS','💃','dance-spotlight'),
(35,'Silver Trophy',700,'PREMIUM GIFTS','🏆','silver-trophy'),
(36,'Gaming Champion',750,'PREMIUM GIFTS','🎮','gaming-champion'),
(37,'Royal Peacock',800,'PREMIUM GIFTS','🦚','royal-peacock'),
(38,'Celebration Fireworks',850,'PREMIUM GIFTS','🎆','celebration-fireworks'),
(39,'Ocean Dolphin',900,'PREMIUM GIFTS','🐬','ocean-dolphin'),
(40,'Royal Crown',999,'PREMIUM GIFTS','👑','royal-crown'),
(41,'Galaxy',1000,'ELITE GIFTS','🌌','galaxy'),
(42,'Royal Peacock Show',1200,'ELITE GIFTS','🦚✨','royal-peacock-show'),
(43,'Dream Wedding',1500,'ELITE GIFTS','💒','dream-wedding'),
(44,'Shooting Stars',1800,'ELITE GIFTS','🌠','shooting-stars'),
(45,'Ocean Whale',2000,'ELITE GIFTS','🐋','ocean-whale'),
(46,'Sunset of Love',2200,'ELITE GIFTS','💖🌅','sunset-of-love'),
(47,'Super Motorcycle',2500,'ELITE GIFTS','🏍️','super-motorcycle'),
(48,'Party Bus',2800,'ELITE GIFTS','🚌','party-bus'),
(49,'Meteor Shower',3000,'ELITE GIFTS','☄️','meteor-shower'),
(50,'Rockstar Concert',3500,'ELITE GIFTS','🎸','rockstar-concert'),
(51,'Golden Dragon',4000,'ELITE GIFTS','🐉','golden-dragon'),
(52,'Private Jet',4888,'ELITE GIFTS','✈️','private-jet'),
(53,'Hero Spaceship',5000,'LEGENDARY GIFTS','🚀','hero-spaceship'),
(54,'Superstar Performance',6000,'LEGENDARY GIFTS','🎭','superstar-performance'),
(55,'Luxury Sports Car',7000,'LEGENDARY GIFTS','🏎️','luxury-sports-car'),
(56,'Golden Eagle',8000,'LEGENDARY GIFTS','🦅','golden-eagle'),
(57,'Volcanic Explosion',9000,'LEGENDARY GIFTS','🌋','volcanic-explosion'),
(58,'Interstellar Journey',10000,'LEGENDARY GIFTS','🌠🌌','interstellar-journey'),
(59,'Global Superstar',12000,'LEGENDARY GIFTS','🎤🌟','global-superstar'),
(60,'Planetary Kingdom',15000,'LEGENDARY GIFTS','🪐','planetary-kingdom'),
(61,'Royal Castle',18000,'LEGENDARY GIFTS','🏰','royal-castle'),
(62,'Creator Hub Shuttle',20000,'CHAMPION AND LEAGUE GIFTS','🛸','creator-hub-shuttle'),
(63,'Diamond Lion',22000,'CHAMPION AND LEAGUE GIFTS','🦁','diamond-lion'),
(64,'Legendary Phoenix',25000,'CHAMPION AND LEAGUE GIFTS','🔥🐦','legendary-phoenix'),
(65,'League Champion',30000,'CHAMPION AND LEAGUE GIFTS','🏆👑','league-champion'),
(66,'World of Wonders',35000,'CHAMPION AND LEAGUE GIFTS','🌍✨','world-of-wonders'),
(67,'Dragon Emperor',40000,'CHAMPION AND LEAGUE GIFTS','🐉👑','dragon-emperor'),
(68,'Cosmic Empire',45000,'CHAMPION AND LEAGUE GIFTS','🌌👑','cosmic-empire'),
(69,'Diamond Kingdom',49999,'CHAMPION AND LEAGUE GIFTS','💎🏰','diamond-kingdom'),
(70,'Inferno Lion',50000,'MYTHICAL AND ULTIMATE GIFTS','🦁🔥','inferno-lion'),
(71,'Cosmic Supernova',75000,'MYTHICAL AND ULTIMATE GIFTS','🌠🚀','cosmic-supernova'),
(72,'Emperor''s Lion',100000,'MYTHICAL AND ULTIMATE GIFTS','👑🦁','emperors-lion'),
(73,'Diamond Planet',150000,'MYTHICAL AND ULTIMATE GIFTS','🌎💎','diamond-planet'),
(74,'Galactic Dragon',200000,'MYTHICAL AND ULTIMATE GIFTS','🐉🌌','galactic-dragon'),
(75,'Imperial Palace',250000,'MYTHICAL AND ULTIMATE GIFTS','🏰👑','imperial-palace'),
(76,'Infinite Galaxy',300000,'MYTHICAL AND ULTIMATE GIFTS','🌌💫','infinite-galaxy'),
(77,'Celestial Phoenix',400000,'MYTHICAL AND ULTIMATE GIFTS','🦅⚡','celestial-phoenix'),
(78,'World Emperor',500000,'MYTHICAL AND ULTIMATE GIFTS','🌍👑','world-emperor'),
(79,'Eternal Diamond Universe',750000,'MYTHICAL AND ULTIMATE GIFTS','💎🌌','eternal-diamond-universe'),
(80,'Creator Hub Ultimate Universe',1000000,'MYTHICAL AND ULTIMATE GIFTS','👑🌌🔥','creator-hub-ultimate-universe'),
(81,'Yard Certified',50,'YARD TINGZ 🇯🇲','🇯🇲','yard-certified'),
(82,'Pretty Like Yard',100,'YARD TINGZ 🇯🇲','🌺','pretty-like-yard'),
(83,'Beat A Di Yard',250,'YARD TINGZ 🇯🇲','🥁🇯🇲','beat-a-di-yard'),
(84,'Road Ready',500,'YARD TINGZ 🇯🇲','🎭','road-ready'),
(85,'Island Life',1000,'YARD TINGZ 🇯🇲','🌴🌅','island-life'),
(86,'Born Fi Run',2500,'YARD TINGZ 🇯🇲','🏃🇯🇲','born-fi-run'),
(87,'Cricket Boss',5000,'YARD TINGZ 🇯🇲','🏏🏆','cricket-boss'),
(88,'Parish Don',10000,'YARD TINGZ 🇯🇲','⚽🇯🇲','parish-don'),
(89,'Yard Champion',25000,'YARD TINGZ 🇯🇲','🏆🇯🇲','yard-champion'),
(90,'Caribbean Don',50000,'YARD TINGZ 🇯🇲','🌎🇯🇲','caribbean-don');
do $$ declare matched_count integer; missing_names text; begin
  if (select count(*) from chcn_approved_gift_update) <> 90 then raise exception '0029 approved catalogue must contain exactly 90 gifts'; end if;
  select count(*) into matched_count from chcn_approved_gift_update c
  where (select count(*) from public.gifts g where lower(btrim(g.name))=lower(btrim(c.name)))=1;
  if matched_count <> 90 then
    select string_agg(c.name, ', ' order by c.sort_order) into missing_names from chcn_approved_gift_update c
    where (select count(*) from public.gifts g where lower(btrim(g.name))=lower(btrim(c.name)))<>1;
    raise exception '0029 gift preflight failed (expected exactly one existing row for all 90 approved gifts): %', coalesce(missing_names,'unknown');
  end if;
end $$;
update public.gifts g set coin_price=c.coin_price, category=c.category, emoji=c.emoji, sort_order=c.sort_order, asset_key=c.asset_key
from chcn_approved_gift_update c where lower(btrim(g.name))=lower(btrim(c.name));

-- Guest requests are separate from the existing invited/accepted guest-seat lifecycle.
create table if not exists public.live_room_guest_requests (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.live_sessions(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(live_id,requester_id)
);
create index if not exists live_room_guest_requests_pending_idx on public.live_room_guest_requests(live_id,created_at desc) where status='pending';
alter table public.live_room_guest_requests enable row level security;
revoke all on public.live_room_guest_requests from anon,authenticated;
grant all on public.live_room_guest_requests to service_role;

-- Per-person conversation tools: remove from my view without destroying recipients' history.
create table if not exists public.message_hidden_for (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key(message_id,user_id)
);
alter table public.message_hidden_for enable row level security;
drop policy if exists message_hidden_read_own on public.message_hidden_for;
create policy message_hidden_read_own on public.message_hidden_for for select to authenticated using (user_id=auth.uid() and public.chcn_my_account_active());
drop policy if exists message_hidden_insert_own on public.message_hidden_for;
create policy message_hidden_insert_own on public.message_hidden_for for insert to authenticated with check (user_id=auth.uid() and public.chcn_my_account_active() and exists(select 1 from public.messages m join public.conversation_members cm on cm.conversation_id=m.conversation_id where m.id=message_hidden_for.message_id and cm.user_id=auth.uid()));
drop policy if exists message_hidden_delete_own on public.message_hidden_for;
create policy message_hidden_delete_own on public.message_hidden_for for delete to authenticated using (user_id=auth.uid() and public.chcn_my_account_active());
grant select,insert,delete on public.message_hidden_for to authenticated;

create table if not exists public.conversation_user_settings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  muted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,conversation_id)
);
alter table public.conversation_user_settings enable row level security;
drop policy if exists conversation_settings_select_own on public.conversation_user_settings;
create policy conversation_settings_select_own on public.conversation_user_settings for select to authenticated using (user_id=auth.uid() and public.chcn_my_account_active() and exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_user_settings.conversation_id and cm.user_id=auth.uid()));
drop policy if exists conversation_settings_write_own on public.conversation_user_settings;
create policy conversation_settings_write_own on public.conversation_user_settings for all to authenticated using (user_id=auth.uid() and public.chcn_my_account_active() and exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_user_settings.conversation_id and cm.user_id=auth.uid())) with check (user_id=auth.uid() and public.chcn_my_account_active() and exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_user_settings.conversation_id and cm.user_id=auth.uid()));
grant select,insert,update,delete on public.conversation_user_settings to authenticated;

-- Leave/remove self from a conversation only; existing member/author policies remain in force.
drop policy if exists convmem_delete_self on public.conversation_members;
create policy convmem_delete_self on public.conversation_members for delete to authenticated using (user_id=auth.uid() and public.chcn_my_account_active());
grant delete on public.conversation_members to authenticated;

-- Column-level grants re-enable edits only to the sender; existing messages_update RLS restricts rows to sender+member.
grant update(body,unsent,edited_at) on public.messages to authenticated;
create or replace function public.chcn_guard_message_edits() returns trigger language plpgsql set search_path=public as $$
begin
  if auth.uid() is not null and old.sender_id<>auth.uid() then raise exception 'MESSAGE_OWNER_REQUIRED'; end if;
  if new.id is distinct from old.id or new.conversation_id is distinct from old.conversation_id or new.sender_id is distinct from old.sender_id or new.kind is distinct from old.kind or new.media is distinct from old.media or new.reply_to is distinct from old.reply_to or new.created_at is distinct from old.created_at then
    raise exception 'MESSAGE_IMMUTABLE_FIELDS';
  end if;
  if old.unsent and not new.unsent then raise exception 'MESSAGE_ALREADY_UNSENT'; end if;
  if new.body is distinct from old.body and new.unsent is not true and old.created_at < now()-interval '15 minutes' then raise exception 'MESSAGE_EDIT_WINDOW_EXPIRED'; end if;
  if new.body is distinct from old.body or new.unsent is distinct from old.unsent then new.edited_at=now(); else new.edited_at=old.edited_at; end if;
  if new.unsent then new.body=null; end if;
  return new;
end $$;
drop trigger if exists chcn_guard_message_edits on public.messages;
create trigger chcn_guard_message_edits before update on public.messages for each row execute function public.chcn_guard_message_edits();

notify pgrst,'reload schema';
commit;
