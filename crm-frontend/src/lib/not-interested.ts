// crm/crm-frontend/src/lib/not-interested.ts

/**
 * Records a Not Interested outcome: a dated follow-up row carrying the
 * reason first, then the status change. The follow-up goes first so a
 * failed record can never strand a status change without its reason.
 * No next follow-up date is set — the row is history, and the queue
 * exclusion keeps the lead out of every follow-up queue from then on.
 */
export async function recordNotInterested(
  fetchFn: (
    url: string,
    init: { method: string; headers: Record<string, string>; body: string },
  ) => Promise<{ json: () => Promise<{ success: boolean }> }>,
  apiUrl: string,
  leadId: string | number,
  reason: string,
  today: string,
): Promise<void> {
  const notes = reason.trim();
  if (!notes) throw new Error("Reason is required");

  const jsonHeaders = { "Content-Type": "application/json" };
  const followUp = await (
    await fetchFn(`${apiUrl}/leads/${leadId}/follow-ups`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        followUpDate: today,
        outcome: "Not Interested",
        notes,
      }),
    })
  ).json();
  if (!followUp.success) throw new Error("Failed to record follow-up");

  const status = await (
    await fetchFn(`${apiUrl}/leads/${leadId}/status`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ status_name: "Not Interested" }),
    })
  ).json();
  if (!status.success) throw new Error("Failed to update status");
}
