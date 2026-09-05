-- Match the existing SVS convention checked by authenticated_rpc_authorization.
-- The function still explicitly qualifies public.profiles and auth.uid().
alter function public.lotto_bingo_is_admin() set search_path = public;
