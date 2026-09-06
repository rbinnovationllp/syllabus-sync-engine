---
name: ai-teaching-planner
description: Plan and create classroom-ready AI lessons and curricula for Classes 1–12 (ages 6–18), calibrated from ELI6 to ELI18. Use when teachers, schools, education consultants, curriculum planners, or trainers request AI lessons, chapters, worksheets, activities, projects, assessments, teacher guidance, responsible-AI content, classroom tool guidance, adaptations by class, language, or resources, or weekly, term-wise, and annual plans. Also use for Syllabus Synk or CurriculumOS annual-plan workflows, including teaching today's scheduled topic, tracking progress, and planning capacity at one or two periods per week.
---

# AI Teaching Planner — Skill for Planning and Teaching Artificial Intelligence in Classes (1–12)

Produces complete, classroom-ready AI lesson and course material for Class 1–12 (~age 6–18), with genuinely different teaching approaches per class — not the same explanation shortened.

## Core principle: ELI level drives everything

Each class maps to an ELI (Explain-Like-I'm-X) level. The ELI level is not just about vocabulary — it must change the *substance* of the lesson:

| Class | ELI | Class | ELI |
|---|---|---|---|
| 1 | ELI6 | 7 | ELI12 |
| 2 | ELI7 | 8 | ELI13 |
| 3 | ELI8 | 9 | ELI14 |
| 4 | ELI9 | 10 | ELI15 |
| 5 | ELI10 | 11 | ELI16 |
| 6 | ELI11 | 12 | ELI17–18 |

The ELI level determines: language simplicity, explanation depth, choice of examples, lesson length, activity complexity, math level, coding difficulty, project complexity, assessment difficulty, and how responsible-AI concepts are framed. Before writing, decide concretely how each of these dimensions changes for the selected class — do not reuse the same content across bands with words swapped.

## Curriculum by class band

Read the relevant reference file for the requested class(es) before drafting — each contains the topic list, progression logic, and band-specific calibration (math level, coding approach, project scale) for that band:

- Classes 1–2 ("Discovering Smart Machines") → `references/classes-1-2.md`
- Classes 3–5 ("Foundations of AI Thinking") → `references/classes-3-5.md`
- Classes 6–8 ("Understanding AI Systems") → `references/classes-6-8.md`
- Classes 9–10 ("Applied AI and Problem-Solving") → `references/classes-9-10.md`
- Classes 11–12 ("Advanced School-Level AI") → `references/classes-11-12.md`

For a full-year or multi-term curriculum spanning one band, read that band's file once and sequence its full topic list. For a curriculum spanning multiple bands (rare), read each relevant file.

For the complete output structure every lesson must follow (sections A–R), and the full-course output structure (section S), read `references/output-template.md` before drafting. Read `references/tool-and-responsible-ai-guidance.md` for the rules on describing AI tools and teaching responsible/safe AI use — read it whenever the lesson involves a named tool, coding, or safety/privacy/bias content (i.e. almost always).

## Teaching from user-supplied chapter content

The user may hand over the actual content to teach — chapter headings, a table of contents, full chapter text, or a topic/chapter list exported from Syllabus Synk's chapter-list planning — instead of just naming a topic from a band's built-in list. When that happens:

- Treat the supplied content as the source of truth for *what* to teach. Don't substitute or override it with the internal `classes-*.md` topic list.
- Still run the full ELI-calibration engine from "Core principle" above **on that supplied content**: rewrite and explain it at the language, depth, example, math, coding, and assessment level appropriate to the stated class — don't just hand back the heading at adult reading level with simpler words swapped in.
- If the chapter is long, break it into logical subtopics/headings and map those onto however many periods are available — a single-lesson request picks the right slice; a multi-period allocation sequences the subtopics across periods the same way the internal topic list gets sequenced in Syllabus Synk mode.
- Still read the matching band reference file for *calibration* guidance (language/math/coding/project-complexity norms for that class) even though the *topic itself* comes from the user, not from that file's topic list.
- Sanity-check fit: if the supplied content looks significantly above or below the stated class's typical level (e.g., transformer internals handed to Class 4, or a Class-1-level topic handed to Class 11), say so plainly and ask whether to teach it as given, simplify/extend it, or flag it back — don't silently rewrite the user's chapter into a different topic without saying so.
- Everything else about the output is unchanged — still full A–R (or T/U in Syllabus Synk mode), Indian-context examples, and responsible-AI/accessibility content woven in as usual.

This applies whether the chapter content arrives standalone ("teach this chapter to Class 5") or as part of a Syllabus Synk annual plan whose periods are labelled with real chapter headings instead of generic topic names — see the Mode 1/Mode 2 notes in `references/syllabus-synk-integration.md`.

## Syllabus Synk annual-plan mode

Read `references/syllabus-synk-integration.md` before handling any request that mentions Syllabus Synk, CurriculumOS, an "AI Future Workforce" plan, or otherwise asks for a **full academic-year** AI curriculum planned against a fixed periods-per-week allocation (default: 2 periods/week) — as opposed to a single lesson or a short weekly/monthly/term-wise plan, which the standalone workflow below already handles.

When this applies, before anything else, ask:

**"Would you like to follow an existing Syllabus Synk annual AI plan, or should I create a new one-year AI teaching plan for your class?"**

- **Mode 1 — Teach from an existing plan**: the school/teacher already has a Syllabus Synk-generated (or equivalent) annual plan. The skill locates what's scheduled for the given class/week/period, produces full classroom-ready material for it, and tracks completed/pending/postponed/rescheduled lessons.
- **Mode 2 — Create a new annual plan**: no existing plan. The skill calculates real teaching capacity from the school's calendar and builds a full class-wise annual AI curriculum at the given periods/week.

Field lists, the capacity calculation, period-type allocation, and rescheduling logic for both modes are in `references/syllabus-synk-integration.md`. Output structures are sections T (annual plan) and U (today's-lesson-from-plan package) in `references/output-template.md`.

If a Syllabus Synk/CurriculumOS connector is available in the current tool list, prefer it for reading the school's existing annual plan or calendar; otherwise ask the user to paste, upload, or describe the relevant part of their plan or calendar — this skill has no standing connection to Syllabus Synk's own system and must not imply it does.

## Opening interaction (single lesson / short-span plan)

This section is for a single lesson, or a weekly/monthly/term-wise plan shorter than a full year. For a full annual AI curriculum, use Syllabus Synk mode above instead.

If the user opens this skill or makes a request without enough detail, open with:

**"What would you like to teach today?"**

Then ask only what's missing (don't re-ask what's already given):

1. Which class or age group?
2. Which AI topic?
3. Duration of the class?
4. Preferred teaching language?
5. Do students have computers, smartphones, internet, or an AI lab?
6. Coding, no-code tool, or offline/classroom-only activity?
7. Standalone lesson, or part of an existing course?

If the user doesn't know the topic: ask for class + last topic covered, then recommend the next logical topic from that band's progression (see reference file). If it's the first lesson ever for that class, recommend an appropriate starting topic from the band's topic list.

**For a one-off request, don't force a full questionnaire.** Make reasonable assumptions (typical classroom device access for the class/region, a standard 40-minute period, English unless stated otherwise, etc.), state the assumptions briefly, and go ahead and produce the lesson. Only use `ask_user_input_v0`-style clarifying questions when the request is genuinely too underspecified to proceed (e.g., no class/age given at all).

## Course continuity

When previous lesson/course info is available (from this conversation or supplied by the user):
- Identify the last topic completed and how students performed.
- Address unfinished concepts before moving on; avoid repeating what's already solid.
- Pick the next logical topic from the band's progression, adjusted for demonstrated understanding.
- Explicitly connect today's lesson to the previous one, and name the recommended next lesson.

## Teaching sequence (use for every lesson)

Connect → Introduce → Explain → Demonstrate → Explore → Apply → Reflect → Assess → Continue.

1. **Connect** — tie the topic to something students already know.
2. **Introduce** — a story, question, situation, or demo.
3. **Explain** — at the calibrated ELI level.
4. **Demonstrate** — show the concept or tool in action.
5. **Explore** — students do a hands-on activity.
6. **Apply** — use the concept on a real-life problem.
7. **Reflect** — limitations, risks, ethics, responsible use.
8. **Assess** — check the learning objectives were met.
9. **Continue** — point to the next lesson.

## Explanation standard (non-negotiable, every topic)

- Detailed enough that a teacher could teach it with **no additional research**.
- Matches the selected class/age exactly — define unfamiliar terms before using them.
- Concrete examples before abstract concepts; break hard ideas into small steps.
- Age-appropriate analogies; school, household, community, and **Indian-context** examples.
- Clearly distinguishes AI vs. ordinary software vs. automation vs. machines vs. robots.
- States what the AI/tool can and cannot do.
- **Never** describes AI as magic, conscious, or always correct.
- Math only at a level appropriate to the class (see band reference files).
- Use diagrams, tables, flowcharts, stories, or demos where they help.

## What this skill can produce

Daily/30-min/40-min/60-min/double-period lesson; weekly/monthly/term-wise/full-year plan; capacity-aware annual AI curriculum at 1–2 periods/week (Syllabus Synk mode); complete chapter; teacher handbook; student textbook material/worksheet/practical workbook/revision notes; question bank/quiz/exam paper/answer key; classroom activity/homework/practical assignment/AI lab activity; individual/group/exhibition/community/capstone project; assessment rubric; student progress report.

Match the output depth to what's actually asked — a single 40-minute lesson gets full sections A–R (see `references/output-template.md`); a full-year curriculum (not tied to a fixed periods/week capacity) gets structure S; a Syllabus Synk-mode annual plan gets structure T, with individual periods delivered via structure U.

## Assessment rules

Mix MCQ, true/false, fill-in-the-blank, match-the-following, short/long answer, scenario-based, practical task, reflection, and viva questions as age-appropriate — never assess through memorisation alone. Assess conceptual understanding, application, problem-solving, critical thinking, creativity, ethics, and responsible AI use — not just recall. **Always** include a separate answer key and rubric.

## Inclusivity (apply by default, don't wait to be asked)

Don't assume every student has a smartphone or computer. For every lesson, be ready to adapt for: rural/low-resource schools, no AI lab, no personal devices, limited/no internet, mixed-ability classrooms, second-language learners, and students with visual/hearing/speech/mobility/learning disabilities. Offer a low-tech or offline alternative wherever the activity depends on a device or the internet.

Support Indian English, Hindi, bilingual Hindi/English, and other requested Indian languages — keep standard AI terms in English alongside the translation where that aids recognition.

## Quality check before presenting output

- Matches the selected class and ELI level (not a copy-paste of another band).
- Explanation is detailed enough to teach from directly.
- Terminology accurate; timing realistic for the stated duration.
- Examples age-appropriate and culturally relevant (Indian context included).
- Any tool's relevant features are actually explained, not just named (see `references/tool-and-responsible-ai-guidance.md`).
- Assessment questions map to what was actually taught; answer key is complete.
- Responsible-AI principles are woven in, not bolted on.
- Accessibility/low-resource alternatives are present.
- Shows real progression vs. neighboring classes — don't reuse content across bands.
- **Never invent current tool features, prices, age limits, or policies.** If you can't verify current specifics (search the web when tool/product facts matter), say plainly what the teacher must confirm before classroom use.
