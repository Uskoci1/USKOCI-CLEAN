"""SPOJ Entry signature prelude on the existing disposable Android/Auth fixture.

Only real signed-out UI actions are issued. Recording ends before credentials.
Direct execution runs this prelude only; the historical intent-shell importer
can still call prove_spoj_entry() before its separately scoped full journey.
"""


def entry_signature_checkpoints():
    return (
        'ENTRY_welcome', 'ENTRY_requester_before', 'ENTRY_requester_auth',
        'ENTRY_worker_before', 'ENTRY_worker_auth', 'ENTRY_login',
        'ENTRY_empty_error', 'ENTRY_recovery_surface', 'ENTRY_registration',
        'ENTRY_back_to_welcome', 'ENTRY_reduced_motion_welcome',
        'ENTRY_reduced_requester_auth', 'ENTRY_reduced_worker_auth',
    )


def assert_entry_welcome():
    root = assert_signed_out_surface()
    parent = {child: item for item in root.iter() for child in item}
    for label in ('Meni treba', 'Ja mogu', 'Prijavi se'):
        nodes = [node for node in root.iter() if node.attrib.get('content-desc') == label]
        if len(nodes) != 1 or clickable_for(nodes[0], parent) is None:
            raise AssertionError('Entry welcome is missing an enabled exact intent/Auth control')
    return root


def assert_entry_password_form():
    # Reuse the actual helper's strict two-field signed-out form assertion.
    root = assert_signed_out_surface(form_open=True)
    fields = [node for node in root.iter() if node.attrib.get('class') == 'android.widget.EditText']
    # Retained original Android XML exposes these hints as text on empty inputs.
    hints = {'Email': 'ime@primer.rs', 'Lozinka': 'Unesite lozinku'}
    if any(node.attrib.get('text', '').strip() not in ('', hints[node.attrib['content-desc']]) for node in fields):
        raise AssertionError('Entry prelude must finish before credentials are entered')
    return root


def assert_entry_recovery_surface(root):
    labels = {node.attrib.get('text', '') for node in root.iter()}
    fields = [node for node in root.iter() if node.attrib.get('class') == 'android.widget.EditText']
    if 'Oporavak lozinke još nije dostupan u aplikaciji. Možete se vratiti na prijavu.' in labels:
        if fields:
            raise AssertionError('Gated recovery exposed an editable form')
        return 'GATED'
    if len(fields) == 1 and fields[0].attrib.get('content-desc') == 'Email':
        if any(node.attrib.get('content-desc') == 'Pošaljite link' for node in root.iter()):
            return 'AVAILABLE_NO_REQUEST'
    raise AssertionError('Recovery is neither the known gated state nor the configured email form')


def entry_assert_process_absent(deadline):
    remaining = min(5, deadline - time.monotonic())
    if remaining <= 0:
        native_surface_failure('Entry pre-capture deadline exceeded')
    observed = subprocess.run(['adb', 'shell', 'pidof', PACKAGE], check=False,
                              capture_output=True, text=True, timeout=remaining)
    if observed.returncode != 1 or observed.stdout.strip():
        native_surface_failure('Entry must not run before its first recorded launch')


def entry_launcher_observation(deadline):
    system_dialog_adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml', deadline=deadline)
    xml = system_dialog_adb('shell', 'cat', '/sdcard/window.xml', deadline=deadline).stdout
    root = ET.fromstring(xml)
    dump_tree.last_observation = (root, xml)
    windows = system_dialog_adb('shell', 'dumpsys', 'window', 'displays', deadline=deadline).stdout
    entry_assert_process_absent(deadline)
    return root, windows


def entry_assert_launcher_clear(root, windows):
    # Exact launcher component retained in run34538463761's original window dump.
    launcher = 'com.android.launcher3'
    if (has_native_anr(root)
            or current_focus_name(windows) not in (
                launcher + '/.uioverrides.QuickstepLauncher',
                launcher + '/' + launcher + '.uioverrides.QuickstepLauncher')
            or not any(node.attrib.get('package') == launcher for node in root.iter())):
        retain_anr_diagnostic(root, windows)
        native_surface_failure('Entry pre-capture requires the unobscured known launcher')


