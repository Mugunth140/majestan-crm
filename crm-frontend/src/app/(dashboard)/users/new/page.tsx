"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { FormSelect } from "@/components/shared/form-select";
import { Switch } from "@/components/ui/switch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function UserFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role_id: "",
    department_id: "",
    address: "",
    phone: "",
    whatsapp_no: "",
    dob: "",
    aadhaar_no: "",
    bank_account_no: "",
    join_date: "",
    qualification: "",
    is_active: true,
  });

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [rolesRes, deptRes] = await Promise.all([
          fetch(API_URL + "/roles"),
          fetch(API_URL + "/departments"),
        ]);
        const rolesData = await rolesRes.json();
        const deptData = await deptRes.json();
        
        if (rolesData.success) setRoles(rolesData.data);
        if (deptData.success) setDepartments(deptData.data);
      } catch (err) {
        console.error(err);
      }
    };

    const fetchUser = async () => {
      if (!editId) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(API_URL + "/users/" + editId);
        const data = await res.json();
        if (data.success) {
          setFormData({
            name: data.data.name || "",
            email: data.data.email || "",
            password: "", // empty for edit
            role_id: data.data.role_id?.toString() || "",
            department_id: data.data.department_id?.toString() || "",
            address: data.data.address || "",
            phone: data.data.phone || "",
            whatsapp_no: data.data.whatsapp_no || "",
            dob: data.data.dob || "",
            aadhaar_no: data.data.aadhaar_no || "",
            bank_account_no: data.data.bank_account_no || "",
            join_date: data.data.join_date || "",
            qualification: data.data.qualification || "",
            is_active: data.data.is_active,
          });
        }
      } catch {
        toast.error("Failed to load user");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMasterData().then(fetchUser);
  }, [editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.role_id) {
      toast.error("Please fill all required fields");
      return;
    }

    const roleIdNum = parseInt(formData.role_id);
    const requiresDept = roleIdNum === 3 || roleIdNum === 4; // Team Lead or Staff
    
    if (requiresDept && !formData.department_id) {
      toast.error("Department is mandatory for Team Lead and Staff roles");
      return;
    }

    if (!editId && !formData.password) {
      toast.error("Password is required for new users");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editId ? `${API_URL}/users/${editId}` : `${API_URL}/users`;
      const method = editId ? "PUT" : "POST";
      
      const payload: Record<string, any> = {
        ...formData,
        role_id: roleIdNum,
        department_id: requiresDept && formData.department_id ? parseInt(formData.department_id) : null,
        dob: formData.dob || null,
        join_date: formData.join_date || null,
        phone: formData.phone || null,
        whatsapp_no: formData.whatsapp_no || null,
        aadhaar_no: formData.aadhaar_no || null,
        bank_account_no: formData.bank_account_no || null,
        address: formData.address || null,
        qualification: formData.qualification || null,
      };

      if (editId && !payload.password) {
        delete payload.password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`User ${editId ? "updated" : "created"} successfully`);
        router.push("/users");
      } else {
        const errorMsg = Array.isArray(data.message) ? data.message.join(", ") : data.message;
        toast.error(errorMsg || "Operation failed. Please check the provided data.");
      }
    } catch (err: any) {
      toast.error(err?.message || "An error occurred while saving the user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => router.push("/users")}>
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{editId ? "Edit User" : "Add New User"}</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage user access and roles</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border rounded-2xl p-8 shadow-sm mt-8">
        
        {/* Core Account Info */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-foreground mb-8">Account Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Full Name *</label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="John Doe" 
                className="h-12 rounded-xl bg-muted/30 text-[14px] px-4 shadow-sm" 
                required 
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Email Address *</label>
              <Input 
                type="email"
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                placeholder="john@example.com" 
                className="h-12 rounded-xl bg-muted/30 text-[14px] px-4 shadow-sm" 
                required 
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Password {editId && "(Leave blank to keep unchanged)"} {!editId && "*"}
              </label>
              <Input 
                type="password"
                value={formData.password} 
                onChange={e => setFormData({...formData, password: e.target.value})} 
                placeholder="********" 
                className="h-12 rounded-xl bg-muted/30 text-[14px] px-4 shadow-sm" 
                required={!editId}
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Role *</label>
              <FormSelect 
                name="role" 
                options={roles.map(r => ({ label: r.name, value: r.id.toString() }))}
                value={formData.role_id}
                onValueChange={v => {
                  const newRole = v || "";
                  const roleNum = parseInt(newRole);
                  const isCrossDept = roleNum === 1 || roleNum === 2; // Admin or Manager
                  setFormData({
                    ...formData, 
                    role_id: newRole,
                    department_id: isCrossDept ? "" : formData.department_id 
                  });
                }}
                placeholder="Select Role"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Department {(formData.role_id === "3" || formData.role_id === "4") && "*"}
              </label>
              <FormSelect 
                name="department" 
                options={departments.map(d => ({ label: d.name, value: d.id.toString() }))}
                value={formData.department_id}
                onValueChange={v => setFormData({...formData, department_id: v || ""})}
                placeholder={(formData.role_id === "1" || formData.role_id === "2") ? "Not Applicable" : "Select Department"}
                disabled={formData.role_id === "1" || formData.role_id === "2"}
              />
            </div>
            
            <div className="flex flex-col gap-2 justify-center">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Account Status</label>
              <div className="flex items-center gap-3 h-12 px-2">
                <Switch 
                  checked={formData.is_active} 
                  onCheckedChange={v => setFormData({...formData, is_active: v})} 
                  className="shadow-sm scale-125 origin-left"
                />
                <span className="text-[14px] font-semibold text-foreground/90 ml-1">{formData.is_active ? "Active User" : "Inactive / Disabled"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-border/40 w-full my-10" />

        {/* Personal & Contact Info */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-foreground mb-8">Personal & Contact Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Phone Number</label>
              <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+91 98765 43210" className="h-12 rounded-xl bg-muted/30 text-[14px] px-4 shadow-sm" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">WhatsApp Number</label>
              <Input value={formData.whatsapp_no} onChange={e => setFormData({...formData, whatsapp_no: e.target.value})} placeholder="+91 98765 43210" className="h-12 rounded-xl bg-muted/30 text-[14px] px-4 shadow-sm" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date of Birth</label>
              <Input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="h-12 rounded-xl bg-muted/30 text-[14px] px-4 shadow-sm" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qualification</label>
              <Input value={formData.qualification} onChange={e => setFormData({...formData, qualification: e.target.value})} placeholder="e.g. MBA, B.Tech" className="h-12 rounded-xl bg-muted/30 text-[14px] px-4 shadow-sm" />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Address</label>
              <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Full residential address" className="h-12 rounded-xl bg-muted/30 text-[14px] px-4 shadow-sm" />
            </div>
          </div>
        </div>

        <div className="h-px bg-border/40 w-full my-10" />

        {/* Legal & Banking Info */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-foreground mb-8">Legal & Employment Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-10">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Aadhaar No</label>
              <Input value={formData.aadhaar_no} onChange={e => setFormData({...formData, aadhaar_no: e.target.value})} placeholder="0000 0000 0000" className="h-12 rounded-xl bg-muted/30 text-[14px] px-4 shadow-sm" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Bank Account Number</label>
              <Input value={formData.bank_account_no} onChange={e => setFormData({...formData, bank_account_no: e.target.value})} placeholder="Account No." className="h-12 rounded-xl bg-muted/30 text-[14px] px-4 shadow-sm" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Join Date</label>
              <Input type="date" value={formData.join_date} onChange={e => setFormData({...formData, join_date: e.target.value})} className="h-12 rounded-xl bg-muted/30 text-[14px] px-4 shadow-sm" />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-8 mt-10 border-t border-border/50">
          <Button type="button" variant="ghost" className="mr-4 h-12 px-6 rounded-xl font-medium" onClick={() => router.push("/users")}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting} className="bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-lg px-8 rounded-xl font-bold gap-2 h-12 text-[15px]">
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Save User
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function UserForm() {
  return (
    <Suspense fallback={<div className="p-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" /></div>}>
      <UserFormContent />
    </Suspense>
  );
}
