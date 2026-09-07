-- USD plans mirror the existing Razorpay AI Education Premium plans for international schools.
-- INR packages and their GST-inclusive amounts remain unchanged.
insert into public.ai_education_premium_package_catalog
  (code,label,grades,monthly_price_inr,annual_price_inr,currency,active,featured,sort_order,gst_rate,gst_inclusive,group_kind)
values
 ('classes_1_2_usd','Classes 1–2',array['1','2'],25,250,'usd',true,false,110,0,false,'group'),
 ('classes_3_5_usd','Classes 3–5',array['3','4','5'],35,350,'usd',true,false,120,0,false,'group'),
 ('classes_6_8_usd','Classes 6–8',array['6','7','8'],45,450,'usd',true,false,130,0,false,'group'),
 ('classes_9_10_usd','Classes 9–10',array['9','10'],55,550,'usd',true,false,140,0,false,'group'),
 ('classes_11_12_usd','Classes 11–12',array['11','12'],65,650,'usd',true,false,150,0,false,'group'),
 ('classes_1_5_usd','Classes 1–5',array['1','2','3','4','5'],55,550,'usd',true,false,160,0,false,'school'),
 ('classes_1_8_usd','Classes 1–8',array['1','2','3','4','5','6','7','8'],75,750,'usd',true,false,170,0,false,'school'),
 ('classes_1_10_usd','Classes 1–10',array['1','2','3','4','5','6','7','8','9','10'],95,950,'usd',true,false,180,0,false,'school'),
 ('classes_1_12_usd','Complete School AI Education · Classes 1–12',array['1','2','3','4','5','6','7','8','9','10','11','12'],125,1250,'usd',true,true,190,0,false,'school')
on conflict (code) do update set
 label=excluded.label,grades=excluded.grades,monthly_price_inr=excluded.monthly_price_inr,
 annual_price_inr=excluded.annual_price_inr,currency=excluded.currency,active=true,
 featured=excluded.featured,sort_order=excluded.sort_order,gst_rate=0,gst_inclusive=false,
 group_kind=excluded.group_kind,updated_at=now();
