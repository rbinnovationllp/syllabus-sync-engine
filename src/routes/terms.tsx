import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <section className="mx-auto max-w-5xl space-y-6">
        <Button asChild variant="outline">
          <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Back home</Link>
        </Button>

        <div>
          <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            <ShieldCheck className="mr-2 h-4 w-4" /> Terms, AI governance, and human review policy
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Terms & Conditions</h1>
          <p className="mt-2 text-slate-600">Last updated: July 2, 2026</p>
        </div>

        <Card>
          <CardHeader><CardTitle>AI-assisted planning tools</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
            <p>The platform provides AI-assisted recommendations, drafts, planning tools, and educational document generation for schools and authorized users.</p>
            <p>AI-generated content is provided as an educational planning aid only. While every effort is made to improve accuracy, the platform cannot guarantee that all information is complete, error-free, or suitable for every educational environment.</p>
            <p>Final academic, administrative, and operational decisions remain the responsibility of the school and its authorized personnel.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mandatory human review</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
            <p>Schools and users must independently review, verify, modify, and approve all generated outputs before implementation, including curriculum plans, lesson plans, academic calendars, training modules, worksheets, reports, class tests, and examination papers.</p>
            <p>The platform should not be used as a substitute for professional academic judgment, board requirements, school policies, or applicable legal and regulatory obligations.</p>
            <p>Use of the platform constitutes acceptance that AI-generated outputs require human validation before practical implementation.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Responsibility and limitation</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
            <p>The company shall not be held responsible for decisions made solely on the basis of AI-generated recommendations without proper human review and approval.</p>
            <p>The objective of review confirmations, disclaimers, and audit trails is not to transfer responsibility unfairly, but to ensure that users understand the platform is an assistant tool and that school-approved human review is required.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Audit trail and compliance records</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
            <p>The platform may record user login, logout, password reset, profile changes, content creation, editing, approval, deletion, downloads, subscription changes, and administrative actions.</p>
            <p>Audit records may include user name, user role, school name, date, time, action performed, device information, and IP address where legally permissible. These logs are retained according to the company data retention policy and are used for security, accountability, quality assurance, dispute resolution, and regulatory compliance.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>School data privacy, security, and confidentiality</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
            <p>All academic, administrative, student, teacher, examination, and operational data uploaded by a school remains the property of that respective school. Syllabus Synk acts only as a technology platform and custodian of the data.</p>
            <p>The company shall not sell, share, distribute, or use school data for commercial purposes without explicit authorization. Data access is restricted to authorized users and role-based permissions.</p>
            <p>Each school&apos;s data is designed to remain logically separated from every other school. Users of one school must never be able to view, search, export, or retrieve information belonging to another school.</p>
            <p>Company administrator access to school data should occur only when necessary for authorized support, troubleshooting, or maintenance, and such access should be recorded in audit logs where implemented.</p>
            <p>All school data stored within Syllabus Synk is protected using industry-standard security practices, access controls, encryption, monitoring, and backup systems. Each school&apos;s data remains isolated and confidential. The platform is designed to prevent unauthorized access, cross-school visibility, and accidental disclosure of information. School data remains the property of the respective institution.</p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
