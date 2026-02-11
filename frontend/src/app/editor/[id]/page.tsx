import { WorkflowEditor } from "@/components/editor/WorkflowEditor";

export default async function EditorByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkflowEditor workflowId={id} />;
}
