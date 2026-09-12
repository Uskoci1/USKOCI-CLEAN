"""Pure bounded dependency-contract tests; never install or mutate source files."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('dependency_contract', Path(__file__).with_name('validate-approved-dependencies.py'))
contract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contract)


def fixture():
    package = {'name': 'synthetic-fixture', 'dependencies': {'existing': '1.0.0'}, 'devDependencies': {'test': '2.0.0'}}
    lock = {'lockfileVersion': 3, 'packages': {'': copy.deepcopy(package), 'node_modules/existing': {'version': '1.0.0'}}}
    baseline = {'package.json': package, 'package-lock.json': lock}
    approved = copy.deepcopy(baseline)
    approved['package.json'] = contract.with_additions(package)
    approved['package-lock.json']['packages'][''] = contract.with_additions(lock['packages'][''])
    approved['package-lock.json']['packages'].update({name: {'version': version, 'resolved': 'https://registry.npmjs.org/synthetic.tgz', 'integrity': 'sha512-YWJjZA=='} for name, version in contract.LOCK_ADDITIONS.items()})
    return baseline, approved


class DependencyContractTests(unittest.TestCase):
    def test_only_exact_three_root_additions_and_one_transitive_are_admitted(self):
        contract.validate_delta(*fixture())

    def test_rejects_unrelated_root_or_script_changes(self):
        for mutate in [lambda p: p['dependencies'].update(unapproved='1'), lambda p: p.update(scripts={'android': 'different'})]:
            baseline, approved = fixture(); mutate(approved['package.json'])
            with self.assertRaisesRegex(AssertionError, 'UNEXPECTED_PACKAGE_DELTA'):
                contract.validate_delta(baseline, approved)

    def test_rejects_existing_lock_record_change_or_removal(self):
        for remove in [False, True]:
            baseline, approved = fixture(); records = approved['package-lock.json']['packages']
            if remove:
                records.pop('node_modules/existing')
            else:
                records['node_modules/existing']['version'] = '2.0.0'
            with self.assertRaisesRegex(AssertionError, 'HISTORICAL_LOCK_RECORD_'):
                contract.validate_delta(baseline, approved)

    def test_rejects_extra_missing_or_changed_new_dependency(self):
        for mutate in [lambda p: p.update({'node_modules/extra': {}}), lambda p: p.pop('node_modules/expo-image-loader'), lambda p: p['node_modules/expo-image-loader'].update(version='other')]:
            baseline, approved = fixture(); mutate(approved['package-lock.json']['packages'])
            with self.assertRaises(AssertionError):
                contract.validate_delta(baseline, approved)

    def test_rejects_lock_metadata_or_integrity_change(self):
        for mutate in [lambda p: p.update(lockfileVersion=99), lambda p: p['packages']['node_modules/expo-image-loader'].update(integrity='')]:
            baseline, approved = fixture(); mutate(approved['package-lock.json'])
            with self.assertRaises(AssertionError):
                contract.validate_delta(baseline, approved)

    def test_post_install_working_and_source_bytes_must_equal_exact_approved_objects(self):
        approved = {path: b'exact committed bytes\n' for path in contract.FILES}
        contract.validate_exact_files(approved, approved, approved)
        changed = {**approved, 'package-lock.json': b'different bytes\n'}
        with self.assertRaisesRegex(AssertionError, 'INSTALLED_WORKTREE_DIFFERS_FROM_SOURCE'):
            contract.validate_exact_files(changed, approved, approved)
        with self.assertRaisesRegex(AssertionError, 'SOURCE_DEPENDENCIES_NOT_APPROVED'):
            contract.validate_exact_files(changed, changed, approved)


if __name__ == '__main__':
    unittest.main()
