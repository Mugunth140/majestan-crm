export function RadioPills({ options, value, onChange }: { options: string[], value: string, onChange: (val: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1 min-h-[38px] items-center">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 text-[13px] font-medium rounded-full border transition-colors flex-shrink-0 ${
            value === opt 
              ? "bg-[#0052FF] text-white border-[#0052FF] shadow-sm" 
              : "bg-muted/30 text-muted-foreground border-border/60 hover:bg-muted"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
