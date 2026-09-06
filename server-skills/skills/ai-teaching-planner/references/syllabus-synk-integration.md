# Syllabus Synk (CurriculumOS) Integration

## What Syllabus Synk is (verified from syllabus-synk.in — re-check before quoting specifics, this may change)

Syllabus Synk is the product name for **CurriculumOS**, a capacity-aware academic-year planning tool for K-12 schools (boards include CBSE, ICSE, IB, Cambridge, and others), built by Rashi Bhartiya Innovation LLP. Its **AI Future Workforce** add-on generates grade-wise AI learning paths for Classes 1–12 at one or two AI periods per week, without displacing regular subject periods. Do not state its current pricing, plan tiers, or exact feature list as fact without verifying live — the public page does not itself list a fixed price, only "free pilot" language, and product details change. If a teacher asks for current pricing/signup specifics, say plainly that this must be confirmed on syllabus-synk.in or with their support contact rather than guessing.

This skill does **not** have a standing data connection to Syllabus Synk. If a Syllabus Synk/CurriculumOS connector appears in the available tools, use it to read the school's plan or calendar directly. Otherwise, always ask the user to paste, upload, or describe the relevant plan/calendar content — never fabricate what a school's specific Syllabus Synk plan contains.

## Mode selection

Always ask first (unless the user has already made the choice clear):

**"Would you like to follow an existing Syllabus Synk annual AI plan, or should I create a new one-year AI teaching plan for your class?"**

---

## Mode 1 — Teach from an existing annual plan

### Fields to collect (skip any already given)
1. Class
2. Academic year (e.g., 2026–27)
3. Current week (week number, or a date)
4. Teaching period (which period today, e.g., "Period 2" or "Tuesday AI period")
5. The relevant Syllabus Synk annual plan itself — ask the user to paste the schedule text/table, upload an export, or (if connected) fetch it via the connector. Do not proceed to "identify today's topic" on a guess if the plan content hasn't actually been provided. **Note**: Syllabus Synk plans a school's chapters from board structures or school-entered chapter lists/book details, so a period's entry may be a real chapter heading (or even full chapter content) rather than a generic topic label — that's expected, not an error. Accept it as-is.

### Identifying today's lesson
- Match class + week + period against the supplied plan to find the scheduled topic/chapter heading and period type (theory/practical/assessment/project/revision/buffer).
- If what's scheduled is a chapter heading or block of chapter content rather than a short topic name, follow the "Teaching from user-supplied chapter content" section of `../SKILL.md` — that content is the source of truth for what to teach; the band reference file only supplies calibration norms (language/math/coding level), not the topic itself.
- If the matched slot is a **buffer** or **revision** period, say so and offer either a revision-package output or ask whether the teacher wants to use the buffer for a specific purpose.
- If the plan and the stated current week/period don't align cleanly (e.g., the plan shows week 14 already covered but the teacher says they're only starting week 12's content), flag the mismatch rather than silently picking one — ask which is correct, or note the assumption you're making and proceed.

### Generating the lesson
- Once the topic is identified, produce the full lesson using the standard band reference file + `output-template.md` sections A–R (via structure U below), calibrated to the class's ELI level as usual.
- Follow the plan's topic sequence — don't skip ahead or repeat a topic the plan/tracker shows as completed unless the teacher indicates it needs reteaching.

### Tracking completed / pending / postponed / rescheduled
- Maintain a simple status table (completed / pending / postponed / rescheduled, with date and reason) whenever the user shares this information — offer to output it as a table the teacher can keep and paste back in next time, since this skill has no persistent access to the school's own tracker.
- On each new request, ask for (or accept if already given) the latest status update before recomputing what's next.

### Adjusting for holidays, exams, events, missed classes
When periods are lost:
1. **First absorb the loss into buffer and revision periods** already built into the plan — these exist for exactly this purpose.
2. If buffer is exhausted, look for adjacent topics within the same unit that can be **merged** into one period without dropping a learning outcome (e.g., two closely related sub-topics taught together).
3. If neither is enough to recover the lost time, **do not silently drop a learning outcome.** Tell the teacher explicitly which topics are now at risk of not fitting before the term/year end, and offer options: compress project scope, move an outcome to next term, or add periods.
4. Never resolve a shortfall by quietly skipping responsible-AI content, assessment, or the capstone/project component — these should be the last things cut, not the first.
5. After adjusting, restate the revised schedule for the affected weeks so the teacher can confirm it.

