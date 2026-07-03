-- Clarify subscription pricing and commission policy.
-- Listed INR subscription prices are before GST. GST is charged separately.
-- Partner commission is 10% of the pre-GST subscription amount.

do $$
begin
  if to_regclass('public.subscriptions') is not null then
    alter table public.subscriptions
      add column if not exists gst_rate numeric(5,2) not null default 18.00,
      add column if not exists gst_charged_separately boolean not null default true;

    comment on column public.subscriptions.gst_rate is
      'GST percentage charged separately over the listed subscription price.';
    comment on column public.subscriptions.gst_charged_separately is
      'True means the displayed subscription price is pre-GST and GST is added separately.';
  end if;

  if to_regclass('public.acquisition_attributions') is not null then
    alter table public.acquisition_attributions
      add column if not exists gst_rate numeric(5,2) not null default 18.00,
      add column if not exists gst_charged_separately boolean not null default true;

    comment on column public.acquisition_attributions.gst_rate is
      'GST percentage charged separately over the listed subscription price.';
    comment on column public.acquisition_attributions.gst_charged_separately is
      'True means commission is calculated on the listed pre-GST subscription amount.';
  end if;
end $$;
