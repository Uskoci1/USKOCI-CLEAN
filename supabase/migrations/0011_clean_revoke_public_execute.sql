-- Ispravka migracije 01.
--
-- Funkcije u Postgresu podrazumevano imaju GRANT EXECUTE TO PUBLIC.
-- Oduzimanje od anon/authenticated ne pomaze dok PUBLIC grant stoji —
-- obe role ga nasledjuju. Mora se oduzeti od PUBLIC.
--
-- Ovo pogadja tri funkcije koje niko ne sme da zove direktno preko REST-a:
--   rls_auto_enable        administrativna, poziva je event trigger
--   fn_is_party            inace bi se moglo ispitivati clanstvo tudjih Dogovora
--   fn_need_covered_slots  interni pomocnik izbora

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.fn_is_party(uuid, uuid) from public;
revoke execute on function public.fn_need_covered_slots(uuid) from public;

-- Autoritativni RPC-evi ostaju namerno dostupni prijavljenom korisniku:
-- svaki od njih sam proverava auth.uid() i vlasnistvo. To je ceo smisao
-- security definer obrasca — klijent ne dodiruje tabele direktno.
-- Jedini izuzetak je serverski tick, koji nema grant nikome.
revoke execute on function public.rpc_tick_auto_completion() from public;
