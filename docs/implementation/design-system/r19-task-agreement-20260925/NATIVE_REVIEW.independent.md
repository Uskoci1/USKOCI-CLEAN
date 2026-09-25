# R19 — independent native screenshot review

Reviewed 2026-09-26 (Europe/Warsaw), captures recorded 2026-09-25 UTC. Reviewer: independent chat/media agent. Only this report was written; no device control, account mutation, new upload or runtime change.

## Exact build and scope

- Source: `3cdb3005c393c2a47572452d3704c69de9799d25`
- Tree: `1fa68354519fefc4bcfa6e1428433ab786bc6951`
- Emulator workflow: [36193917101](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36193917101)
- APK SHA-256: `a9328dc60c55bc38c4fe3ec946fa53f08518b3e9c411d56151cf8e1df3f86177`
- Device in receipt: `emulator-5556`; native display 1080×2424, density 420, font scale 1.0.
- Receipt: outer-workspace `outputs/r6-integration/r19-emulator/APK.json`; it records successful replacement installation and the matching installed APK hash.

Five requested R19 PNGs were opened directly, not inferred from XML. Their file hashes were recomputed and matched `CAPTURES.json`; every reviewed row names the source and APK above. Two R18 PNGs were directly viewed only as avatar baselines. The image tool displayed resized 912×2048 previews; this is a visual content/layout review, not a pixel-exact measurement exercise.

## Per-image observations

All R19 paths below are relative to outer-workspace `outputs/r6-integration/r19-emulator/`.

| PNG | SHA-256 | Direct observation and limitation |
| --- | --- | --- |
| `profile-first.png` | `c510aeb53e6e750f39dade24b4d390fd8f72f3edb77ed34542f1c0f9551586a8` | A real image is visible inside the profile avatar with its camera badge. Name, place, reputation and active-work-profile status are readable. Work setup and the two availability/calendar shortcuts are separated from account/help rows. No overlapping text is visible in this frame. It does not show lower privacy rows or prove their actions. |
| `profile-photo-existing.png` | `20376022df4b1af6093d3aa2d6cbd7ca739678dd434b713d1c221e9bc78341ab` | The existing stored image is rendered in the large preview. Gallery, camera and removal controls remain visible and legible; there is no stuck-upload state in this frame. The image is a cropped graphic, not a portrait: its small embedded words and crop are properties of the user's image, not missing UI labels. This proves visible read/display of this existing image, not a fresh pick/upload/apply/delete cycle. |
| `agreement-completed.png` | `f99ae2e5c38567fdb3af480af11f4ee0d8e4e8e35b79470abdbb5ab6e25e499d` | Header shows the other person and a chat icon. The accepted-terms card clearly groups task title, remote work, no exact agreed time, and 100 RSD total. Completed status and the saved-rating message are visible below. Application, safety, contact and history entries remain visible; the bottom chat action is fully visible. No blocking clipping is visible. This completed state does not validate unfinished, dispute or unknown-command layouts. |
| `agreement-source-task.png` | `c2c91d3bac00525d00f452a00227b7dc4b4343eb2dd0ba8e94dd690c65a6a117` | The linked task shows its title, remote location, flexible deadline, one filled place, OFFERS wording, description, required phone tool and author. The selected-application state has a visible “Otvori Dogovor” action. No invented cover image occupies the top of this image-less task. This frame cannot verify a populated photo carousel, image loading failures, swiping or full-screen viewing. |
| `discovery-list-expanded.png` | `165672c8f026324913c5c38b1bbbf1aa56f6743bf499dcee7a439bbd9f582d50` | Search/filter controls and quick filters remain above the expanded sheet. Two task rows distinguish title, offers, place, time, person/reputation and capacity. The visible application-state line is separate. The floating map button and active Zadaci navigation are visible without obscuring essential text in this captured position. Horizontal filter continuation is visible at the right edge; this alone is not evidence of inaccessible clipping. Scrolling, touch targets, large text and map rendering are not established by this still. |

## Direct R18 comparison for the existing avatar

Baselines are under outer-workspace `outputs/r6-integration/r18-emulator/`:

| Baseline | Source / APK | PNG SHA-256 | Visible difference |
| --- | --- | --- | --- |
| `profile-read-for-r19.png` | Source `74f514d79fa323e135c9ddc23a6cb6b5b934c730`; APK `ad4d820b624ed8de42c7c8462516c447f4401a3e126dcfc70825e8fe10fd1a01` | `6999402d6c7b1664f326a4c2cfea709ca6bc1e46e77bf1dd9df219bd7d20e007` | R18 shows an initial in the avatar; R19 shows the existing image. The surrounding profile layout remains comparable. |
| `profile-photo-read-for-r19.png` | Same R18 source/APK | `e165528e0b8982f42e1f8552700ac3328574fedf20adecafe72ea88316d4b3ba` | R18 shows the camera placeholder where R19 displays the existing image. Both retain gallery/camera/removal choices. |

Both baseline hashes matched their capture records. These stills independently support the narrow native read/display improvement documented in `MEDIA_BINARY_READ.md`. They do not alone establish the transport root cause; that is covered by the separate source and byte-exact regression evidence.

## Important semantic distinction

The source task displays a flexible deadline through 27 September, while the accepted Agreement displays “Bez tačnog termina”. The source task also says “Tražim ponude”, while the accepted Agreement displays 100 RSD total. These are different data contexts. Do not replace the Agreement's accepted facts with the task's current projection to make the pictures look identical. Whether an exact term should have been required at selection is a product/contract question, not a visual fact established by these screenshots.

## Verdict and limits

No blocking overlap or unreadable primary action was found in the five requested normal-font frames. Existing avatar read/display is visibly improved, and the accepted-Agreement card and task detail remain distinguishable and readable.

This does **not** accept the entire R19 release. Physical-phone review, photo selection/upload/apply recovery, populated task-photo gestures, chat/composer/keyboard transitions, accessibility and large-font variants are outside these five frames. The map's reported blank-ring issue belongs to the map investigation; the expanded-list image provides no evidence that pins or map glyphs work. No new provider call, lifecycle command or complete task-to-rating journey was executed by this reviewer.
