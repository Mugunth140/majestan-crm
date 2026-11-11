"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AvatarPicker } from "./avatar-picker";

/**
 * Everyone needs a picture: a letter avatar makes people hard to tell apart in
 * lists and assignee pickers. This can't be closed until one is saved.
 */
export function PhotoGate({ userId, onDone }: { userId: number; onDone: () => void }) {
  return (
    <Dialog open onOpenChange={() => { /* required: stays open until a picture is saved */ }}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add your profile picture</DialogTitle>
          <DialogDescription>
            Pick an avatar or upload your own photo. It shows beside your name on leads, tasks and the dashboards, so the team can tell who&apos;s who.
          </DialogDescription>
        </DialogHeader>
        <AvatarPicker userId={userId} value={null} onChange={(url) => { if (url) onDone(); }} className="mt-2 sm:grid-cols-6" />
      </DialogContent>
    </Dialog>
  );
}
