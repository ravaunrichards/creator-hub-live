# CHL Gift Coin Pricing Update — Manual Installation

## Scope

This update corrects the prices of all 90 named gifts to the supplied catalogue, with prices from 1 through 100,000 coins. The full list is in `APPROVED-GIFT-PRICE-REFERENCE.txt`.

## Before running

1. Back up the database and current deployed website/backend.
2. Open the existing Creator Hub Supabase project and confirm its project reference is `txibryhznycmuqufnxvh`.
3. Open SQL Editor and create a new query.
4. Open `database/migrations/0025_chl_gift_catalogue_pricing.sql`, copy the entire file and paste it into SQL Editor.
5. Run the complete script. It creates a temporary catalogue, verifies all 90 names map to exactly one row, and aborts before the update if any are missing/duplicated. Do not remove this safety guard.

## Verify every gift

After successful execution, run this separate read-only query:

```sql
SELECT name, coin_price, category, active
FROM public.gifts
ORDER BY coin_price ASC, name ASC;
```

Compare all 90 rows to `APPROVED-GIFT-PRICE-REFERENCE.txt`. To verify the maximum and count:

```sql
SELECT count(*) AS total_gifts, min(coin_price) AS lowest_price, max(coin_price) AS highest_price
FROM public.gifts
WHERE lower(btrim(name)) IN (
  SELECT lower(btrim(name)) FROM chl_gift_catalogue_update
);
```

Note: the temporary table is dropped at commit, so use the first query for post-commit verification. For a post-commit 90-gift count and price range, use this query instead:

```sql
SELECT count(*) AS total_gifts, min(coin_price) AS lowest_price, max(coin_price) AS highest_price
FROM public.gifts
WHERE lower(btrim(name)) IN (
  'applause','heart','ice cream','shining star','single rose','finger heart','kiss','panda','balloon','coffee','pink tulip','bravo','flower bouquet','swan','doughnut','teddy bear','birthday cake','sunflower','yard certified','love letter','stylish cap','confetti celebration','hand hearts','pretty like yard','crystal gem','cool sunglasses','beat a di yard','celebration toast','corgi','grand rose bouquet','premium headphones','butterfly wings','coral treasure','money gun','road ready','golden microphone','drum performance','dance spotlight','silver trophy','gaming champion','royal peacock','celebration fireworks','ocean dolphin','royal crown','galaxy','island life','royal peacock show','dream wedding','shooting stars','ocean whale','sunset of love','born fi run','super motorcycle','party bus','meteor shower','rockstar concert','golden dragon','private jet','cricket boss','hero spaceship','superstar performance','luxury sports car','golden eagle','volcanic explosion','interstellar journey','parish don','global superstar','planetary kingdom','royal castle','creator hub shuttle','diamond lion','legendary phoenix','yard champion','league champion','world of wonders','dragon emperor','cosmic empire','diamond kingdom','caribbean don','inferno lion','cosmic supernova','emperor''s lion','diamond planet','galactic dragon','imperial palace','infinite galaxy','celestial phoenix','world emperor','eternal diamond universe','creator hub ultimate universe'
);
```

Expected count: 90. Expected minimum: 1. Expected maximum: 100000.

## Coin deduction and website

The supplied Release 4.0.0 backend `GET /api/gifts` reads `coin_price` from `public.gifts` and sorts by price then name. The frontend also sorts the returned database records. The supplied database `send_gift` function debits `g.coin_price`. Confirm your live versions match before replacing files. If the displayed price updates but the debit does not, stop sending gifts and inspect the live `send_gift` function and deployment.

## Important

This ZIP is for manual installation. It has not been applied to GitHub, Supabase, or the live website. If the SQL fails, send the exact error and do not remove the preflight check.