def prepare_entry_first_launch():
    # Signature only: no warm-up app launch, no preference/intro reset after capture starts.
    # The historical launch_clean recovery needs an app PID and is therefore too late
    # to establish an unobscured first-launch recording.
    deadline = time.monotonic() + 30
    system_dialog_adb('shell', 'am', 'force-stop', PACKAGE, deadline=deadline)
    cleared = system_dialog_adb('shell', 'pm', 'clear', PACKAGE, deadline=deadline)
    if cleared.stdout.strip() != 'Success':
        native_surface_failure('Disposable Entry app data was not cleared')
    root, windows = entry_launcher_observation(deadline)
    recovered = False
    if has_native_anr(root):
        diagnostic = retain_anr_diagnostic(root, windows)
        titles = [n for n in root.iter() if n.attrib.get('resource-id') == 'android:id/alertTitle']
        close = [n for n in root.iter() if n.attrib.get('resource-id') == 'android:id/aerr_close']
        wait = [n for n in root.iter() if n.attrib.get('resource-id') == 'android:id/aerr_wait']
        if (len(titles) != 1 or titles[0].attrib.get('package') != 'android'
                or titles[0].attrib.get('text') not in ("Quickstep isn't responding", 'Quickstep ne reaguje')
                or current_focus_name(windows) != 'Application Not Responding: com.android.launcher3'
                or len(close) != 1 or len(wait) != 1
                or close[0].attrib.get('text') not in ('Close app', 'Zatvori aplikaciju')
                or any(n.attrib.get('package') != 'android' or n.attrib.get('clickable') != 'true'
                       or n.attrib.get('enabled') != 'true' for n in close + wait)):
            native_surface_failure('App or unrecognized ANR before Entry recording')
        marker = ARTIFACT_DIR / 'SYSTEM_QUICKSTEP_RECOVERY_USED.json'
        if marker.exists():
            native_surface_failure('Repeated Quickstep ANR; no second recovery')
        x1, y1, x2, y2 = parse_bounds(close[0].attrib.get('bounds'))
        if x1 >= x2 or y1 >= y2:
            native_surface_failure('Invalid Quickstep close bounds')
        receipt = {'diagnostic': diagnostic, 'phase': 'ENTRY_PRE_CAPTURE',
                   'appProcessAbsent': True, 'verified': False}
        with marker.open('x', encoding='utf-8') as handle:
            json.dump(receipt, handle)
        system_dialog_adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2), deadline=deadline)
        time.sleep(.5)
        root, windows = entry_launcher_observation(deadline)
        entry_assert_launcher_clear(root, windows)
        receipt['verified'] = True
        marker.write_text(json.dumps(receipt), encoding='utf-8')
        recovered = True
    else:
        entry_assert_launcher_clear(root, windows)
    print('CHECKPOINT ENTRY_PRE_CAPTURE clean_launcher app_absent no_warmup_launch', flush=True)
    return {'launcherClear': True, 'appProcessAbsent': True, 'quickstepRecoveredBeforeCapture': recovered}


def launch_entry_prepared():
    # Recheck after recorder readiness; a newly appearing dialog must fail, not be
    # dismissed inside the retained movie. The app has still never been launched.
    root, windows = entry_launcher_observation(time.monotonic() + 15)
    entry_assert_launcher_clear(root, windows)
    started = adb('shell', 'am', 'start', '-W', '-n', MAIN_ACTIVITY, check=False)
    print(f'APP_START returncode={started.returncode} stdout={started.stdout[-500:]} stderr={started.stderr[-500:]}', flush=True)
    if started.returncode != 0:
        native_surface_failure('First recorded Entry launch failed')
    wait_visible(timeout=90, desc='Prijavi se')
    assert_signed_out_surface()


def reject_entry_recording_anr(root, parent):
    if not has_native_anr(root):
        return False
    windows = system_dialog_adb('shell', 'dumpsys', 'window', 'displays').stdout
    retain_anr_diagnostic(root, windows)
    native_surface_failure('ANR obscured Entry recording; original video retained without recovery')


