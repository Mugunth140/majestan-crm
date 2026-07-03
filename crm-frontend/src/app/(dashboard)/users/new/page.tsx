"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { FormSelect } from "@/components/shared/form-select";
import { Switch } from "@/components/ui/switch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function UserForm() {
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
            name: data.data.name,
            email: data.data.email,
            password: "", // empty for edit
            role_id: data.data.role_id?.toString() || "",
            department_id: data.data.department_id?.toString() || "",
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
        role_id: parseInt(formData.role_id),
        department_id: formData.department_id ? parseInt(formData.department_id) : null,
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
        toast.error(data.message || "Operation failed");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => router.push("/users")}>
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{editId ? "Edit User" : "Add New User"}</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage user access and roles</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border rounded-2xl p-8 shadow-sm space-y-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name *</label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="John Doe" 
                className="h-11 rounded-xl bg-muted/30" 
                required 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address *</label>
              <Input 
                type="email"
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                placeholder="john@example.com" 
                className="h-11 rounded-xl bg-muted/30" 
                required 
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Password {editId && "(Leave blank to keep unchanged)"} {!editId && "*"}
              </label>
              <Input 
                type="password"
                value={formData.password} 
                onChange={e => setFormData({...formData, password: e.target.value})} 
                placeholder="********" 
                className="h-11 rounded-xl bg-muted/30" 
                required={!editId}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Role *</label>
              <FormSelect 
                name="role" 
                options={roles.map(r => ({ label: r.name, value: r.id.toString() }))}
                value={formData.role_id}
                onValueChange={v => setFormData({...formData, role_id: v || ""})}
                placeholder="Select Role"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Department</label>
              <FormSelect 
                name="department" 
                options={departments.map(d => ({ label: d.name, value: d.id.toString() }))}
                value={formData.department_id}
                onValueChange={v => setFormData({...formData, department_id: v || ""})}
                placeholder="Select Department"
              />
            </div>
            
            <div className="flex flex-col justify-center space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</label>
              <div className="flex items-center gap-3">
                <Switch 
                  checked={formData.is_active} 
                  onCheckedChange={v => setFormData({...formData, is_active: v})} 
                />
                <span className="text-sm font-medium">{formData.is_active ? "Active User" : "Inactive / Disabled"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border/50">
          <Button type="button" variant="ghost" className="mr-3" onClick={() => router.push("/users")}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting} className="bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md px-8 rounded-xl font-semibold gap-2 h-11">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save User
          </Button>
        </div>
      </form>
    </div>
  );
}
