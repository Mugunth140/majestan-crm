import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Mail, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const CONTACT_TYPE_STYLES: Record<string, string> = {
  email:    "bg-blue-100 text-blue-700 border-blue-200",
  sms:      "bg-green-100 text-green-700 border-green-200",
  whatsapp: "bg-emerald-100 text-emerald-700 border-emerald-200",
  call:     "bg-purple-100 text-purple-700 border-purple-200",
};

const CONTACT_TYPE_ICONS: Record<string, React.ReactNode> = {
  email:    <Mail className="h-3.5 w-3.5" />,
  sms:      <MessageSquare className="h-3.5 w-3.5" />,
  whatsapp: <Phone className="h-3.5 w-3.5" />,
  call:     <Phone className="h-3.5 w-3.5" />,
};

interface ContactModalProps {
  open: boolean;
  type: string;
  to: string;
  entityId: number;
  entityType: 'leads' | 'agents' | 'inbounds';
  onClose: () => void;
  onSent: () => void;
}

export function ContactModal({ open, type, to, entityId, entityType, onClose, onSent }: ContactModalProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    setIsSending(true);
    try {
      await fetch(`${API_URL}/${entityType}/${entityId}/contact-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_type: type, subject, message }),
      });
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} logged successfully. API integration coming soon.`);
      setSubject("");
      setMessage("");
      onSent();
      onClose();
    } catch {
      toast.error("Failed to log contact.");
    } finally {
      setIsSending(false);
    }
  };

  const titles: Record<string, string> = {
    email: `Send Email to ${to}`,
    sms: `Send SMS to ${to}`,
    whatsapp: `Send WhatsApp to ${to}`,
    call: `Log Call with ${to}`,
  };

  if (!type) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${CONTACT_TYPE_STYLES[type] || ""}`}>
              {CONTACT_TYPE_ICONS[type]}
            </div>
            <div>
              <DialogTitle className="text-lg">{titles[type]}</DialogTitle>
              <DialogDescription className="text-sm">This will be logged as a contact attempt.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {(type === "email" || type === "sms") && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line..." className="h-11 rounded-xl bg-muted/30" />
            </div>
          )}
          {type === "call" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Call Notes</label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="What was discussed on this call?" className="rounded-xl bg-muted/30 resize-none" rows={5} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Message</label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={`Write your ${type} message here...`} className="rounded-xl bg-muted/30 resize-none" rows={6} />
            </div>
          )}
          <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
            API integration coming soon. This will be logged as a timestamp in the contact history.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={isSending} className="bg-[#0052FF] text-white hover:bg-[#0040CC] gap-2">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {type === "call" ? "Log Call" : `Send ${type.charAt(0).toUpperCase() + type.slice(1)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
