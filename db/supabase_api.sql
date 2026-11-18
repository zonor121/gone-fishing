-- Source for tools/build_supabase_schema.py; deploy the combined supabase.sql.
BEGIN;
CREATE OR REPLACE FUNCTION public.fishing_api(action text, payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE
 u bigint := (payload->>'uid')::bigint;
 d jsonb := coalesce(payload->'data','{}');
 p player%ROWTYPE; a active_cast%ROWTYPE; f fish%ROWTYPE; b bait%ROWTYPE;
 l location%ROWTYPE; q quest%ROWTYPE; r record;
 n integer; w numeric; price_value integer; kept_value integer; bait_kept boolean;
 trophy_value integer; rod_price integer; next_rod integer; up_price integer; next_level integer;
 now_value double precision := extract(epoch from clock_timestamp());
 today text := to_char(current_timestamp AT TIME ZONE 'UTC','YYYY-MM-DD');
 weather_value text; until_value double precision; codes jsonb := '[]';
 output jsonb; uid_value bigint; total integer; species integer; all_species integer;
BEGIN
 IF action='health' THEN
  PERFORM 1 FROM player LIMIT 1; RETURN '{"ok":true}';
 ELSIF action='login_lookup' THEN
  SELECT jsonb_build_object('uid',id,'username',username,'password_hash',password_hash) INTO output
   FROM "user" WHERE lower(username)=lower(payload->>'username'); RETURN output;
 ELSIF action='register' THEN
  INSERT INTO "user"(username,password_hash) VALUES(payload->>'username',payload->>'password_hash') RETURNING id INTO uid_value;
  INSERT INTO player(user_id) VALUES(uid_value);
  INSERT INTO player_bait SELECT uid_value,id,CASE code WHEN 'worm' THEN 10 ELSE 5 END FROM bait WHERE code IN ('worm','maggot');
  INSERT INTO session(token,user_id,expires_at) VALUES(payload->>'token',uid_value,(payload->>'expires_at')::double precision);
  RETURN jsonb_build_object('uid',uid_value,'username',payload->>'username');
 ELSIF action='session_create' THEN
  DELETE FROM session WHERE expires_at < now_value;
  INSERT INTO session(token,user_id,expires_at) VALUES(payload->>'token',u,(payload->>'expires_at')::double precision); RETURN '{"ok":true}';
 ELSIF action='session_user' THEN
  SELECT jsonb_build_object('uid',x.id,'username',x.username) INTO output FROM session s JOIN "user" x ON x.id=s.user_id
   WHERE s.token=payload->>'token' AND s.expires_at>now_value; RETURN output;
 ELSIF action='session_drop' THEN
  DELETE FROM session WHERE token=payload->>'token'; RETURN '{"ok":true}';
 ELSIF action='config' THEN
  RETURN jsonb_build_object(
   'locations',(SELECT jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'sky',jsonb_build_array(sky_top,sky_bottom),'water',jsonb_build_array(water_top,water_bottom),'current',has_current=1,'forest',has_forest=1) ORDER BY id) FROM location),
   'rods',(SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'rng',max_range,'str',strength,'spd',reel_speed,'price',CASE id WHEN 2 THEN 1200 WHEN 3 THEN 4500 ELSE 0 END) ORDER BY id) FROM rod),
   'baits',(SELECT jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'price',price) ORDER BY price) FROM bait),
   'fish',(SELECT jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'min',min_kg,'max',max_kg,'freq',bite_freq,'res',resistance,'color',color,'price',x.price,'style',fight_style,
     'times',string_to_array(times,','),'weather',string_to_array(weather,','),
     'locs',(SELECT jsonb_agg(l.code ORDER BY l.id) FROM fish_location fl JOIN location l ON l.id=fl.location_id WHERE fl.fish_id=x.id),
     'baits',(SELECT jsonb_object_agg(b.code,fb.bite_weight) FROM fish_bait fb JOIN bait b ON b.id=fb.bait_id WHERE fb.fish_id=x.id)) ORDER BY x.price) FROM fish x),
   'boat_price',10000,'bells_price',200,'min_catch_seconds',12,
   'rod_prices','{"2":1200,"3":4500}'::jsonb,'trophy_chance',0.04,
   'tackle_prices','{"2":600,"3":1500,"4":3000,"5":5500,"6":9000}'::jsonb,'tackle_zones','[0.30,0.26,0.22,0.18,0.14,0.10]'::jsonb,
   'reel_prices','{"2":500,"3":1300,"4":2800,"5":5000,"6":8000}'::jsonb,'reel_recovery','[0.5,0.6,0.7,0.8,0.9,1.0]'::jsonb,
   'world','{"day_parts":[{"code":"morning","name":"Утро"},{"code":"day","name":"День"},{"code":"evening","name":"Вечер"},{"code":"night","name":"Ночь"}],"day_part_seconds":180,"weathers":[{"code":"clear","name":"Ясно"},{"code":"rain","name":"Дождь"},{"code":"fog","name":"Туман"},{"code":"wind","name":"Ветер"}]}'::jsonb);
 END IF;
 -- Every per-player operation takes the same lock, including state/quest generation.
 SELECT * INTO p FROM player WHERE user_id=u FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status',401,'body',jsonb_build_object('ok',false,'error','Требуется вход')); END IF;
 IF action='state' THEN
  SELECT weather,weather_until INTO weather_value,until_value FROM world_state WHERE id=1 FOR UPDATE;
  IF until_value IS NULL OR until_value<=now_value THEN
   w:=random(); weather_value:=CASE WHEN w<.4 THEN 'clear' WHEN w<.65 THEN 'rain' WHEN w<.85 THEN 'fog' ELSE 'wind' END;
   until_value:=now_value+120+floor(random()*121);
   UPDATE world_state SET weather=weather_value,weather_until=until_value WHERE id=1;
  END IF;
  DELETE FROM quest WHERE user_id=u AND day<>today;
  IF NOT EXISTS(SELECT 1 FROM quest WHERE user_id=u AND day=today) THEN
   INSERT INTO quest(user_id,day,kind,target,goal,text,reward_money,reward_bait,reward_bait_qty)
   SELECT u,today,v.* FROM (VALUES
    ('species','1',3,'Поймать 3 карасей',200,'maggot',5),
    ('weight','2.0',1,'Поймать рыбу тяжелее 2 кг',300,'corn',5),
    ('bait','corn',2,'Поймать 2 рыбы на кукурузу',250,'worm',6),
    ('total',NULL,5,'Поймать 5 рыб любого вида',200,'worm',10),
    ('sea',NULL,1,'Поймать рыбу в море',400,'shrimp',5),
    ('bait','spin',1,'Поймать рыбу на блесну',220,'spin',3),
    ('bait','worm',2,'Поймать 2 рыбы на червя',180,'maggot',4)
   ) v(kind,target,goal,text,money,bait,qty) WHERE v.kind<>'sea' OR p.boat_owned=1 ORDER BY random() LIMIT 3;
  END IF;
  RETURN jsonb_build_object('username',(SELECT username FROM "user" WHERE id=u),'money',p.money,'tutorial_done',p.tutorial_done=1,'boat_owned',p.boat_owned=1,'bells_owned',p.bells_owned=1,'rod_level',p.rod_level,'tackle_level',p.tackle_level,'reel_level',p.reel_level,
   'baits',coalesce((SELECT jsonb_object_agg(b.code,pb.qty) FROM player_bait pb JOIN bait b ON b.id=pb.bait_id WHERE pb.user_id=u),'{}'),
   'inventory',coalesce((SELECT jsonb_agg(to_jsonb(x)-'sort_price' ORDER BY sort_price) FROM (SELECT f.name,count(*) n,round(sum(c.weight_kg)::numeric,2) kg,max(c.weight_kg) best,sum(c.price) earned,f.price sort_price FROM catch c JOIN fish f ON f.id=c.fish_id WHERE c.user_id=u AND c.kept=1 GROUP BY f.id) x),'[]'),
   'last',coalesce((SELECT jsonb_agg(to_jsonb(x)-'id' ORDER BY id DESC) FROM (SELECT c.id,f.name fish,l.name location,c.weight_kg weight,c.kept,c.price,c.trophy,c.caught_at FROM catch c JOIN fish f ON f.id=c.fish_id JOIN location l ON l.id=c.location_id WHERE c.user_id=u ORDER BY c.id DESC LIMIT 8) x),'[]'),
   'world',jsonb_build_object('day_part',(ARRAY['morning','day','evening','night'])[mod(floor(now_value/180)::bigint,4)::integer+1],'day_part_left',180-floor(mod(now_value::numeric,180)),'weather',weather_value,'weather_left',greatest(0,floor(until_value-now_value))),
   'quests',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'text',text,'goal',goal,'progress',progress,'claimed',claimed=1,'reward',jsonb_build_object('money',reward_money,'bait',reward_bait,'bait_qty',reward_bait_qty)) ORDER BY id) FROM quest WHERE user_id=u),'[]'),
   'achievements',(SELECT jsonb_agg(jsonb_build_object('code',v.code,'name',v.name,'hint',v.hint,'unlocked_at',a.unlocked_at) ORDER BY v.ord) FROM (VALUES
    (1,'first_catch','Первый улов','Поймать первую рыбу.'),(2,'hundred','100 пойманных рыб','Поймать суммарно 100 рыб.'),(3,'sea_master','Мастер моря','Поймать тунца — самую крупную морскую рыбу.'),(4,'collector','Коллекционер','Поймать все виды рыб в игре.'),(5,'trophy','Трофейщик','Поймать трофейную рыбу.')) v(ord,code,name,hint) LEFT JOIN achievement a ON a.user_id=u AND a.code=v.code),
   'diary',jsonb_build_object('total',(SELECT count(*) FROM catch WHERE user_id=u),
    'heaviest',(SELECT jsonb_build_object('name',f.name,'weight',c.weight_kg,'trophy',c.trophy=1) FROM catch c JOIN fish f ON f.id=c.fish_id WHERE c.user_id=u ORDER BY c.weight_kg DESC,c.id LIMIT 1),
    'species',coalesce((SELECT jsonb_agg(to_jsonb(x)-'sort_price' ORDER BY sort_price) FROM (SELECT f.id,f.name,count(*) n,max(c.weight_kg) best,f.price sort_price FROM catch c JOIN fish f ON f.id=c.fish_id WHERE c.user_id=u GROUP BY f.id) x),'[]'),
    'species_total',(SELECT count(*) FROM fish),'discovered',(SELECT count(DISTINCT fish_id) FROM catch WHERE user_id=u)));
 ELSIF action='leaderboard' THEN
  -- Топ-10: по весу каждого вида (все уловы, лучший на игрока) и по цене одиночной рыбы (kept=1).
  RETURN jsonb_build_object(
   'price',coalesce((SELECT jsonb_agg(jsonb_build_object('username',b.username,'fish',f.name,'weight',b.weight_kg,'price',b.price,'caught_at',b.caught_at,'you',b.user_id=u) ORDER BY b.price DESC,b.id)
    FROM (SELECT b0.*,uu.username,row_number() OVER (ORDER BY b0.price DESC,b0.id) pos FROM (SELECT c.id,c.user_id,c.fish_id,c.weight_kg,c.price,c.caught_at,row_number() OVER (PARTITION BY c.user_id ORDER BY c.price DESC,c.id) rn FROM catch c WHERE c.kept=1 AND c.price>0) b0 JOIN "user" uu ON uu.id=b0.user_id WHERE b0.rn=1) b JOIN fish f ON f.id=b.fish_id WHERE b.pos<=10),'[]'),
   'fish',(SELECT jsonb_agg(jsonb_build_object('id',f.id,'rows',coalesce(g.rows,'[]')) ORDER BY f.price,f.id) FROM fish f LEFT JOIN (
    SELECT b.fish_id,jsonb_agg(jsonb_build_object('username',b.username,'weight',b.weight_kg,'caught_at',b.caught_at,'you',b.user_id=u) ORDER BY b.weight_kg DESC,b.id) rows
    FROM (SELECT b0.*,uu.username,row_number() OVER (PARTITION BY b0.fish_id ORDER BY b0.weight_kg DESC,b0.id) pos FROM (SELECT c.id,c.user_id,c.fish_id,c.weight_kg,c.caught_at,row_number() OVER (PARTITION BY c.fish_id,c.user_id ORDER BY c.weight_kg DESC,c.id) rn FROM catch c) b0 JOIN "user" uu ON uu.id=b0.user_id WHERE b0.rn=1) b
    WHERE b.pos<=10 GROUP BY b.fish_id) g ON g.fish_id=f.id));
 ELSIF action='cast' THEN
  SELECT * INTO l FROM location WHERE code=d->>'location';
  IF NOT FOUND THEN RAISE EXCEPTION 'Неизвестная локация.' USING ERRCODE='P0001'; END IF;
  IF l.code='sea' AND p.boat_owned=0 THEN RETURN '{"status":403,"body":{"ok":false,"error":"Для морской рыбалки необходимо приобрести лодку за 10 000 ₽."}}'; END IF;
  SELECT * INTO b FROM bait WHERE code=d->>'bait';
  IF NOT FOUND THEN RAISE EXCEPTION 'Неизвестная наживка' USING ERRCODE='P0001'; END IF;
  IF NOT EXISTS(SELECT 1 FROM player_bait WHERE user_id=u AND bait_id=b.id AND qty>0) THEN RAISE EXCEPTION 'Наживка закончилась' USING ERRCODE='P0001'; END IF;
  -- блесна расходуется не с каждого заброса: 25% шанс потратить, иначе остаётся в запасе
  bait_kept:=b.code='spin' AND random()>=.25;
  IF NOT bait_kept THEN UPDATE player_bait SET qty=qty-1 WHERE user_id=u AND bait_id=b.id AND qty>0; END IF;
  INSERT INTO active_cast VALUES(u,l.id,b.id,now_value+12) ON CONFLICT(user_id) DO UPDATE SET location_id=excluded.location_id,bait_id=excluded.bait_id,ready_at=excluded.ready_at;
  RETURN jsonb_build_object('status',200,'body',jsonb_build_object('ok',true,'bait_kept',bait_kept));
 ELSIF action='buy' THEN
  n:=coalesce((d->>'qty')::integer,1);
  IF d->>'item'='boat' THEN
   IF p.boat_owned=1 THEN RETURN '{"status":409,"body":{"ok":false,"error":"Лодка уже приобретена"}}'; END IF;
   IF p.money<10000 THEN RAISE EXCEPTION 'Не хватает денег: лодка стоит 10 000 ₽.' USING ERRCODE='P0001'; END IF;
   UPDATE player SET money=money-10000,boat_owned=1 WHERE user_id=u;
  ELSIF d->>'item'='bells' THEN
   IF p.bells_owned=1 THEN RETURN '{"status":409,"body":{"ok":false,"error":"Колокольчики уже приобретены"}}'; END IF;
   IF p.money<200 THEN RAISE EXCEPTION 'Не хватает денег: колокольчики стоят 200 ₽.' USING ERRCODE='P0001'; END IF;
   UPDATE player SET money=money-200,bells_owned=1 WHERE user_id=u;
  ELSIF d->>'item'='rod' THEN
   -- последовательный апгрейд: купить можно только следующую удочку (rod_level+1)
   SELECT max(id) INTO n FROM rod;
   IF p.rod_level>=n THEN RETURN '{"status":409,"body":{"ok":false,"error":"Все удочки уже приобретены"}}'; END IF;
   next_rod:=p.rod_level+1;
   rod_price:=CASE next_rod WHEN 2 THEN 1200 WHEN 3 THEN 4500 ELSE 0 END;
   IF rod_price=0 OR p.money<rod_price THEN RAISE EXCEPTION 'Не хватает денег: удочка стоит % ₽.', rod_price USING ERRCODE='P0001'; END IF;
   UPDATE player SET money=money-rod_price,rod_level=next_rod WHERE user_id=u;
  ELSIF d->>'item'='tackle' THEN
   -- последовательный апгрейд снастей: уровни 1–6, красная зона 30→10%
   IF p.tackle_level>=6 THEN RETURN '{"status":409,"body":{"ok":false,"error":"Все снасти уже приобретены"}}'; END IF;
   next_level:=p.tackle_level+1;
   up_price:=CASE next_level WHEN 2 THEN 600 WHEN 3 THEN 1500 WHEN 4 THEN 3000 WHEN 5 THEN 5500 WHEN 6 THEN 9000 ELSE 0 END;
   IF up_price=0 OR p.money<up_price THEN RAISE EXCEPTION 'Не хватает денег: улучшение (снасти) стоит % ₽.', up_price USING ERRCODE='P0001'; END IF;
   UPDATE player SET money=money-up_price,tackle_level=next_level WHERE user_id=u;
  ELSIF d->>'item'='reel' THEN
   -- последовательный апгрейд катушек: уровни 1–6, спад натяжения 50→100%/с
   IF p.reel_level>=6 THEN RETURN '{"status":409,"body":{"ok":false,"error":"Все катушки уже приобретены"}}'; END IF;
   next_level:=p.reel_level+1;
   up_price:=CASE next_level WHEN 2 THEN 500 WHEN 3 THEN 1300 WHEN 4 THEN 2800 WHEN 5 THEN 5000 WHEN 6 THEN 8000 ELSE 0 END;
   IF up_price=0 OR p.money<up_price THEN RAISE EXCEPTION 'Не хватает денег: улучшение (катушки) стоит % ₽.', up_price USING ERRCODE='P0001'; END IF;
   UPDATE player SET money=money-up_price,reel_level=next_level WHERE user_id=u;
  ELSE
   SELECT * INTO b FROM bait WHERE code=d->>'bait';
   IF b.id IS NULL OR n NOT BETWEEN 1 AND 99 OR p.money<b.price::bigint*n THEN RAISE EXCEPTION 'Не хватает денег' USING ERRCODE='P0001'; END IF;
   UPDATE player SET money=money-b.price*n WHERE user_id=u;
   INSERT INTO player_bait VALUES(u,b.id,n) ON CONFLICT(user_id,bait_id) DO UPDATE SET qty=player_bait.qty+excluded.qty;
  END IF;
 ELSIF action='catch' THEN
  SELECT * INTO a FROM active_cast WHERE user_id=u;
  SELECT * INTO f FROM fish WHERE id=(d->>'fish_id')::integer;
  SELECT * INTO l FROM location WHERE code=d->>'location';
  IF a.user_id IS NULL OR f.id IS NULL OR l.id IS NULL OR a.location_id<>l.id OR now_value<a.ready_at OR (l.code='sea' AND p.boat_owned=0)
   OR NOT EXISTS(SELECT 1 FROM fish_location WHERE fish_id=f.id AND location_id=l.id)
   OR NOT EXISTS(SELECT 1 FROM fish_bait WHERE fish_id=f.id AND bait_id=a.bait_id) THEN
   RAISE EXCEPTION 'Улов не соответствует забросу или рыбалка ещё не завершена.' USING ERRCODE='P0001'; END IF;
  w:=(d->>'weight')::numeric;
  trophy_value:=CASE WHEN coalesce((d->>'trophy')::boolean,false) THEN 1 ELSE 0 END;
  -- трофей — единственный легальный вес выше max_kg (до ×1.5), цена ×2
  IF w IS NULL OR NOT(w BETWEEN (CASE WHEN trophy_value=1 THEN f.max_kg ELSE f.min_kg END)-.01
   AND (CASE WHEN trophy_value=1 THEN f.max_kg*1.5 ELSE f.max_kg END)+.01) THEN RAISE EXCEPTION 'Недопустимый вес улова.' USING ERRCODE='P0001'; END IF;
  kept_value:=CASE WHEN coalesce((d->>'kept')::boolean,false) THEN 1 ELSE 0 END;
  -- награда зависит от веса: 0.75× базовой цены при min_kg, 1.75× при max_kg (линейно, округление вверх)
  price_value:=CASE WHEN kept_value=1 THEN
   floor(f.price*(CASE WHEN f.max_kg>f.min_kg THEN .75+(least(greatest(w,f.min_kg),f.max_kg)-f.min_kg)/(f.max_kg-f.min_kg) ELSE 1.0 END)+.5)::integer*(CASE WHEN trophy_value=1 THEN 2 ELSE 1 END) ELSE 0 END;
  INSERT INTO catch(user_id,fish_id,location_id,weight_kg,kept,price,bait_id,trophy) VALUES(u,f.id,l.id,round(w,2),kept_value,price_value,a.bait_id,trophy_value);
  DELETE FROM active_cast WHERE user_id=u;
  UPDATE player SET money=money+price_value WHERE user_id=u;
  UPDATE quest SET progress=progress+1 WHERE user_id=u AND day=today AND claimed=0 AND
   (kind='total' OR (kind='species' AND target=f.id::text) OR (CASE WHEN kind='weight' THEN w>=target::numeric ELSE false END)
    OR (kind='sea' AND l.code='sea') OR (kind='bait' AND target=(SELECT code FROM bait WHERE id=a.bait_id)));
  SELECT count(*),count(DISTINCT fish_id) INTO total,species FROM catch WHERE user_id=u;
  SELECT count(*) INTO all_species FROM fish;
  FOR r IN SELECT v.code FROM (VALUES('first_catch',total>=1),('hundred',total>=100),('sea_master',EXISTS(SELECT 1 FROM catch WHERE user_id=u AND fish_id=10)),('collector',species>=all_species),('trophy',EXISTS(SELECT 1 FROM catch WHERE user_id=u AND trophy=1))) v(code,earned) WHERE earned LOOP
   INSERT INTO achievement VALUES(u,r.code,to_char(current_timestamp AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) ON CONFLICT DO NOTHING;
   IF FOUND THEN codes:=codes||jsonb_build_array(r.code); END IF;
  END LOOP;
  RETURN jsonb_build_object('status',200,'body',jsonb_build_object('ok',true,'price',price_value,'new_achievements',codes));
 ELSIF action='quest_claim' THEN
  SELECT * INTO q FROM quest WHERE id=(d->>'id')::bigint AND user_id=u AND day=today;
  IF q.id IS NULL OR q.claimed=1 OR q.progress<q.goal THEN RAISE EXCEPTION 'Задание ещё не выполнено' USING ERRCODE='P0001'; END IF;
  UPDATE quest SET claimed=1 WHERE id=q.id;
  UPDATE player SET money=money+q.reward_money WHERE user_id=u;
  INSERT INTO player_bait SELECT u,id,q.reward_bait_qty FROM bait WHERE code=q.reward_bait ON CONFLICT(user_id,bait_id) DO UPDATE SET qty=player_bait.qty+excluded.qty;
  RETURN jsonb_build_object('status',200,'body',jsonb_build_object('ok',true,'money',q.reward_money,'bait',q.reward_bait,'bait_qty',q.reward_bait_qty));
 ELSIF action='tutorial' THEN
  UPDATE player SET tutorial_done=CASE WHEN coalesce((d->>'done')::boolean,false) THEN 1 ELSE 0 END WHERE user_id=u;
 ELSE RAISE EXCEPTION 'Unknown action';
 END IF;
 RETURN '{"status":200,"body":{"ok":true}}';
EXCEPTION
 WHEN unique_violation THEN
  IF action='register' THEN RETURN '{"error":"Такой логин уже занят."}'; END IF;
  RAISE;
 WHEN SQLSTATE 'P0001' THEN RETURN jsonb_build_object('status',400,'body',jsonb_build_object('ok',false,'error',SQLERRM));
 WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN '{"status":400,"body":{"ok":false,"error":"Некорректный запрос"}}';
END;
$$;
REVOKE ALL ON FUNCTION public.fishing_api(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fishing_api(text,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