---

## Mode 2 — Create a new annual plan

### Fields to collect (skip any already given)
1. Class/grade (one or more)
2. Academic-session dates (start and end date — note the country/board convention, e.g., India typically runs April–March)
3. Applicable curriculum/board (CBSE, ICSE, state board, IB, Cambridge, other, or "none specified")
4. Periods per week for AI (default to 2 if not specified, since that's the Syllabus Synk baseline; confirm if 1/week instead)
5. Expected period duration (e.g., 40 minutes)
6. Holidays (list or a general pattern: summer break, winter break, festival holidays, etc.)
7. Examination periods (dates/weeks — these are typically non-teaching weeks for new content)
8. Available facilities (computer lab, internet, personal devices, none)
9. Students' prior AI knowledge (starting fresh, or continuing from a previous year — if continuing, ask what was already covered)
10. Preferred teaching language
11. Any other constraints (school events, staggered timetables, combined classes, etc.)
12. *Optional*: a chapter list or textbook table of contents, if the school wants the plan built around specific chapter headings (as Syllabus Synk's own chapter-list planning does) rather than this skill's default band topic list. If given, sequence the plan from that chapter list instead — apply the same capacity math and period-type allocation, but source topics from the supplied chapters, per "Teaching from user-supplied chapter content" in `../SKILL.md`. If not given, default to the band's internal topic list as before.

Don't force a full questionnaire for a rough draft request — make reasonable, stated assumptions (e.g., "assuming a standard April–March CBSE calendar with typical holidays; tell me the actual dates and I'll recalculate") and proceed, same as the single-lesson workflow.

### Capacity calculation
1. **Total span**: count weeks from session start to session end.
2. **Deduct non-teaching weeks**: summer/winter/other vacations, exam weeks (typically 1–2 weeks per exam cycle, often twice a year), school events/functions that consume the AI period, and any teacher-training or buffer weeks the school specifies.
3. **Net teaching weeks** = Total span − deducted weeks.
4. **Total AI periods available** = Net teaching weeks × periods/week.
5. Always show this arithmetic to the user — don't just state a final number. Example (illustrative only — always compute from the school's real dates): a ~48-week April–March session with ~6 weeks summer break, ~2 weeks winter break, ~4 weeks combined exam weeks, and ~2 weeks of other events leaves roughly 34 net teaching weeks → about 68 periods a year at 2/week. A real school's numbers will differ — compute fresh every time.

### Allocating period types
Distribute the total available periods across period types. These starting ratios are heuristics to adapt, not fixed rules — state them as a starting point and adjust to the school's stated priorities:

| Band | Topic delivery (theory+practical) | Revision | Assessment | Project/capstone | Buffer |
|---|---|---|---|---|---|
| Classes 1–2 | ~70% | ~10% | ~10% (mostly oral/observation) | — (folded into activities) | ~10% |
| Classes 3–5 | ~65% | ~10% | ~10% | ~5% (small projects) | ~10% |
| Classes 6–8 | ~60% | ~10% | ~10% | ~15% | ~5% |
| Classes 9–10 | ~50% | ~10% | ~10% | ~25% (AI project cycle needs sustained periods) | ~5% |
| Classes 11–12 | ~45% | ~10% | ~10% | ~30% (capstone) | ~5% |

Within "topic delivery," sequence periods using that band's topic list from the matching `references/classes-*.md` file, in order, allocating roughly 2–4 periods per topic depending on depth and how many total periods are available — compress toward 2 periods/topic if capacity is tight, expand toward 4 if there's room, and say which you're doing and why.

### Structuring the plan
- Organize week by week, period by period (see `output-template.md` section T for the exact fields).
- Clearly label every period's type: theory / practical / assessment / project / revision / buffer.
- Weave responsible-AI content into relevant topic periods throughout the year (per `tool-and-responsible-ai-guidance.md`) rather than isolating it into a single week.
- Progress foundational → advanced within the class's band, per that band's reference file — don't reorder the band's topic sequence without a stated reason.
- Include remedial/catch-up capacity: note in the plan that buffer periods can double as remedial periods if a class is behind, rather than only for scheduling slippage.

### Generating a specific day's material from a newly created plan
Once the annual plan exists (in this conversation or supplied by the user), treat any "what should I teach on week N / period N" request the same way as Mode 1's "identify today's lesson" step — locate the slot in the just-created plan and produce the full A–R lesson via structure U.
