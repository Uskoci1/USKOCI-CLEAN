import base64
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import json
from verify_final_build_config import (PUBLIC_NAMES, RECOVERY, URL, parse_public_config, scan_values,
                                       assert_recovery_function, read_hermes)

def token(role='anon', ref='leqcwgzvjsxugfgzdmth'):
    encode=lambda data:base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip('=')
    return encode({'alg':'HS256'})+'.'+encode({'role':role,'ref':ref})+'.SYNTHETIC'

def config(**changes):
    values={'EXPO_PUBLIC_SUPABASE_URL':URL,'EXPO_PUBLIC_SUPABASE_ANON_KEY':token(),
            'EXPO_PUBLIC_USE_FAKE_SOURCE':'0','EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL':RECOVERY}
    values.update(changes)
    return '\n'.join(k+'='+v for k,v in values.items())

class FinalConfigTests(unittest.TestCase):
    def test_exact_four_native_public_values(self):
        self.assertEqual(set(parse_public_config(config())),PUBLIC_NAMES)

    def test_old_three_are_admitted_only_by_explicit_prepare_extension(self):
        old='\n'.join(line for line in config().splitlines() if not line.startswith('EXPO_PUBLIC_AUTH_RECOVERY'))
        with self.assertRaisesRegex(ValueError,'EXACT_FOUR'):parse_public_config(old)
        self.assertEqual(parse_public_config(old,add_recovery=True)['EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL'],RECOVERY)

    def test_no_alternative_redirect_or_fake_target(self):
        for changes in [{'EXPO_PUBLIC_SUPABASE_URL':'https://other.supabase.co'},
                        {'EXPO_PUBLIC_USE_FAKE_SOURCE':'1'},
                        {'EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL':'uskociapp://oporavak/'},
                        {'EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL':'uskociapp://oporavak?next=other'}]:
            with self.subTest(changes=changes),self.assertRaises(ValueError):parse_public_config(config(**changes),add_recovery=True)

    def test_unexpected_duplicate_or_private_config_rejected(self):
        for extra in ['EXPO_PUBLIC_NEW_SECRET=synthetic','SUPABASE_SERVICE_ROLE_KEY=synthetic',
                      'EXPO_PUBLIC_USE_FAKE_SOURCE=0','MALFORMED']:
            with self.subTest(name=extra.split('=')[0]),self.assertRaises(ValueError):parse_public_config(config()+'\n'+extra)

    def test_anon_role_ref_and_literal_value_required(self):
        for value in [token('service_role'),token(ref='other'),'sb_publishable_Synthetic','${KEY}']:
            with self.assertRaises(ValueError):parse_public_config(config(EXPO_PUBLIC_SUPABASE_ANON_KEY=value))

    def test_real_string_boundaries_do_not_join_sdk_prefix_and_icon_names(self):
        self.assertEqual(scan_values(['sb_secret_','mask-sad','floppy-disk-back','asterisk-simple'],token(),set()),[])

    def test_service_provider_and_unknown_google_material_rejected(self):
        for value in [token('service_role'),'sb_secret_'+'SYNTHETIC'*5,'sk-proj-'+'SYNTHETIC'*5,
                      'AIza'+'SYNTHETIC'*5,'-----BEGIN PRIVATE KEY-----\nSYNTHETIC\n-----END PRIVATE KEY-----']:
            with self.assertRaises(ValueError):scan_values([value],token(),set())

    def test_only_exact_public_keys_allowed(self):
        key='AIza'+'SYNTHETIC'*5
        self.assertEqual(scan_values([token(),key],token(),{key}),[{'role':'anon','ref':'leqcwgzvjsxugfgzdmth'}])
        with self.assertRaises(ValueError):scan_values([token(ref='other')],token(),set())

    def test_compiled_disabled_or_runtime_recovery_rejected(self):
        disabled='Function<configuredRecoveryRedirect>(1 params):\n LoadConstNull r0\n Ret r0\n'
        enabled=f'Function<configuredRecoveryRedirect>(1 params):\n LoadConstString r0, "{RECOVERY}"\n Ret r0\n'
        assert_recovery_function([enabled])
        for blocks in [[],[disabled],[enabled,enabled],[enabled+' EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL\n']]:
            with self.assertRaises(ValueError):assert_recovery_function(blocks)

    def test_decoded_hermes_table_must_be_complete_and_unique(self):
        class Process:
            def __init__(self,text):self.stdout=io.StringIO(text)
            def wait(self,**kwargs):return 0
            def kill(self):pass
        base=('  String count: 2\nGlobal String Table:\n'
              'i0[ASCII, 0..-1] #00000000: \n'+f's1[ASCII, 4..1000]: {token()}\n\n'
              f'Function<configuredRecoveryRedirect>(1 params):\n LoadConstString r0, "{RECOVERY}"\n Ret r0\n')
        with tempfile.TemporaryDirectory() as directory:
            exe=Path(directory)/'disassembler';exe.write_bytes(b'SYNTHETIC_TOOL_BYTES')
            with patch('verify_final_build_config.subprocess.Popen',return_value=Process(base)):
                self.assertEqual(read_hermes(exe,'unused',token(),set())['decodedStringEntriesScanned'],2)
            for bad in [base.replace('String count: 2','String count: 3'),base.replace('s1[','s0['),base.replace('0..-1','0..-2')]:
                with patch('verify_final_build_config.subprocess.Popen',return_value=Process(bad)),self.assertRaises(ValueError):
                    read_hermes(exe,'unused',token(),set())

    def test_collector_preserves_strict_base_and_only_declared_adaptations(self):
        here=Path(__file__).resolve().parent
        spec=importlib.util.spec_from_file_location('final_collector',here/'collect-v5-final-apk.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        source=(here/'collect-v5-6d8f640-apk.py').read_bytes()
        body=module.render_collector(source,'v5-final-abcdef1')
        compile(body,'rendered-final','exec')
        for text in ['verify_composed_source_map(snapshot','certificate == [receipt','Both bounded native ABIs',
                     'source_pixels.tobytes()','attest_final_apk_configuration(snapshot, apk, receipt)']:
            self.assertIn(text,body)
        self.assertNotIn('USKOCI-V5-AI-FIRST-6d8f640.apk',body)
        with self.assertRaises(ValueError):module.render_collector(source+b'\n','v5-final-abcdef1')
        with self.assertRaises(ValueError):module.render_collector(source,'../override')

if __name__=='__main__':unittest.main()
