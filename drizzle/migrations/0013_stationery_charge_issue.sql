ALTER TABLE public.student_charges ADD COLUMN stationery_items jsonb;
COMMENT ON COLUMN public.student_charges.stationery_items IS 'Item breakdown for new stationery issues only; legacy charges remain unchanged.';
CREATE OR REPLACE FUNCTION public.issue_stationery(_id uuid, _student_id uuid, _session_id uuid, _items jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE cat uuid; total numeric := 0; item jsonb; qty numeric; price numeric; description text := 'Stationery Issue:'; existing public.student_charges%ROWTYPE;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
 SELECT * INTO existing FROM public.student_charges WHERE id = _id;
 IF FOUND THEN
  IF existing.student_id = _student_id AND existing.session_id = _session_id AND existing.stationery_items = _items THEN RETURN _id; END IF;
  RAISE EXCEPTION 'Issue identifier already used';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.student_sessions WHERE student_id=_student_id AND session_id=_session_id) THEN RAISE EXCEPTION 'Student is not enrolled in selected session'; END IF;
 IF jsonb_typeof(_items) IS DISTINCT FROM 'array' OR jsonb_array_length(_items) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Enter 1 to 50 items'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(_items) LOOP
  qty := (item->>'quantity')::numeric; price := (item->>'price')::numeric;
  IF coalesce(length(btrim(item->>'name')),0) NOT BETWEEN 1 AND 100 OR qty IS NULL OR qty <= 0 OR qty > 100000 OR qty <> trunc(qty) OR price IS NULL OR price < 0 OR price > 10000000 OR price <> round(price,2) THEN RAISE EXCEPTION 'Invalid item quantity or price'; END IF;
  total := total + qty * price;
  description := description || E'\n' || btrim(item->>'name') || ' × ' || qty || ' @ ₹' || price || ' = ₹' || (qty*price);
 END LOOP;
 IF total <= 0 THEN RAISE EXCEPTION 'Grand total must be greater than zero'; END IF;
 INSERT INTO public.fee_categories(name) VALUES ('Stationery Charges') ON CONFLICT(name) DO NOTHING;
 SELECT id INTO cat FROM public.fee_categories WHERE name='Stationery Charges' AND is_active;
 IF cat IS NULL THEN RAISE EXCEPTION 'Activate Stationery Charges in fee categories first'; END IF;
 INSERT INTO public.student_charges(id,student_id,session_id,category_id,amount,remarks,stationery_items,created_by) VALUES(_id,_student_id,_session_id,cat,total,description || E'\nTotal = ₹' || total,_items,auth.uid()) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO existing FROM public.student_charges WHERE id=_id;
 IF existing.student_id IS DISTINCT FROM _student_id OR existing.session_id IS DISTINCT FROM _session_id OR existing.stationery_items IS DISTINCT FROM _items THEN RAISE EXCEPTION 'Issue identifier already used'; END IF;
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.issue_stationery(uuid,uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_stationery(uuid,uuid,uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.protect_stationery_issue() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.stationery_items IS NOT NULL THEN RAISE EXCEPTION 'Issued stationery charges are locked; no silent changes or deletion allowed'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER protect_stationery_issue BEFORE UPDATE OR DELETE ON public.student_charges FOR EACH ROW WHEN (OLD.stationery_items IS NOT NULL) EXECUTE FUNCTION public.protect_stationery_issue();