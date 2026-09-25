# Independent source audit — S01–S25

Audit date: 25 September 2026. Input: bibliography claims extracted from `USKOCI_MOBILE_UX_RESEARCH_2026_v1.docx` into `sources.json`. The spurious first S01 entry with no URL was excluded.

This is a claim-level verification, not a replication, systematic review, legal assessment, or user study of USKOČI. Every source below was requested independently. Apple content was read through Apple's public documentation JSON. Direct HTML for the two initially checked HIG pages contained only a JavaScript shell. The full ACM paper could not be retrieved. PNAS's original Stanford PDF subsequently timed out; substantial primary article text, including experimental design, was available in the web search index of its PMC copy, while a later direct PMC open encountered a browser check. Those access differences are preserved below.

**Status meaning:** VERIFIED = the stated finding and relevant date were supported in the material read; QUALIFIED = supported with a needed clarification; LIMITED = author abstract verified, full methods not reviewed. No status asserts independent replication or that a proposed USKOČI implementation is proven.

| Source | Status | Evidence type |
|---|---|---|
| S01 | VERIFIED, company summary | Company research overview |
| S02 | LIMITED, abstract verified | CHI 2026 paper, author abstract |
| S03 | LIMITED, abstract verified | Peer-reviewed 2012 paper, author abstract |
| S04 | VERIFIED | Peer-reviewed meta-analysis, public PDF |
| S05 | QUALIFIED, sample clarification | Peer-reviewed experiment plus observational analysis |
| S06 | VERIFIED | Research-based AI design guidelines |
| S07 | VERIFIED | Metrics framework and author publication |
| S08 | QUALIFIED, benchmark classification | Commercial expert benchmark informed by usability research |
| S09 | VERIFIED | Commercial usability research overview |
| S10 | VERIFIED, date made precise | Commercial usability research overview |
| S11 | VERIFIED | Normative W3C Recommendation |
| S12 | VERIFIED | Informative W3C Group Note |
| S13 | VERIFIED | Android platform guidance |
| S14 | VERIFIED | Apple platform guidance |
| S15 | VERIFIED | Apple platform guidance |
| S16 | VERIFIED | Android platform guidance |
| S17 | VERIFIED | Android platform guidance |
| S18 | VERIFIED | Android platform guidance |
| S19 | VERIFIED | Apple platform guidance |
| S20 | VERIFIED | Apple platform guidance |
| S21 | VERIFIED | Apple platform guidance |
| S22 | VERIFIED | Apple platform guidance |
| S23 | VERIFIED | Expert UX guidance |
| S24 | VERIFIED | Expert guidance with observed examples |
| S25 | VERIFIED | Expert motion guidance |

## S01 — Google Design: Better, Easier, Emotional UX

