-- Counters per person and month. They use the status the user should see (`effective_status`), so
-- a forgotten past meal counts as an automatic "not picked up" and "pending" only holds today and
-- future meals. The five counters always add up to `scheduled_total` (RULE-015).

create view public.monthly_stats with (security_invoker = true) as
select
  s.*,
  (s.picked_up + s.cancelled + s.not_picked_up + s.permission + s.pending = s.scheduled_total) as is_consistent
from (
  select
    p.id as monthly_plan_id,
    p.person_id,
    p.household_id,
    p.month,
    p.contracted_count,
    p.is_partial,
    p.needs_review,
    count(m.id)::int as scheduled_total,
    (count(*) filter (where m.effective_status = 'picked_up'))::int as picked_up,
    (count(*) filter (where m.effective_status = 'cancelled'))::int as cancelled,
    (count(*) filter (where m.effective_status = 'not_picked_up'))::int as not_picked_up,
    (count(*) filter (where m.is_automatic))::int as automatic_not_picked_up,
    (count(*) filter (where m.effective_status = 'permission'))::int as permission,
    (count(*) filter (where m.effective_status = 'scheduled'))::int as pending,
    (count(ph.id))::int as photos
  from public.monthly_plans p
  left join public.meals_numbered m on m.monthly_plan_id = p.id
  left join public.meal_photos ph on ph.meal_id = m.id
  group by p.id
) s;
