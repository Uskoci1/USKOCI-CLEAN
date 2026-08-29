-- Supabase ima ALTER DEFAULT PRIVILEGES koji EKSPLICITNO dodeljuje EXECUTE
-- roli authenticated na svaku novu funkciju u schemi public. Zato revoke od
-- PUBLIC nije dovoljan — mora i imenovano od authenticated.
--
-- Ove dve su interni pomocnici i ne smeju da se zovu preko REST-a:
--   fn_is_party            inace bi se moglo ispitivati clanstvo tudjih Dogovora
--   fn_need_covered_slots  interni pomocnik izbora
--
-- Autoritativni rpc_* ostaju dostupni prijavljenom korisniku namerno.

revoke execute on function public.fn_is_party(uuid, uuid) from authenticated;
revoke execute on function public.fn_need_covered_slots(uuid) from authenticated;
