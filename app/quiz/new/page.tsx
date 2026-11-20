import { chapterList, questionCounts } from "@/lib/cached";
import { requireUser } from "@/lib/supabase/server";
import QuizBuilder from "@/components/QuizBuilder";

export const dynamic = "force-dynamic";

export default async function NewQuiz() {
  await requireUser();
  const [rows, counts] = await Promise.all([chapterList(), questionCounts()]);
  const chapters = rows.map((c) => ({
    id: c.id, book: c.book, std: c.std, term: c.term, subject: c.subject, section: c.section ?? null, no: c.chapter_no, title: c.title_ta, n: counts[c.id] ?? 0,
  }));
  return (
    <div className="space-y-4">
      <h1 className="h1">வினாத்தாள் உருவாக்கு</h1>
      <p className="muted">வகுப்பு → பாடம் → பிரிவு → பாடங்கள் → எண்ணிக்கை, கடினம். வினாக்கள் தேர்ந்தெடுத்த பாடங்களின் பாடநூல் உரையிலிருந்து மட்டுமே.</p>
      {chapters.length ? <QuizBuilder chapters={chapters} /> : <p className="card">பாடநூல்கள் இன்னும் ஏற்றப்படவில்லை. ஏற்றப்பட்ட பிறகு இங்கே வகுப்புகள் தோன்றும்.</p>}
    </div>
  );
}
