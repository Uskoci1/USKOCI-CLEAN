# Voice path — what to check by hand on the phone

The provider defect is fixed and deployed, but nothing about the voice path has been seen working
on real hardware. This is the list the owner asked for. Each line says what to do, what should
happen, and what it would mean if it does not.

**Artifact** — superseded the first build the same evening

| | |
| --- | --- |
| download | `https://github.com/Uskoci1/USKOCI-CLEAN/releases/download/pkg020-6b7e6a2/USKOCI-DEV.apk` |
| sha256 | `a718aaa51fbf8ba1ef4dea1ad2c0a6a31be22a6efe72debbb91e1211e1db0dde` |
| bytes | 68 636 795 |
| source commit | `6b7e6a20307979d5163f953a50bb088602aacb17` |
| build run | 35253482389, attempt 1 |

Both attestations pass and carry this commit alongside this APK digest. The published asset was
downloaded back and hashed to the same value. The first GitHub upload failed with HTTP 500 and rolled
the release back; it was recreated and the APK uploaded on the first retry.

This build carries the clean conversation surface and the finalization fix (the bridge now completes
on `generationComplete`, which the transcribe model actually sends). Later commits are server-only -
audio-duration settlement for STT - and are already live without a new APK: the diff from
`6b7e6a2` to head touches only `supabase/` and one test file.

The earlier `pkg020-cb5a0b2` build is superseded: it could transcribe but always ended in
FINALIZATION_TIMEOUT.

Install it over the existing app; the account and session survive.

**Before starting:** the AI counter is the same one the conversation uses. A speech attempt reserves
200 000 microUSD while it runs, and now gives it back when nothing is transcribed. Spend to date,
measured: about six cents.

---

## 1. The voice session opens

Open a task conversation, tap the microphone in the bottom bar and hold it.

**Expect:** the caption changes from *Drži da govoriš* to *Slušam — pusti za tekst*, a ring appears
around the microphone, and the small level bars move while you speak.

**If it fails** with *Mikrofon trenutno nije dostupan*, the OS permission was refused — allow it for
the app and try again. Any other red line is a real failure; send the screenshot.

## 2. Speech produces a transcript

Say a short sentence in Serbian, for example *Treba mi pomoć oko selidbe u subotu*.

**Expect:** text appears while you talk and firms up when you stop.

**This is the line that was broken.** Until today the provider replied in a binary frame and the
bridge threw it away, so this step always ended in *Govorni unos je prekinut*. If that message comes
back, the fix did not take and I need the screenshot.

## 3. Releasing the microphone does NOT send

Let go of the microphone.

**Expect:** the recognised text lands in the message field and **nothing is sent**. No new bubble
appears in the conversation, and the AI does not start answering.

**If a message goes out on release, stop and tell me.** That is the boundary the whole design rests
on, and it is pinned by a test — but a test is not a phone.

## 4. The transcript stays editable

Look at the text in the field.

**Expect:** you can tap into it, correct a word, add to it, or delete it entirely. It behaves like
anything you typed yourself.

## 5. Send goes only on an explicit press

Press the send arrow.

**Expect:** only now does the message enter the conversation and the AI begin to answer.

## 6. A second AI message also goes through

Answer whatever the AI asks, by voice or by typing.

**Expect:** the second turn works exactly like the first. The task card at the top fills in with what
you said.

**Why this one matters:** on 2026-09-17 the first message succeeded and every later one silently
failed, because the internal counter was full. That is fixed, but the second message is the cheapest
way to see that it stayed fixed.

## 7. A failed speech attempt no longer locks the reservation

Only if something does fail. Force a failure if you like — put the phone in airplane mode, hold the
microphone, speak, release.

**Expect:** an honest error, and **the counter does not shrink**. I read it from the database
afterwards and confirm it is unchanged.

Before today, eight failed attempts locked 1 600 000 units — a third of the ceiling — against zero
real spend.

---

## What I need from you

Screenshots of anything that looks wrong, and a word on which of the seven passed. If all seven pass
I record the real-device evidence for the voice path and PKG-020 has its first hardware proof.

If step 2 or 3 fails, send the screenshot and stop there — the rest of the list depends on them.
