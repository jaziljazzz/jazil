-- Background jobs (Supabase pg_cron). Times are UTC; Dubai is UTC+4.
create extension if not exists pg_cron;

select cron.schedule('aventus-time-rules', '*/15 * * * *', $$select public.run_time_rules()$$);
select cron.schedule('aventus-morning-summary', '0 5 * * *', $$select public.morning_summary()$$);   -- 9 AM Dubai
select cron.schedule('aventus-evening-summary', '0 15 * * *', $$select public.evening_summary()$$);  -- 7 PM Dubai