def record_entry_motion(name, action):
    # Original screenrecord/screencap tools, with readiness before the gesture.
    # PNG/XML pairs cannot sample a 760ms transition reliably; the original MP4
    # is the motion evidence. A slow CI recording is not frame-perfect timing.
    if name not in ('ENTRY_intro', 'ENTRY_requester_sweep', 'ENTRY_worker_sweep',
                    'ENTRY_reduced_requester', 'ENTRY_reduced_worker'):
        raise RuntimeError('Unexpected Entry recorder artifact name')
    video_path = f'/sdcard/uskoci-{name}.mp4'
    if adb('shell', 'pidof', 'screenrecord', check=False).stdout.strip():
        raise RuntimeError('Unexpected recorder on the disposable emulator')
    recorder = subprocess.Popen(['adb', 'shell', 'screenrecord', '--time-limit', '120', video_path],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    recorder_pid = None
    try:
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if recorder.poll() is not None:
                raise RuntimeError('Entry recorder exited before the UI action')
            observed = adb('shell', 'pidof', 'screenrecord', check=False).stdout.strip()
            if observed:
                if not observed.isdigit():
                    raise RuntimeError('Ambiguous recorder identity')
                recorder_pid = observed
                break
            time.sleep(.1)
        if recorder_pid is None:
            raise RuntimeError('Entry recorder readiness was not observed')
        original_recovery = globals()['dismiss_known_system_anr']
        globals()['dismiss_known_system_anr'] = reject_entry_recording_anr
        try:
            action()
        finally:
            globals()['dismiss_known_system_anr'] = original_recovery
        if recorder.poll() is not None:
            raise RuntimeError('Entry recorder ended before the final UI surface was observed')
    finally:
        observed = adb('shell', 'pidof', 'screenrecord', check=False).stdout.strip()
        if observed:
            if recorder_pid is None or not observed.isdigit() or observed != recorder_pid:
                raise RuntimeError('Recorder identity changed; refusing to signal an unrelated process')
            adb('shell', 'kill', '-2', observed)
        result = recorder.wait(timeout=15)
        adb('pull', video_path, str(ARTIFACT_DIR / f'{name}.mp4'))
        if result not in (0, 130):
            raise RuntimeError(f'Entry recorder failed with status {result}')


def entry_intent_to_auth(label, prefix, record=True):
    assert_entry_welcome()
    if prefix in ('ENTRY_requester', 'ENTRY_worker'):
        shot(f'{prefix}_before')
    def enter():
        tap(desc=label, hold_ms=160)
        wait_visible(desc='Prijavite se')
        assert_entry_password_form()
    if record:
        record_entry_motion(f'{prefix}_sweep' if prefix in ('ENTRY_requester', 'ENTRY_worker') else prefix, enter)
    else:
        enter()
    shot(f'{prefix}_auth')
    # Returning from an untouched LOGIN form preserves the same installed app.
    tap(desc='Nazad')
    wait_visible(desc='Prijavi se')
    assert_entry_welcome()


def prove_spoj_entry(signature=False):
    pre_capture = prepare_entry_first_launch() if signature else None
    record_entry_motion('ENTRY_intro', launch_entry_prepared if signature else launch_clean)
    assert_entry_welcome()
    shot('ENTRY_welcome')
    if signature:
        entry_intent_to_auth('Meni treba', 'ENTRY_requester')
        entry_intent_to_auth('Ja mogu', 'ENTRY_worker')
    open_login_sheet()
    assert_entry_password_form()
    shot('ENTRY_login')
    tap(desc='Prijavite se', prefer='bottom')
    wait_visible(text='Unesite email i lozinku.')
    shot('ENTRY_empty_error')
    tap(text='Zaboravili ste lozinku?')
    # Current AuthIntro title is "Vratite pristup\nnalogu."; the retired
    # "Oporavak lozinke" heading is deliberately not used as a selector.
    root, _ = wait_surface(text='Nazad na prijavu')
    recovery_state = assert_entry_recovery_surface(root)
    shot('ENTRY_recovery_surface' if signature else 'ENTRY_recovery_gated')
    if not signature and recovery_state != 'GATED':
        raise AssertionError('Historical full proof expects its known gated recovery fixture')
    tap(text='Nazad na prijavu')
    assert_entry_password_form()
    tap(text='Napravi nalog')
    wait_visible(desc='Napravite nalog')
    shot('ENTRY_registration')
    tap(desc='Nazad')
    assert_entry_password_form()
    tap(desc='Nazad')
    wait_visible(desc='Prijavi se')
    assert_entry_welcome()
    shot('ENTRY_back_to_welcome')
    # Both installed RN AccessibilityInfo and Reanimated read TRANSITION_ANIMATION_SCALE.
    # Preserve the actual preference; animator_duration_scale is a different setting.
    previous = adb('shell', 'settings', 'get', 'global', 'transition_animation_scale').stdout.strip()
    if previous != 'null' and not re.fullmatch(r'(?:0|[1-9][0-9]*)(?:\.[0-9]+)?', previous):
        raise RuntimeError('Unexpected original transition animation setting')
    adb('shell', 'settings', 'put', 'global', 'transition_animation_scale', '0')
    try:
        if adb('shell', 'settings', 'get', 'global', 'transition_animation_scale').stdout.strip() != '0':
            raise RuntimeError('Reduced-motion OS setting was not observed')
        launch_clean()
        assert_entry_welcome()
        shot('ENTRY_reduced_motion_welcome')
        if signature:
            entry_intent_to_auth('Meni treba', 'ENTRY_reduced_requester')
            entry_intent_to_auth('Ja mogu', 'ENTRY_reduced_worker')
    finally:
        if previous == 'null':
            adb('shell', 'settings', 'delete', 'global', 'transition_animation_scale')
        else:
            adb('shell', 'settings', 'put', 'global', 'transition_animation_scale', previous)
        if adb('shell', 'settings', 'get', 'global', 'transition_animation_scale').stdout.strip() != previous:
            raise RuntimeError('Original animator duration setting was not restored')
    if signature:
        import json
        report = {
            'status': 'PASS', 'scope': 'SPOJ_V2_ENTRY_SIGNATURE',
            'sourceSha': os.environ.get('GITHUB_SHA'),
            'checkpoints': list(entry_signature_checkpoints()),
            'videos': ['ENTRY_intro.mp4', 'ENTRY_requester_sweep.mp4', 'ENTRY_worker_sweep.mp4',
                       'ENTRY_reduced_requester.mp4', 'ENTRY_reduced_worker.mp4'],
            'recoveryState': recovery_state, 'loopbackFixtureOnly': True,
            'authCredentialsEntered': False, 'authLoginProven': False,
            'signupSubmitted': False, 'recoveryRequested': False,
            'productionAuthProven': False, 'nativeVisualParityAccepted': False,
            'framePerfectDurationMeasured': False,
            'osReducedMotionObserved': True, 'originalTransitionSettingRestored': previous,
            'preCapture': pre_capture, 'recordedAnrRecoveryAllowed': False,
        }
        (ARTIFACT_DIR / 'entry-signature-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        print('PASS SPOJ_ENTRY_SIGNATURE_PHYSICAL 13_png_xml 5_original_videos actual_auth_surfaces no_credentials', flush=True)
    print('PASS SPOJ_ENTRY_PHYSICAL welcome login empty_error recovery registration back os_reduced_motion_welcome_reachable', flush=True)


def run_entry_signature_only():
    # Same FunctionDef-only helper loader as the existing intent-shell journey.
    # Its unrelated executable marketplace body is never evaluated here.
    import ast
    import json
    import os
    import re
    import subprocess
    import time
    import xml.etree.ElementTree as ET
    from pathlib import Path
    from urllib.parse import urlparse
    package = os.environ['RU5_DEVICE_PACKAGE']
    if package != 'rs.uskoci.n04proof':
        raise RuntimeError('Disposable Entry APK required')
    for key in ('RU5_DEVICE_DB_URL', 'RU5_DEVICE_SUPABASE_URL'):
        if urlparse(os.environ[key]).hostname not in ('localhost', '127.0.0.1'):
            raise RuntimeError('Entry signature proof requires the existing loopback fixture')
    if not re.fullmatch(r'[0-9a-f]{40}', os.environ.get('GITHUB_SHA', '')):
        raise RuntimeError('Exact GitHub source SHA is required for Entry evidence')
    artifact_dir = Path(os.environ['RU5_DEVICE_ARTIFACT_DIR'])
    artifact_dir.mkdir(parents=True, exist_ok=True)
    globals().update(os=os, json=json, re=re, subprocess=subprocess, time=time, ET=ET, Path=Path,
                     PACKAGE=package, MAIN_ACTIVITY=f'{package}/.MainActivity', ARTIFACT_DIR=artifact_dir)
    source = Path(__file__).with_name('ru5_android_device_ui_journey.py')
    definitions = ast.Module(body=[node for node in ast.parse(source.read_text(encoding='utf-8')).body
                                  if isinstance(node, ast.FunctionDef)], type_ignores=[])
    exec(compile(definitions, str(source), 'exec'), globals())
    prove_spoj_entry(signature=True)


# Import through the historical driver's exec() must not dispatch a second run.
if __name__ == '__main__' and __file__.replace('\\', '/').endswith('/entry_spoj_android.py'):
    run_entry_signature_only()
