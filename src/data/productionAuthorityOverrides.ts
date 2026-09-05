import type { Ishod, Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type CommandOverrides = Partial<Pick<
  Izvor,
  | 'objaviPotrebu'
>>;

function rpcFailure<T>(error: any, fallbackCode: string, fallbackMessage: string): Ishod<T> {
  return {
    ok: false,
    kod: error?.message || error?.code || fallbackCode,
    poruka: error?.message || fallbackMessage,
  };
}

export const productionAuthorityOverrides: CommandOverrides = {
  async objaviPotrebu(razgovorId) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { ok: false, kod: 'AUTH_REQUIRED', poruka: 'Prijavite se pre objave Potrebe.' };
    }

    const { data: requesterProfile, error: profileError } = await supabase
      .from('app_profiles')
      .select('id')
      .eq('account_id', userData.user.id)
      .eq('kind', 'REQUESTER')
      .maybeSingle();
    if (profileError || !requesterProfile) {
      return rpcFailure(profileError, 'REQUESTER_PROFILE_REQUIRED', 'Potreban je profil Naručioca pre objave.');
    }

    const { data, error } = await supabase.rpc('rpc_ai_publish_need', {
      p_conversation_id: razgovorId,
      p_profile_id: requesterProfile.id,
    });
    if (error) return rpcFailure(error, 'AI_PUBLISH_BLOCKED', 'Objava još nije dozvoljena.');
    return { ok: true, podatak: { potrebaId: data } };
  },
};
