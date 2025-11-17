-- ------------------------------------------------------------------
-- Analytics Materialized Views
-- ------------------------------------------------------------------
-- Pre-aggregated analytics for performance

create extension if not exists "pgcrypto";

-- Daily summary materialized view
create materialized view if not exists public.analytics_daily_summary as
select 
  date_trunc('day', created_at) as date,
  count(*) filter (where status = 'paid') as orders_count,
  sum(total_amount) filter (where status = 'paid') as revenue,
  count(distinct customer_id) filter (where status = 'paid') as unique_customers,
  count(distinct vendor_id) filter (where status = 'paid') as active_vendors
from public.orders
group by date_trunc('day', created_at);

create unique index if not exists idx_analytics_daily_summary_date 
  on public.analytics_daily_summary(date);

-- Vendor performance materialized view
create materialized view if not exists public.analytics_vendor_performance as
select 
  vp.vendor_id,
  p.vendor_business_name,
  p.email as vendor_email,
  count(distinct o.id) as total_orders,
  sum(o.total_amount) filter (where o.status = 'paid') as total_revenue,
  avg(o.total_amount) filter (where o.status = 'paid') as avg_order_value,
  count(distinct o.customer_id) filter (where o.status = 'paid') as unique_customers,
  count(distinct vp.id) as total_products,
  count(distinct vp.id) filter (where vp.status = 'active') as active_products,
  min(o.created_at) filter (where o.status = 'paid') as first_sale_date,
  max(o.created_at) filter (where o.status = 'paid') as last_sale_date
from public.vendor_products vp
left join public.profiles p on p.id = vp.vendor_id
left join public.order_items oi on oi.product_id = vp.id
left join public.orders o on o.id = oi.order_id
where p.role = 'vendor'
group by vp.vendor_id, p.vendor_business_name, p.email;

create unique index if not exists idx_analytics_vendor_performance_vendor 
  on public.analytics_vendor_performance(vendor_id);

-- Function to refresh materialized views
create or replace function public.refresh_analytics_views()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently public.analytics_daily_summary;
  refresh materialized view concurrently public.analytics_vendor_performance;
end;
$$;

