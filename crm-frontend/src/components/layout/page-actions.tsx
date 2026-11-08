"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// The page header owns two slots that pages fill through portals:
// actions on the right (<PageActions>) and an extra breadcrumb such as a view switcher (<PageCrumb>).
interface Slots {
  actions: HTMLElement | null;
  crumb: HTMLElement | null;
  mobileActions: HTMLElement | null;
  setMobileActions: (el: HTMLElement | null) => void;
  setActions: (el: HTMLElement | null) => void;
  setCrumb: (el: HTMLElement | null) => void;
  hasCrumb: boolean;
  setHasCrumb: (v: boolean) => void;
}

const SlotContext = createContext<Slots>({
  actions: null,
  mobileActions: null,
  setMobileActions: () => {},
  crumb: null,
  setActions: () => {},
  setCrumb: () => {},
  hasCrumb: false,
  setHasCrumb: () => {},
});

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const [mobileActions, setMobileActions] = useState<HTMLElement | null>(null);
  const [crumb, setCrumb] = useState<HTMLElement | null>(null);
  const [hasCrumb, setHasCrumb] = useState(false);
  return (
    <SlotContext.Provider
      value={{
        actions,
        mobileActions,
        setMobileActions,
        crumb,
        setActions,
        setCrumb,
        hasCrumb,
        setHasCrumb,
      }}
    >
      {children}
    </SlotContext.Provider>
  );
}

export const usePageSlots = () => useContext(SlotContext);

// Rendered by the page header: where page actions land.
export function PageActionsSlot({ className }: { className?: string }) {
  const { setActions } = useContext(SlotContext);
  return <div ref={setActions} className={className} />;
}

// Rendered by the page header after the breadcrumbs.
export function PageCrumbSlot({ className }: { className?: string }) {
  const { setCrumb } = useContext(SlotContext);
  return <div ref={setCrumb} className={className} />;
}

// Rendered by a page: its primary actions, shown on the right of the page header.
export function PageActions({
  children,
  mobile = false,
}: {
  children: ReactNode;
  mobile?: boolean;
}) {
  const { actions, mobileActions } = useContext(SlotContext);
  return (
    <>
      {actions ? createPortal(children, actions) : null}
      {mobile && mobileActions ? createPortal(children, mobileActions) : null}
    </>
  );
}
export function MobilePageActionsSlot() {
  const { setMobileActions } = useContext(SlotContext);
  return (
    <div
      data-mobile-page-actions
      ref={setMobileActions}
      className="z-10 flex items-center gap-2"
    />
  );
}

// Rendered by a page: one more breadcrumb after the route's, e.g. "Leads / List ⌄".
export function PageCrumb({ children }: { children: ReactNode }) {
  const { crumb, setHasCrumb } = useContext(SlotContext);
  useEffect(() => {
    setHasCrumb(true);
    return () => setHasCrumb(false);
  }, [setHasCrumb]);
  return crumb ? createPortal(children, crumb) : null;
}
