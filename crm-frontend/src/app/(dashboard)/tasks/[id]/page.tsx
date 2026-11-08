"use client";
import { useParams } from "next/navigation";
import { useIsClient } from "@/hooks/use-is-client";
import { MobileHeader } from "@/components/layout/mobile-header";
import { TaskPage } from "@/components/tasks/targets-page";

export default function TaskDetailPage() {
  const ready = useIsClient();
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <MobileHeader title="Tasks" showBack />
      <div className="dash-palette">{ready && <TaskPage key={id} id={Number(id)} />}</div>
    </>
  );
}