**Source:** [Google Design research overview](https://design.google/library/expressive-material-design-google-research). The 2025 context is also supported by [Google's 2025 Android Show announcement](https://blog.google/products-and-platforms/platforms/android/the-android-show-io-2025/), which links this article. The article itself did not expose a precise publication date in the readable body.

**Supported:** Google reports 46 studies, hundreds of designs, and more than 18,000 participants. Research covered color, shape, size, motion, and containment. The article explicitly describes usability deterioration when familiar playlist organization or email action labels were removed.

**Limits:** This is a company-authored synthesis, not 46 independently inspected studies. Its largest improvements are examples or maxima, not universal averages. It cannot isolate a single visual ingredient or predict marketplace conversion.

**USKOČI implication:** Preserve brand identity while testing stronger task hierarchy, grouping, and action visibility. Expressiveness should help a person understand the next action; retain familiar organization and text labels. Do not justify additional decoration with the aggregate sample size.

## S02 — Bentley et al.: Usability Hasn't Peaked

**Source:** [Google Research author abstract](https://research.google/pubs/usability-hasnt-peaked-exploring-how-expressive-design-overcomes-the-usability-plateau/). The supplied [ACM DOI](https://dl.acm.org/doi/10.1145/3772318.3790373) did not return readable content in this audit; its full bibliographic metadata was not independently retrieved.

**Supported:** The author page identifies CHI 2026, April 13–17, Barcelona, and 48 participants completing tasks in 10 applications. It reports fixation on the correct element “33% faster” and task completion “20% faster” for Material 3 Expressive variants versus the previous Material design system.

**Limits:** Full methodology, uncertainty intervals, condition-level results, recruitment, and statistical treatment were not inspected. For maximum fidelity, preserve the abstract's relative-performance wording rather than claiming independently checked raw time reductions. Do not conflate this sample with S01's entire research program.

**USKOČI implication:** Test an expressive refinement against the current recognizable design with identical content and task conditions. Measure correct target acquisition, successful completion, errors, and aesthetic judgment separately. These percentages must not become promised USKOČI improvements.

## S03 — Tuch et al.: Visual complexity and prototypicality

**Source:** [Google Research author abstract](https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/).

**Supported:** International Journal of Human-Computer Studies 70(11), 2012, pages 794–811. The first study used **119 website screenshots**, with 50, 500, or 1,000 ms exposure. A second study used 17, 33, and 50 ms. Lower visual complexity and higher prototypicality received higher aesthetic ratings.

**Limits:** The document correctly avoids interpreting 119 as participant count. The abstract does not establish task success, trustworthiness, mobile transaction quality, or a universal minimum number of elements. Full paper methods were not reviewed.

**USKOČI implication:** Keep recognizable navigation and a coherent information hierarchy. Use rapid first-impression testing only for perceived clarity and appeal; separately test whether people understand price, timing, task scope, and commitments.

## S04 — Scheibehenne, Greifeneder, and Todd: Choice overload meta-analysis

**Source:** [Author-hosted paper PDF](https://scheibehenne.com/ScheibehenneGreifenederTodd2010.pdf).

**Supported:** The PDF's opening page confirms 63 conditions from 50 published and unpublished experiments, N = 5,036, a mean effect close to zero, and substantial variation. DOI 10.1086/651235; electronically published 10 February 2010, journal issue October 2010.

**Limits:** An average near zero is not proof that overload never occurs. The article reports that it could not identify sufficient conditions from its analyses; this does not resolve every later theory or marketplace context. No new meta-analysis was performed.

**USKOČI implication:** Avoid arbitrary category or offer limits justified by “fewer choices are always better.” Improve comparability and filtering, preserve access to relevant options, and test whether users can choose accurately and confidently. The optimal organization remains a local design question.

## S05 — Abrahao et al.: Reputation and social biases

**Sources:** [Original Stanford PDF](https://web.stanford.edu/~pparigi/PNAS-2017-Abrahao-9848-53.pdf); [primary article at PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5603987/). The original PDF timed out on subsequent reading; the PMC primary article's indexed text supplied the abstract, experimental design, and discussion. Direct PMC reopening showed a browser check.

**Supported and clarified:** PNAS, online 28 August 2017; issue 12 September 2017, DOI 10.1073/pnas.1604234114. Of 100,000 invited Airbnb users identifying as US residents, **8,906 registered and 6,714 completed participation**. The investment game manipulated demographic and reputation information. A separate analysis covered one million booking requests.

**Limits:** Investment is a proxy for trust, not a measurement of safe job performance. Volunteers, geography, completion, and the observational component restrict generalization. The paper explicitly limits experimental results to its participant population.

**USKOČI implication:** Present authentic reputation with review count and relevant context; distinguish identity checks from work history and skill. Avoid safety guarantees, invented verification badges, and precision unsupported by sparse reviews. Include a fair, explicit state for new workers.

## S06 — Microsoft HAX / Guidelines for Human-AI Interaction

**Sources:** [HAX Design Library](https://www.microsoft.com/en-us/haxtoolkit/library/); [guideline background](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/).

**Supported:** The current library enumerates 18 guidelines, including capabilities and limitations, contextual relevance, dismissal, correction, uncertainty handling, explanations, adaptation, and global controls. Microsoft's background page identifies the 2019 CHI paper as the research foundation. The document's lifecycle summary is consistent with this framework.

**Limits:** The public library is guidance and examples, not evidence that a chatbot is the best control for every task. Current generative-AI examples should not be mistaken for features tested in 2019.

**USKOČI implication:** Let AI suggest a task draft or clarify missing details, with ordinary editable fields and an obvious way to dismiss it. Explain what was inferred. Require the user to review scope, amount, location, and time before creating a commitment. Do not make uncertainty look like verified knowledge.

## S07 — Rodden, Hutchinson, and Fu: HEART

**Sources:** [Author's HEART page](https://kerryrodden.com/heart/); [Google-hosted author paper](https://research.google.com/pubs/archive/36299.pdf).

**Supported:** The author identifies the CHI 2010 paper and the HEART dimensions: Happiness, Engagement, Adoption, Retention, and Task success. Goals–Signals–Metrics is a related process for selecting measurements aligned with product goals.

**Limits:** This is a framework, not a required dashboard, target percentage, or causal proof that more engagement is good. The audit inspected the author overview and paper opening, not a replication of its cases.

**USKOČI implication:** Define success around accurately formed and completed agreements, effective offer comparison, recovery from errors, and user confidence. Choose signals per journey. Message volume or time spent should not substitute for successful coordination, since friction can increase both.

## S08 — Baymard: Mobile App UX Trends

**Source:** [2026 mobile app benchmark overview](https://baymard.com/research-articles/mobile-app-ux-trends).

**Supported and clarified:** Updated 14 April 2026; originally published 24 October 2024. The page covers 30 leading US/European ecommerce apps, more than 11,000 manually reviewed/scored elements, and more than 9,000 implementation examples. It discusses navigation, discovery, and other product-finding issues.

**Limits:** Classify the current dataset as an **expert benchmark informed by usability research**, not a representative experiment on all mobile apps. Scores and implementation examples are not participant counts. The commercial full guideline library was not accessed. Benchmark quality percentages must retain Baymard's scope and rubric.

**USKOČI implication:** Make task discovery and categories easy to locate, label destinations by their actual scope, and keep promotional content subordinate to users' current work. Do not transplant shopping, cross-selling, cart, or checkout semantics into the service marketplace.

## S09 — Baymard: Applied filters

**Source:** [Applied filters overview](https://baymard.com/research-articles/how-to-design-applied-filters).

**Supported:** Updated 13 May 2026; originally 6 October 2020. Applied-filter summaries support immediate confirmation, quick removal, and understanding of result scope. The article says desktop comparisons were inconclusive about the most effective placement, so the document is right not to prescribe one chip arrangement.

**Limits:** This does not prove identical effectiveness of every layout. Placement, discoverability, overflow, and available viewport space still matter. The source is ecommerce research, not a study of Serbian task listings.

**USKOČI implication:** Display active area, category, date, and other meaningful constraints near map/list results. Support individual removal and clearing. Preserve them on return from a task detail. A zero-result state should reveal the current scope and offer an intentional way to broaden it.

## S10 — Baymard: Ecommerce search query types

**Source:** [Search query types and 2026 benchmark](https://baymard.com/research-articles/ecommerce-search-query-types).

**Supported:** More precise date: **updated 29 April 2026, originally published 12 September 2024**. The article distinguishes types of search intent and discusses alternative names, misspellings, category intent, and attribute queries; exact title matching alone is insufficient for its ecommerce cases.

**Limits:** Its taxonomy and benchmark percentages concern ecommerce sites/apps and their scoring criteria. They do not validate a Serbian marketplace search engine, AI ranking, or specific conversion benefit. Some article prose mixes general research discussion with current benchmark statements; avoid extracting a stray percentage without its denominator.

**USKOČI implication:** Build a small Serbian-language query evaluation set from real task vocabulary, including colloquial names, diacritics, alternative spellings, and place names. Distinguish empty results from failed loading and from active filters. Test relevance before adding elaborate suggestion UI.

## S11 — W3C WCAG 2.2

**Source:** [Normative WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/).

**Supported:** Current displayed Recommendation is 12 December 2024. Criteria carry separate A/AA/AAA levels. Text contrast under 1.4.3 is 4.5:1, with 3:1 for qualifying large text and stated exceptions. Interaction-triggered nonessential motion criterion 2.3.3 is AAA. The document's distinctions are correct.

**Limits:** This is a web standard, with conformance conditions covering complete pages and processes. A handful of passing checks cannot establish whole-product conformance or a legal conclusion. Level and exception must accompany any quoted criterion.

**USKOČI implication:** Maintain a criterion-level test matrix for critical web journeys and use the native interpretation guidance in S12 where appropriate. Verify contrast on actual states, meaningful labels, focus behavior, and alternatives to gesture-only actions. Brand color names alone cannot establish contrast.

## S12 — W3C WCAG2ICT

**Source:** [Guidance for non-web ICT](https://www.w3.org/TR/wcag2ict-22/).

**Supported:** W3C Group Note dated 11 December 2025. It explicitly provides informative guidance, does not set requirements, and explains applying WCAG concepts to non-web documents and software. Its principal application guidance covers WCAG 2.0/2.1/2.2 A and AA criteria.

**Limits:** It is not itself a new normative standard or a native-app certification. It also acknowledges needs beyond its scope. The document's caution is correct.

**USKOČI implication:** Translate relevant checks into native semantics and platform behavior, then test real screens with assistive technologies and system text settings. Keep records of what was tested rather than using an unqualified accessibility badge.

## S13 — Android accessibility

**Source:** [Android accessibility design guidance](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility).

**Supported:** Page last updated 8 May 2023. It calls for at least 48 dp touch targets, text sized in sp, screen-reader descriptions, and accessible alternatives to gestures. The visual icon can be smaller than its interactive area.

**Limits:** dp, sp, physical pixels, CSS pixels, and Apple points are not interchangeable specifications. The page's minimum body-size advice does not make that minimum an ideal reading size. Guidance is not an implementation audit.

**USKOČI implication:** Verify true hit areas for small map, filter, close, and message controls. Use scalable text and purposeful semantic grouping. Provide explicit alternatives for deleting, reordering, and other swipe or drag interactions. Test without relying on sight or precise touch.

## S14 — Apple typography

**Sources:** [Human-readable page](https://developer.apple.com/design/human-interface-guidelines/typography); [official JSON read](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/typography.json).

**Supported:** The JSON's change date is 16 December 2025. Apple recommends legible sizes and weights, preserving hierarchy as text grows, layout adaptation, reduced truncation, and implementation of accessibility behavior for custom fonts. The document correctly connects Dynamic Type to layout, not merely font selection.

**Limits:** HIG guidance does not scientifically rank typefaces or dictate the USKOČI identity. Its platform minimum sizes are floors, not a premium visual system. Custom fonts require actual behavior support.

**USKOČI implication:** Keep the established type identity where compatible, but define semantic roles, scalable styles, and content-driven height. Test Serbian diacritics, long names, prices, dates, bold text, and largest accessibility sizes. Essential agreement terms must remain readable without ellipsis.

## S15 — Apple tab bars

**Sources:** [HIG tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars); [official JSON read](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/tab-bars.json).

**Supported:** Updated 8 June 2026. Tabs represent top-level sections and retain each section's navigation state. Apple recommends labels and avoiding hidden/disabled tabs when content is unavailable; empty content should be explained. Actions belong in appropriate controls rather than being misrepresented as destinations.

**Limits:** HIG does not choose the number or names of USKOČI sections. Its visual system does not require replacing existing product identity.

**USKOČI implication:** Keep core navigation stable across posting and helping contexts, use understandable Serbian labels, and preserve per-section state. Treat creating a task as an explicit action. Use badges for information that needs attention, with counts tied to defined meaning.

## S16 — Android layout and navigation patterns

**Source:** [Android navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns).

**Supported:** Last updated 22 September 2026. Navigation bars support three to five destinations at the same hierarchy level. Large-screen navigation should adapt; the page distinguishes destinations from actions and gives FABs as one action pattern.

**Limits:** Three to five is component guidance, not evidence that five tabs maximize success. Device posture and available space matter. The source does not settle marketplace roles or ownership semantics.

**USKOČI implication:** Choose destinations from users' recurring needs and test labels before locking the count. Avoid changing the whole navigation when a person posts one task and offers help on another. Adapt wider layouts while keeping the same information model.

## S17 — Android content composition and structure

**Source:** [Android content structure](https://developer.android.com/design/ui/mobile/guides/layout-and-content/content-structure).

**Supported:** Last updated 22 September 2026. A standard compact margin is 16 dp, with adaptation to larger screens. Alignment, flexible grids, spacing, typography, and containment communicate structure. The source explicitly allows both implicit grouping through space and explicit grouping through dividers/cards.

**Limits:** It does not prescribe a universal card, radius, border, or spacing scale. A 16 dp margin is not proof that all content should use the same padding. Keyboard-pinned input examples describe behavior, not a full chat architecture.

**USKOČI implication:** Establish a small consistent spacing system within the current visual language. Use space and alignment for routine rows; reserve stronger containers for independently meaningful objects such as offers and agreements. Let text and image content determine needed height.

## S18 — Android edge-to-edge

**Source:** [Android edge-to-edge design](https://developer.android.com/design/ui/mobile/guides/layout-and-content/edge-to-edge).

**Supported:** Last updated 22 September 2026. Backgrounds and scrolling content can draw behind system bars. Critical controls must respect system-bar, gesture, and display-cutout insets; gesture targets under system insets can conflict with OS navigation.

**Limits:** Visual immersion does not justify obscured controls. This design page alone does not verify IME/keyboard behavior or every operating-system implementation requirement.

**USKOČI implication:** Let map and background surfaces reach screen edges while keeping back, search, composer, and confirmation controls accessible. Test gesture and three-button navigation, cutouts, rotation, and keyboard visibility on physical devices. A polished full-screen screenshot is insufficient evidence of safe interaction.

## S19 — Apple onboarding

**Sources:** [HIG onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding); [official JSON read](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/onboarding.json).

**Supported:** Change date 10 June 2024. Apple favors learning through interaction, context-specific tips, brief prerequisite flows, optional separate tutorials, and delayed nonessential setup. Permissions belong at the relevant feature unless the app genuinely needs them to function initially.

**Limits:** The source does not require removing necessary service setup. Optional guidance and unavoidable prerequisites are different. It is platform advice, not a measured conversion promise.

**USKOČI implication:** Give first-time users a concrete path to understand or draft a task. Explain unfamiliar terms at their point of use. Ask for location or media access in context and preserve a useful route if access is declined. Avoid front-loading a long feature tour.

## S20 — Apple motion

**Sources:** [HIG motion](https://developer.apple.com/design/human-interface-guidelines/motion); [official JSON read](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/motion.json).

**Supported:** Change date 9 September 2025. Motion should communicate purpose, be brief and precise, respect expectations, and be optional. Apple recommends avoiding extra motion on frequent interactions and allowing users to cancel rather than waiting for an animation to finish.

**Limits:** This supports motion restraint, not animation on every element. The page's gaming frame-rate passage must not become the performance target for an ordinary marketplace interface.

**USKOČI implication:** Use motion for spatial continuity, selection, and real state changes. Repeated screens should not replay decorative entrances. Preserve interaction during interruptible transitions and provide reduced-motion behavior that still communicates the state. A success animation must follow confirmed success.

## S21 — Apple materials

**Sources:** [HIG materials](https://developer.apple.com/design/human-interface-guidelines/materials); [official JSON read](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/materials.json).

**Supported:** Change date 9 September 2025. Liquid Glass is a functional layer for navigation and controls, distinct from content. Apple advises against using it in the content layer, apart from described transient interactive-control exceptions, and recommends sparing use on custom controls.

**Limits:** The source does not endorse glass on every card or a blanket app-wide redesign. Standard materials and Liquid Glass have different roles. Contrast and legibility must remain intact over actual backgrounds.

**USKOČI implication:** Preserve brand surfaces and information clarity. If an iOS material treatment is explored, confine it to suitable navigation/control surfaces and test readability over the map and photos. Task descriptions, offers, prices, and agreement terms need stable readable content surfaces.

## S22 — Apple haptics

**Sources:** [HIG playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics); [official JSON read](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/playing-haptics.json).

**Supported:** Change date 7 May 2024. Apple recommends consistent meanings, complementary visual/audio feedback, short app haptics for discrete events, avoiding overuse, and the ability to mute or disable haptics. Hardware support varies.

**Limits:** Haptics cannot be the only indication of a completed business action. Standard success, warning, error, selection, and impact patterns should retain their documented meanings. A mockup cannot verify physical feel.

**USKOČI implication:** Provide restrained selection feedback and confirm consequential successful actions only after actual confirmation. Match warning/error feedback to visible explanation and recovery. The experience must remain fully understandable with haptics disabled; test on supported hardware.

## S23 — Nielsen Norman Group progressive disclosure

**Source:** [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).

**Supported:** Jakob Nielsen, 3 December 2006. The article recommends initially showing frequently needed/core options and making advanced or rarely used options available through a clear secondary path. It stresses getting the initial/secondary split right.

**Limits:** This is expert guidance, not a current randomized study of USKOČI. Progressive disclosure is not a license to hide decision-critical information or make frequent tasks require extra steps. Age alone does not invalidate the principle, but contemporary application needs testing.

**USKOČI implication:** Keep scope, total amount, timing, location context, and the meaning of acceptance visible at the decision point. Move optional detail or infrequent settings behind clear labels. Test whether users can still predict consequences without opening every secondary panel.

## S24 — Nielsen Norman Group bottom sheets

**Source:** [Bottom Sheets: Definition and UX Guidelines](https://www.nngroup.com/articles/bottom-sheet/).

**Supported:** Page Laubheimer, 11 June 2023. Bottom sheets provide temporary contextual detail/actions and can preserve visible background context. Modal and nonmodal versions behave differently. Reported problems include unclear dismissal, stacked sheets, and obscured relevant content.

**Limits:** The source explicitly rejects the assumption that the bottom of a phone is universally easiest to reach; grip varies. It does not prove bottom sheets always outperform full screens, and does not supply a quantitative maximum workflow length.

**USKOČI implication:** A map's compact task preview or short contextual choice is a reasonable sheet candidate. Complex offer creation, multi-step editing, or full agreement review needs enough stable space and predictable navigation. Define dismissal, draft preservation, keyboard behavior, and accessible focus; avoid cascading sheets.

## S25 — Nielsen Norman Group executing UX animations

**Source:** [Executing UX Animations: Duration and Motion Characteristics](https://www.nngroup.com/articles/animation-duration/).

**Supported:** Page Laubheimer, 9 February 2020. The article specifies trigger, transformed properties, duration, and easing; it recommends accounting for frequency, accessibility, distance, and complexity. It gives timing ranges as practical guidance and encourages experimentation.

**Limits:** Suggested durations are not universal empirically optimal constants. Some technical performance remarks are from 2020 and should not be treated as current runtime facts without profiling. Platform parameters do not transfer by name alone.

**USKOČI implication:** Define a motion contract for each interaction: cause, semantic purpose, property, response, interruption, and reduced-motion alternative. Start short and test repeated use on physical devices. Use native-consistent navigation; reserve distinctive brand motion for infrequent moments where it helps comprehension or recognition.

## Sažetak korekcija za plan USKOČI-ja

- Većina navoda S01–S25 je podržana u okviru vrste dokaza koja je navedena. S02 i S03 ostaju provere autorskih sažetaka; to nije provera pune metodologije niti ponavljanje eksperimenata.
- S05 treba precizirati: 8.906 prijavljenih, 6.714 završilo; poziv je poslat korisnicima koji su se izjasnili kao stanovnici SAD. Reputacija utiče na poverenje, ali ne potvrđuje bezbednost konkretne osobe.
- S08 nazvati stručnim benchmarkom 30 izabranih prodajnih aplikacija, zasnovanim na usability istraživanju. Ocene elemenata nisu broj učesnika; nalaz nije procena svih mobilnih aplikacija.
- S10 ima tačan datum ažuriranja 29.04.2026. S14 ima HIG datum izmene 16.12.2025. Godine u copyright podnožju nisu datumi novih studija.
- Sačuvati granice koje dokument već dobro postavlja: 119 u S03 označava snimke ekrana; 2.3.3 je AAA; WCAG2ICT je informativan; 48 dp nije 48 fizičkih piksela.
- Ni S01 ni S02 ne opravdavaju promenu identiteta USKOČI-ja. Njihova korisna primena je testiranje hijerarhije, čitljivosti, grupisanja i vidljivosti radnji. Procenti tuđeg istraživanja nisu obećanje rezultata USKOČI-ja.
- Premium kvalitet najčvršće podržavaju stabilna navigacija, čitljiv tekst pri uvećanju, potpuni uslovi pre potvrde, kontrolisani AI predlozi, vidljivi filteri, kratke prekidive animacije i pouzdana povratna informacija. Tačne kompozicije i lokalnu terminologiju i dalje treba proveriti sa korisnicima.
