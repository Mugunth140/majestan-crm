"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

interface MetricDef {
  key: string;
  label: string;
  value_type: "count" | "amount";
  tracking_type: "auto" | "manual";
}

interface MetricEntry {
  key: string;
  label: string;
  value_type: "count" | "amount";
  tracking_type: "auto" | "manual";
  monthly_target: string; // string for input binding
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

  // Current month display
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthDisplay = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  // Load departments
  useEffect(() => {
    apiFetch(`${API}/departments`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          let depts = d.data || [];
          // Team Lead can only see their own department
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
  }, []);

  const handleDeptChange = async (deptId: string, deptName?: string) => {
    setSelectedDeptId(deptId);
    setSelectedStaff("");
    setMetrics([]);

    const dept = departments.find((d: any) => String(d.id) === deptId);
    const name = deptName || dept?.name || "";
    setSelectedDeptName(name);
    setTitle(`${name} Tasks – ${currentMonth}`);

    // Load staff for this department
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

    // Load metrics for this department
    try {
      // Normalize dept name: lowercase, strip trailing " department"/"dept", handle digital variants
      const lower = name.toLowerCase().trim().replace(/\s+department$/i, '').replace(/\s+dept$/i, '').trim();
      const norm = lower.includes('digital') ? 'digital' : lower === 'human resources' || lower === 'human resource' ? 'hr' : lower;
      const r = await apiFetch(`${API}/tasks/metrics/${encodeURIComponent(norm)}`);
      const d = await r.json();
      const metricDefs: MetricDef[] = d.data || [];
      setMetrics(metricDefs.map(m => ({
        ...m,
        monthly_target: "",
        showWeekly: false,
        weekly_overrides: {},
      })));
    } catch {
      setMetrics([]);
    }
  };

  const computeWeeklySplit = (monthlyTarget: number): Record<number, number> => {
    // Simple even split into 4 weeks (backend will re-compute with actual calendar weeks)
    const base = Math.floor(monthlyTarget / 4);
    const rem = monthlyTarget - base * 3;
    return { 1: base, 2: base, 3: base, 4: rem };
  };

  const updateMetricTarget = (key: string, value: string) => {
    setMetrics(prev => prev.map(m => m.key === key ? { ...m, monthly_target: value } : m));
  };

  const toggleWeekly = (key: string) => {
    setMetrics(prev => prev.map(m => m.key === key ? { ...m, showWeekly: !m.showWeekly } : m));
  };

  const updateWeeklyOverride = (key: string, week: number, value: string) => {
    setMetrics(prev => prev.map(m =>
      m.key === key ? { ...m, weekly_overrides: { ...m.weekly_overrides, [week]: value } } : m
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId || !selectedStaff) {
      setError("Select a department and staff member");
      return;
    }
    const metricsPayload = metrics
      .filter(m => m.monthly_target && parseFloat(m.monthly_target) > 0)
      .map(m => {
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
      setError("Enter at least one metric target");
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
      router.push("/tasks");
    } catch (err: any) {
      setError(err.message || "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Month badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#0052FF]/10 text-[#0052FF]">
          {monthDisplay}
        </span>
        <span className="text-xs text-muted-foreground">(current month — auto-selected)</span>
      </div>

      {/* Department selector */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold">Department</label>
        <select
          value={selectedDeptId}
          onChange={e => {
            const dept = departments.find((d: any) => String(d.id) === e.target.value);
            handleDeptChange(e.target.value, dept?.name);
          }}
          disabled={userRole === "Team Lead"}
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30 disabled:opacity-60"
        >
          <option value="">Select department...</option>
          {departments.map((d: any) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Staff selector */}
      {selectedDeptId && (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Assign To (Staff)</label>
          {fetchingStaff ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading staff...
            </div>
          ) : (
            <select
              value={selectedStaff}
              onChange={e => setSelectedStaff(e.target.value)}
              className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30"
            >
              <option value="">Select staff member...</option>
              {staffList.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Title */}
      {selectedStaff && (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Task Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30"
          />
        </div>
      )}

      {/* Metric targets */}
      {metrics.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Monthly Targets</h3>
            <span className="text-xs text-muted-foreground">Weekly split shown automatically</span>
          </div>
          <div className="rounded-2xl border bg-card divide-y divide-border/50">
            {metrics.map(m => {
              const monthly = parseFloat(m.monthly_target) || 0;
              const split = monthly > 0 ? computeWeeklySplit(monthly) : null;
              return (
                <div key={m.key} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm font-medium">{m.label}</span>
                        {m.tracking_type === "auto" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/20">auto</span>
                        )}
                        {m.value_type === "amount" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium dark:bg-purple-900/20">₹</span>
                        )}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={m.monthly_target}
                      onChange={e => updateMetricTarget(m.key, e.target.value)}
                      placeholder="0"
                      className="w-28 rounded-xl border bg-background px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30"
                    />
                  </div>

                  {/* Weekly preview */}
                  {split && (
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleWeekly(m.key)}
                        className="flex items-center gap-1 text-[11px] text-[#0052FF] font-medium"
                      >
                        {m.showWeekly ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {m.showWeekly ? "Hide" : "Edit"} weekly targets
                      </button>

                      {m.showWeekly ? (
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {[1, 2, 3, 4].map(w => (
                            <div key={w} className="text-center">
                              <div className="text-[10px] text-muted-foreground mb-1">Wk {w}</div>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={m.weekly_overrides[w] !== undefined ? m.weekly_overrides[w] : String(split[w] || 0)}
                                onChange={e => updateWeeklyOverride(m.key, w, e.target.value)}
                                className="w-full rounded-lg border bg-background px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#0052FF]/30"
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1.5 flex gap-2">
                          {[1, 2, 3, 4].map(w => (
                            <div key={w} className="flex-1 text-center bg-muted/50 rounded-lg py-1 px-1">
                              <div className="text-[9px] text-muted-foreground">Wk {w}</div>
                              <div className="text-[11px] font-semibold">{split[w]}</div>
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
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>}

      {metrics.length > 0 && (
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-[#0052FF] text-white font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Creating..." : "Create Task"}
        </button>
      )}
    </form>
  );
}
