-- Prepares profiles for billing without wiring up a payment provider yet.
-- Everyone defaults to 'free'; stripe_* columns stay null until Stripe is
-- actually integrated (checkout + webhooks come later).

alter table profiles
  add column plan text default 'free' check (plan in ('free', 'pro')),
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text,
  add column subscription_status text;

create index idx_profiles_stripe_customer_id on profiles(stripe_customer_id);