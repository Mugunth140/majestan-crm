"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { TaskCreateForm } from "@/components/tasks/task-create-form";

export default function NewTaskPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem("crm_user");
      if (u) setUser(JSON.parse(u));
    } catch {}
  }, []);

  const canCreate = user?.role === "Admin" || user?.role === "Manager" || user?.role === "Team Lead";

  if (user && !canCreate) {
    router.replace("/tasks");
    return null;
  }

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      <MobileHeader title="Create Task" />
      <div className="px-4 md:px-0">

        {/* Desktop back + header */}
        <div className="hidden md:flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 rounded-xl bg-muted hover:bg-muted/80 active:scale-95 transition-transform">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-[28px] font-bold tracking-tight">Create Task</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Set monthly targets for a staff member</p>
          </div>
        </div>

        {/* Mobile back */}
        <div className="md:hidden flex items-center gap-2 mb-4">
          <button onClick={() => router.back()} className="p-2 rounded-xl bg-muted active:scale-95">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted-foreground">Back to Tasks</span>
        </div>

        <div className="max-w-2xl">
          {user && canCreate && (
            <TaskCreateForm userRole={user.role} userDeptId={user.department_id} />
          )}
        </div>
      </div>
    </div>
  );
}
