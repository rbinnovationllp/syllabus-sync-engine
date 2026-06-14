import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireActiveSubscription, DEMO_WATERMARK_TEXT } from "@/lib/subscription-gate";

const yearInput = z.object({ year_id: z.string().uuid() });

async function loadAll(supabaseAdmin: any, userId: string, yearId: string) {
  const [yearRes, calendarRes, curriculaRes] = await Promise.all([
    supabaseAdmin
      .from("academic_years")
      .select("*, schools(name,country,board)")
      .eq("id", yearId).eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("annual_calendars").select("*").eq("year_id", yearId).maybeSingle(),
    supabaseAdmin.from("subject_curricula").select("*").eq("year_id", yearId).order("grade").order("subject"),
  ]);
  if (!yearRes.data) throw new Error("Year not found");
  return {
    year: yearRes.data,
    calendar: calendarRes.data,
    curricula: curriculaRes.data ?? [],
  };
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // Buffer is available in the worker runtime via nodejs_compat
  return Buffer.from(bin, "binary").toString("base64");
}

export const exportYearPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => yearInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const gate = await requireActiveSubscription(supabase, userId);
    const unpaid = !gate.ok;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { year, calendar, curricula } = await loadAll(supabaseAdmin, userId, data.year_id);

    const { PDFDocument, StandardFonts, rgb, degrees } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const lineH = 14;

    function newPage() {
      const page = pdf.addPage([595, 842]); // A4
      if (unpaid) {
        const text = DEMO_WATERMARK_TEXT;
        const w = font.widthOfTextAtSize(text, 50);
        page.drawText(text, {
          x: (595 - w) / 2 + 100,
          y: 400,
          size: 50,
          font: bold,
          color: rgb(0.85, 0.85, 0.85),
          rotate: degrees(-30),
          opacity: 0.4,
        });
      }
      return page;
    }

    let page = newPage();
    let y = 800;
    const margin = 50;
    const wrap = (text: string, size = 10, max = 495) => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const trial = cur ? cur + " " + w : w;
        if (font.widthOfTextAtSize(trial, size) > max) { lines.push(cur); cur = w; } else { cur = trial; }
      }
      if (cur) lines.push(cur);
      return lines;
    };
    const draw = (text: string, opts: { size?: number; bold?: boolean } = {}) => {
      const size = opts.size ?? 10;
      const f = opts.bold ? bold : font;
      for (const line of wrap(text, size)) {
        if (y < 50) { page = newPage(); y = 800; }
        page.drawText(line, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.15) });
        y -= size + 4;
      }
    };

    draw(`CurriculumOS — ${year.label}`, { size: 18, bold: true });
    draw(`${year.schools?.name ?? ""} · ${year.schools?.country ?? ""} · ${(year.schools?.board ?? "").toUpperCase()}`, { size: 10 });
    y -= 8;

    if (calendar?.plan) {
      draw("Annual Calendar", { size: 14, bold: true });
      const months = (calendar.plan as any).months ?? [];
      for (const m of months) {
        draw(`${m.label || m.month} — ${m.teaching_days} teaching days`, { size: 11, bold: true });
        if (m.focus_topics?.length) draw(`Focus: ${m.focus_topics.join(", ")}`);
        if (m.assessments?.length) draw(`Assessments: ${m.assessments.join(", ")}`);
        if (m.events?.length) draw(`Events: ${m.events.join(", ")}`);
        if (m.notes) draw(`Notes: ${m.notes}`);
        y -= 4;
      }
    } else {
      draw("(Annual calendar has not been generated yet.)", { size: 10 });
    }

    for (const c of curricula) {
      page = newPage(); y = 800;
      draw(`Grade ${c.grade} · ${c.subject}`, { size: 14, bold: true });
      const chapters = (c.chapters as any[]) ?? [];
      for (const ch of chapters) {
        draw(`${ch.seq}. ${ch.title}  (wk ${ch.week_no} · ${ch.periods} pds · ${ch.difficulty})`, { size: 11, bold: true });
        if (ch.objectives?.length) draw(`Objectives: ${ch.objectives.join("; ")}`);
        if (ch.assessment) draw(`Assessment: ${ch.assessment}`);
        if (ch.notes) draw(`Notes: ${ch.notes}`);
        y -= 3;
      }
    }

    const bytes = await pdf.save();
    await supabaseAdmin.rpc("record_export", { _user_id: userId });
    return {
      filename: `${year.label.replace(/[^\w-]+/g, "_")}.pdf`,
      mime: "application/pdf",
      base64: toBase64(bytes),
      unpaid,
    };
  });

export const exportYearDocx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => yearInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const gate = await requireActiveSubscription(supabase, userId);
    const unpaid = !gate.ok;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { year, calendar, curricula } = await loadAll(supabaseAdmin, userId, data.year_id);

    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Header, AlignmentType } = await import("docx");

    const children: any[] = [];
    children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(`CurriculumOS — ${year.label}`)] }));
    children.push(new Paragraph({ children: [new TextRun(`${year.schools?.name ?? ""} · ${year.schools?.country ?? ""} · ${(year.schools?.board ?? "").toUpperCase()}`)] }));
    children.push(new Paragraph({ children: [new TextRun("")] }));

    if (calendar?.plan) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Annual Calendar")] }));
      for (const m of (calendar.plan as any).months ?? []) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(`${m.label || m.month} — ${m.teaching_days} teaching days`)] }));
        if (m.focus_topics?.length) children.push(new Paragraph({ children: [new TextRun({ text: "Focus: ", bold: true }), new TextRun(m.focus_topics.join(", "))] }));
        if (m.assessments?.length) children.push(new Paragraph({ children: [new TextRun({ text: "Assessments: ", bold: true }), new TextRun(m.assessments.join(", "))] }));
        if (m.events?.length) children.push(new Paragraph({ children: [new TextRun({ text: "Events: ", bold: true }), new TextRun(m.events.join(", "))] }));
        if (m.notes) children.push(new Paragraph({ children: [new TextRun({ text: "Notes: ", italics: true }), new TextRun(m.notes)] }));
      }
    }

    for (const c of curricula) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Grade ${c.grade} · ${c.subject}`)] }));
      for (const ch of ((c.chapters as any[]) ?? [])) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(`${ch.seq}. ${ch.title} (wk ${ch.week_no} · ${ch.periods} pds · ${ch.difficulty})`)] }));
        if (ch.objectives?.length) children.push(new Paragraph({ children: [new TextRun({ text: "Objectives: ", bold: true }), new TextRun(ch.objectives.join("; "))] }));
        if (ch.assessment) children.push(new Paragraph({ children: [new TextRun({ text: "Assessment: ", bold: true }), new TextRun(ch.assessment)] }));
        if (ch.notes) children.push(new Paragraph({ children: [new TextRun(ch.notes)] }));
      }
    }

    const sectionHeader = unpaid
      ? {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: DEMO_WATERMARK_TEXT, color: "BBBBBB", bold: true, size: 32 })],
              }),
            ],
          }),
        }
      : undefined;

    const doc = new Document({
      styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
      },
      sections: [{ headers: sectionHeader, children }],
    });

    const bytes = await Packer.toBuffer(doc);
    await supabaseAdmin.rpc("record_export", { _user_id: userId });
    return {
      filename: `${year.label.replace(/[^\w-]+/g, "_")}.docx`,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      base64: toBase64(new Uint8Array(bytes)),
      unpaid,
    };
  });
