export default function InboundPage() {
  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold tracking-tight">Inbound</h1>
      </div>
      <div className="bg-card border rounded-2xl p-10 shadow-sm flex flex-col items-center justify-center text-center h-[50vh]">
        <h3 className="text-xl font-bold text-foreground mb-2">Inbound is coming soon</h3>
        <p className="text-muted-foreground">This module is currently under development. Please check back later.</p>
      </div>
    </div>
  );
}
