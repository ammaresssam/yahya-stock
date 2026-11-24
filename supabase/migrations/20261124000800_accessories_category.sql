-- ============================================================
--  Accessories section (إكسسوارات)
--  Adds a 4th starting section next to Men / Women / Kids.
--  Safe to run more than once.
-- ============================================================
insert into public.categories (id, name_ar, name_en, art_type, art_color, art_bg) values
  ('accessories', 'إكسسوارات', 'Accessories', 'bag', '#8a6f55', '#efe8df')
on conflict (id) do nothing;
