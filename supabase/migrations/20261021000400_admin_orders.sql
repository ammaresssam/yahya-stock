-- ============================================================
--  Stage 3: the owner manages orders.
--
--  Orders still can't be edited directly (no UPDATE grant, see Stage 2).
--  All changes go through admin_set_order_status(), which:
--   • requires is_admin()
--   • allows only valid next steps
--   • returns the pieces to stock when an order is cancelled — exactly once
--   • records who changed what in order_status_history
--   • never marks a CARD order as paid (that only comes from the verified
--     payment notification in Stage 4). For cash on delivery, "delivered"
--     means the courier collected the cash, so the payment is recorded then.
-- ============================================================

create or replace function public.order_next_statuses(p_status text, p_method text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'placed'          then array['confirmed', 'cancelled']
    when 'confirmed'       then array['preparing', 'cancelled']
    when 'preparing'       then array['shipped', 'cancelled']
    -- a shipped order can still come back (refused at the door) → cancelled, stock returned
    when 'shipped'         then array['delivered', 'cancelled']
    -- an unpaid card order may be cancelled by the owner; it is never confirmed by hand
    when 'pending_payment' then array['cancelled']
    else array[]::text[]   -- delivered, cancelled, payment_failed are final
  end
$$;

create or replace function public.admin_set_order_status(
  p_order_id uuid,
  p_status text,
  p_expected_status text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o         public.orders%rowtype;
  v_note    text := nullif(trim(coalesce(p_note, '')), '');
  v_pay     text;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_note is not null and length(v_note) > 500 then
    return jsonb_build_object('ok', false, 'error', 'note_too_long');
  end if;

  -- lock the order so two people can't change it at the same moment
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- someone else changed it since the owner opened it
  if p_expected_status is not null and o.status <> p_expected_status then
    return jsonb_build_object('ok', false, 'error', 'status_changed', 'status', o.status);
  end if;

  if not (p_status = any (public.order_next_statuses(o.status, o.payment_method))) then
    return jsonb_build_object('ok', false, 'error', 'invalid_transition', 'status', o.status,
      'allowed', to_jsonb(public.order_next_statuses(o.status, o.payment_method)));
  end if;

  v_pay := o.payment_status;

  if p_status = 'cancelled' then
    -- return the reserved pieces to stock, once (sizes deleted since are skipped)
    if not o.stock_released then
      update public.product_variants v
      set stock_qty = v.stock_qty + i.qty
      from public.order_items i
      where i.order_id = o.id and i.variant_id = v.id;
    end if;
    -- a card payment that was taken must be refunded through the payment provider (Stage 4);
    -- here we only stop treating an unpaid one as pending
    if v_pay = 'pending' then v_pay := 'failed'; end if;
  elsif p_status = 'delivered' and o.payment_method = 'cod' then
    v_pay := 'paid'; -- cash collected on delivery
  end if;

  update public.orders
  set status = p_status,
      payment_status = v_pay,
      stock_released = stock_released or p_status = 'cancelled'
  where id = o.id;

  insert into public.order_status_history (order_id, from_status, to_status, note, changed_by)
  values (o.id, o.status, p_status,
          coalesce(v_note, case when p_status = 'delivered' and o.payment_method = 'cod' then 'cash collected' end),
          auth.uid());

  return jsonb_build_object('ok', true, 'status', p_status, 'payment_status', v_pay,
    'stock_returned', p_status = 'cancelled' and not o.stock_released);
end;
$$;

revoke all on function public.admin_set_order_status(uuid, text, text, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text, text, text) to authenticated;
revoke all on function public.order_next_statuses(text, text) from public;
grant execute on function public.order_next_statuses(text, text) to anon, authenticated, service_role;
