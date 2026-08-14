"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronDown, ChevronUp, Target } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormSelect } from "@/components/shared/form-select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MetricDef {
  key: string;
  label: string;
  value_type: "count" | "amount";
  tracking_type: "auto" | "manual";
}

interface MetricEntry extends MetricDef {
  monthly_target: string;
  showWeekly: boolean;
  weekly_overrides: Record<number, string>;
}

export function TaskCreateForm({ userRole, userDeptId }: { userRole: string; userDeptId: number }) {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

  const [departments, setDepartments] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [selectedDeptName, setSelectedDeptName] = useState<string>("");
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [title, setTitle] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetchingStaff, setFetchingStaff] = useState(false);
  const [error, setError] = useState("");

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthDisplay = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  useEffect(() => {
    apiFetch(`${API}/departments`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          let depts = d.data || [];
          if (userRole === "Team Lead") {
            depts = depts.filter((dep: any) => dep.id === userDeptId);
          }
          setDepartments(depts);
          if (userRole === "Team Lead" && depts.length > 0) {
            handleDeptChange(String(depts[0].id), depts[0].name);
          }
        }
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeptChange = async (deptId: string, deptName?: string) => {
    setSelectedDeptId(deptId);
    setSelectedStaff("");
    setMetrics([]);

    const dept = departments.find((d: any) => String(d.id) === deptId);
    const name = deptName || dept?.name || "";
    setSelectedDeptName(name);
    setTitle(`${name} Tasks – ${currentMonth}`);

    setFetchingStaff(true);
    try {
      const r = await apiFetch(`${API}/users?department_id=${deptId}&role=Staff`);
      const d = await r.json();
      setStaffList(d.data || d.users || []);
    } catch {
      setStaffList([]);
    } finally {
      setFetchingStaff(false);
    }

    try {
      const lower = name.toLowerCase().trim().replace(/\s+department$/i, "").replace(/\s+dept$/i, "").trim();
      const norm = lower.includes("digital") ? "digital" : lower === "human resources" || lower === "human resource" ? "hr" : lower;
      const r = await apiFetch(`${API}/tasks/metrics/${encodeURIComponent(norm)}`);
      const d = await r.json();
      const metricDefs: MetricDef[] = d.data || [];
      setMetrics(
        metricDefs.map((m) => ({
          ...m,
          monthly_target: "",
          showWeekly: false,
          weekly_overrides: {},
        }))
      );
    } catch {
      setMetrics([]);
    }
  };

  const computeWeeklySplit = (monthlyTarget: number): Record<number, number> => {
    const base = Math.floor(monthlyTarget / 4);
    const rem = monthlyTarget - base * 3;
    return { 1: base, 2: base, 3: base, 4: rem };
  };

  const updateMetricTarget = (key: string, value: string) => {
    setMetrics((prev) => prev.map((m) => (m.key === key ? { ...m, monthly_target: value } : m)));
  };

  const toggleWeekly = (key: string) => {
    setMetrics((prev) => prev.map((m) => (m.key === key ? { ...m, showWeekly: !m.showWeekly } : m)));
  };

  const updateWeeklyOverride = (key: string, week: number, value: string) => {
    setMetrics((prev) =>
      prev.map((m) =>
        m.key === key ? { ...m, weekly_overrides: { ...m.weekly_overrides, [week]: value } } : m
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId || !selectedStaff) {
      toast.error("Select a department and staff member");
      return;
    }
    const metricsPayload = metrics
      .filter((m) => m.monthly_target && parseFloat(m.monthly_target) > 0)
      .map((m) => {
        const monthly = parseFloat(m.monthly_target);
        const hasOverrides = Object.keys(m.weekly_overrides).length > 0;
        return {
          key: m.key,
          monthly_target: monthly,
          ...(hasOverrides && {
            weekly_overrides: Object.fromEntries(
              Object.entries(m.weekly_overrides).map(([k, v]) => [k, parseFloat(v) || 0])
            ),
          }),
        };
      });

    if (metricsPayload.length === 0) {
      toast.error("Enter at least one metric target");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`${API}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_id: Number(selectedDeptId),
          assigned_to: Number(selectedStaff),
          title,
          metrics: metricsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create task");
      toast.success("Task created successfully");
      router.push("/tasks");
    } catch (err: any) {
      setError(err.message || "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
      {/* Left Column - Configuration */}
      <div className="w-full lg:w-[350px] xl:w-[400px] shrink-0 bg-card border border-border/60 rounded-xl p-5 md:p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border/50">
          <h2 className="font-bold text-[15px] text-foreground">Task Details</h2>
          <Badge className="bg-[#0052FF]/10 text-[#0052FF] border-[#0052FF]/20 font-semibold text-[11px] px-2.5 py-0.5">
            {monthDisplay}
          </Badge>
        </div>

        {/* Department selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Department
          </label>
          <FormSelect
            name="department"
            placeholder="Select department..."
            options={departments.map((d: any) => ({ label: d.name, value: String(d.id) }))}
            value={selectedDeptId || null}
            onValueChange={(v) => {
              const dept = departments.find((d: any) => String(d.id) === v);
              handleDeptChange(v, dept?.name);
            }}
            disabled={userRole === "Team Lead"}
          />
        </div>

        {/* Staff selector */}
        {selectedDeptId && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Assign To (Staff)
            </label>
            {fetchingStaff ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground h-12 px-3 rounded-xl bg-muted/30 border border-border/60">
                <Loader2 className="w-4 h-4 animate-spin text-[#0052FF]" /> Loading staff...
              </div>
            ) : (
              <FormSelect
                name="staff"
                placeholder="Select staff member..."
                options={staffList.map((s: any) => ({ label: s.name, value: String(s.id) }))}
                value={selectedStaff || null}
                onValueChange={setSelectedStaff}
              />
            )}
          </div>
        )}

        {/* Title */}
        {selectedStaff && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Task Title
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 rounded-xl bg-muted/30 border-border/60 text-[15px]"
            />
          </div>
        )}

        {/* Desktop Submit Button */}
        {metrics.length > 0 && (
          <div className="hidden lg:block pt-6 border-t border-border/50">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200/60 rounded-xl px-4 py-3 mb-4">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-[#0052FF] hover:bg-[#0040CC] text-white font-semibold text-[15px] shadow-md active:scale-[0.98] transition-transform"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {loading ? "Creating..." : "Create Task"}
            </Button>
          </div>
        )}
      </div>

      {/* Right Column - Metrics */}
      <div className="flex-1 min-w-0 w-full">
        {metrics.length > 0 ? (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                Monthly Targets
              </h3>
              <span className="text-xs text-muted-foreground font-medium">Weekly split shown automatically</span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {metrics.map((m) => {
                const monthly = parseFloat(m.monthly_target) || 0;
                const split = monthly > 0 ? computeWeeklySplit(monthly) : null;
                return (
                  <div key={m.key} className="bg-card border border-border/60 rounded-xl shadow-sm p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[14px] font-semibold text-foreground truncate block w-full">{m.label}</span>
                          <div className="flex gap-1.5 mt-0.5">
                            {m.tracking_type === "auto" && (
                              <Badge className="bg-blue-50 text-blue-600 border-blue-200/60 text-[9px] px-1.5 font-bold uppercase tracking-wider dark:bg-blue-900/20">
                                auto
                              </Badge>
                            )}
                            {m.value_type === "amount" && (
                              <Badge className="bg-purple-50 text-purple-600 border-purple-200/60 text-[9px] px-1.5 font-bold uppercase tracking-wider dark:bg-purple-900/20">
                                ₹ amount
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={m.monthly_target}
                        onChange={(e) => updateMetricTarget(m.key, e.target.value)}
                        placeholder="0"
                        className="w-28 h-10 rounded-xl bg-muted/30 border-border/60 text-sm text-right font-semibold shadow-inner focus:bg-background"
                      />
                    </div>

                    {/* Weekly preview / editor */}
                    {split && (
                      <div className="pt-3 border-t border-border/40">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Weekly Split</span>
                          <button
                            type="button"
                            onClick={() => toggleWeekly(m.key)}
                            className="flex items-center gap-1 text-[11px] text-[#0052FF] font-semibold hover:text-[#0040CC] transition-colors"
                          >
                            {m.showWeekly ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {m.showWeekly ? "Hide" : "Edit"}
                          </button>
                        </div>

                        {m.showWeekly ? (
                          <div className="grid grid-cols-4 gap-2">
                            {[1, 2, 3, 4].map((w) => (
                              <div key={w} className="text-center">
                                <div className="text-[10px] text-muted-foreground font-medium mb-1.5">Wk {w}</div>
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={
                                    m.weekly_overrides[w] !== undefined
                                      ? m.weekly_overrides[w]
                                      : String(split[w] || 0)
                                  }
                                  onChange={(e) => updateWeeklyOverride(m.key, w, e.target.value)}
                                  className="h-9 rounded-lg bg-background border-border/60 text-xs text-center px-1 font-semibold"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {[1, 2, 3, 4].map((w) => (
                              <div
                                key={w}
                                className="flex-1 text-center bg-muted/30 rounded-lg py-1.5 px-1 border border-border/40"
                              >
                                <div className="text-[9px] text-muted-foreground font-medium mb-0.5">Wk {w}</div>
                                <div className="text-[11px] font-bold tabular-nums text-foreground/80">{split[w]}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mobile Submit Button */}
            <div className="lg:hidden pt-4">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200/60 rounded-xl px-4 py-3 mb-4">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-[#0052FF] hover:bg-[#0040CC] text-white font-semibold text-[15px] shadow-md active:scale-[0.98] transition-transform"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {loading ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-xl bg-muted/10 p-6 text-center">
            <div className="w-16 h-16 bg-card border border-border shadow-sm rounded-full flex items-center justify-center mb-4">
              <Target className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-[15px] font-semibold text-foreground mb-1">No Targets Available</p>
            <p className="text-[13px] text-muted-foreground max-w-sm">Select a department and staff member on the left to configure their monthly performance targets.</p>
          </div>
        )}
      </div>
    </form>
  );
}
