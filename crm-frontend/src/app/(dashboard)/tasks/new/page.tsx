"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Device } from "@/components/shared/device";
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

  const canCreate =
    user?.role === "Admin" || user?.role === "Manager" || user?.role === "Team Lead";

  if (user && !canCreate) {
    router.replace("/tasks");
    return null;
  }

  return (
    <>
      <MobileHeader title="Create Task" showBack />
      <div className="flex flex-col space-y-4 md:space-y-6 md:h-full">
        {/* Desktop page header */}
        <Device
          mobile={null}
          desktop={
            <div className="flex h-[48px] items-center pr-[150px] gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-full hover:bg-muted active:scale-95 transition-transform"
                title="Back to Tasks"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-[28px] font-bold tracking-tight">Create Task</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Set monthly targets for a staff member
                </p>
              </div>
            </div>
          }
        />

        {/* Content area - Full width without max-width wrapper */}
        <div className="px-4 md:px-0 pb-8">
          <div className="w-full">
            {user && canCreate && (
              <TaskCreateForm userRole={user.role} userDeptId={user.department_id} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
