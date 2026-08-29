-- 01 — bezbednosno stezanje zatečenog stanja
--
-- Supabase advisor: public.rls_auto_enable() je SECURITY DEFINER i izvršiva
-- od strane anon preko /rest/v1/rpc/. Nijedna administrativna funkcija ne sme
-- da bude dostupna neprijavljenom korisniku.
--
-- Reverzibilno: grant se može vratiti.

revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
