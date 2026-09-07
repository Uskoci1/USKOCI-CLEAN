"""Entry-only physical proof, using the existing disposable journey's UI helpers.

No Auth request or fixture mutation in this prelude. The inherited journey then
proves real password login, account switch, profile, Inbox and existing routes.
"""
def prove_spoj_entry():
    # Record only the signed-out introduction. Credentials are entered later.
    video_path = '/sdcard/uskoci-entry-intro.mp4'
    if adb('shell', 'pidof', 'screenrecord', check=False).stdout.strip():
        raise RuntimeError('Unexpected recorder on the disposable emulator')
    recorder = subprocess.Popen(['adb', 'shell', 'screenrecord', '--time-limit', '120', video_path],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        launch_clean()
    finally:
        # Stop only this sole recorder after the visible welcome is observed.
        # A fixed short recording can end before a slow cold launch shows intro.
        recorder_pid = adb('shell', 'pidof', 'screenrecord', check=False).stdout.strip()
        if recorder_pid:
            if not recorder_pid.isdigit():
                raise RuntimeError('Ambiguous recorder identity')
            adb('shell', 'kill', '-2', recorder_pid)
        result = recorder.wait(timeout=15)
        if result not in (0, 130):
            raise RuntimeError(f'Intro recorder failed with status {result}')
        adb('pull', video_path, str(ARTIFACT_DIR / 'ENTRY_intro.mp4'))
    wait_visible(text='Meni treba')
    wait_visible(text='Ja mogu')
    shot('ENTRY_welcome')
    open_login_sheet()
    shot('ENTRY_login')
    tap(text='Prijavite se', prefer='bottom')
    wait_visible(text='Unesite email i lozinku.')
    shot('ENTRY_empty_error')
    tap(text='Zaboravili ste lozinku?')
    wait_visible(text='Oporavak lozinke')
    shot('ENTRY_recovery_gated')
    tap(text='Nazad na prijavu')
    wait_visible(clazz='android.widget.EditText')
    tap(text='Registracija')
    wait_visible(text='Napravite nalog')
    shot('ENTRY_registration')
    tap(desc='Nazad')
    wait_visible(text='Prijavite se')
    tap(desc='Nazad')
    wait_visible(desc='Prijavi se')
    shot('ENTRY_back_to_welcome')
    # Fresh clean launch with the device's accessibility preference enabled.
    # This is an OS setting, not an injected application state.
    adb('shell', 'settings', 'put', 'global', 'animator_duration_scale', '0')
    try:
        launch_clean()
        shot('ENTRY_reduced_motion_welcome')
    finally:
        adb('shell', 'settings', 'put', 'global', 'animator_duration_scale', '1')
    print('PASS SPOJ_ENTRY_PHYSICAL welcome login empty_error recovery_gated registration back os_reduced_motion_welcome_reachable', flush=True)
