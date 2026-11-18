import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import TestRunner from "@/components/TestRunner";

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, user } = await requireUser();
  const { data: test } = await sb.from("tests").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!test) notFound();
  if (test.submitted_at) redirect(`/test/${id}/result`);
  const { data: qs } = await sb.from("questions").select("id,stem,options,unit_id,source_ref,origin").in("id", test.question_ids);
  const map = new Map((qs ?? []).map((q) => [q.id, q]));
  const questions = (test.question_ids as string[])
    .map((qid) => map.get(qid))
    .filter(Boolean)
    .map((q) => ({ id: q!.id, stem: q!.stem as string, options: q!.options as string[], unverified: q!.origin === "ai" && !q!.source_ref }));
  return <TestRunner testId={test.id} title={test.title} kind={test.kind} durationSec={test.duration_sec ?? questions.length * 54} startedAt={test.started_at} questions={questions} />;
}
