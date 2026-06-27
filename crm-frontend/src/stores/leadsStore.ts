import { create } from 'zustand';

export const initialDummyData = [
  { sno: 1, id: "L10001", date: "17 Dec 2024", name: "Esther Kiehn", mobile: "9994661767", propertyType: "Apartment", staff: "John Doe", source: "Website", status: "NEW", notes: "Looking for 3BHK" },
  { sno: 2, id: "L10002", date: "16 Dec 2024", name: "Denise Kuhn", mobile: "9876543210", propertyType: "Villa", staff: "Jane Smith", source: "Facebook", status: "SITE VISIT DONE", notes: "Budget 1Cr" },
  { sno: 3, id: "L10003", date: "16 Dec 2024", name: "Clint Hoppe", mobile: "9123456780", propertyType: "Commercial", staff: "Mike Ross", source: "Referral", status: "BOOKED", notes: "Closed deal" },
  { sno: 4, id: "L10004", date: "15 Dec 2024", name: "Jacquelyn Robel", mobile: "9988776655", propertyType: "Plot", staff: "John Doe", source: "Direct Walk-in", status: "OPPORTUNITY", notes: "Wants corner plot" },
];

interface LeadsStore {
  leads: any[];
  addLead: (lead: any) => void;
  addBulkLeads: (newLeads: any[]) => void;
}

export const useLeadsStore = create<LeadsStore>((set) => ({
  leads: initialDummyData,
  addLead: (lead) => set((state) => ({ leads: [lead, ...state.leads] })),
  addBulkLeads: (newLeads) => set((state) => ({ leads: [...newLeads, ...state.leads] })),
}));
