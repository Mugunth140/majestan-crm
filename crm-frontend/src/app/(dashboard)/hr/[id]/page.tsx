"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function HrDetail() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  const [candidate, setCandidate] = useState<any>(null);
  
  useEffect(() => {
    if (id) fetch(`${API_URL}/hr/${id}`).then(res => res.json()).then(setCandidate);
  }, [id]);

  const handleUpload = async (docType: string, e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData(); formData.append("file", file);
    await fetch(`${API_URL}/hr/${id}/upload/${docType}`, { method: "POST", body: formData });
    // Refresh
    fetch(`${API_URL}/hr/${id}`).then(res => res.json()).then(setCandidate);
  };

  if (!candidate) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="mr-2"/> Back</Button>
        <h1 className="text-2xl font-bold">{candidate.name}</h1>
        <Badge>{candidate.status}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>Department: {candidate.department}</div>
        <div>Position: {candidate.position}</div>
      </div>

      <div className="mt-8 border p-4 rounded-xl">
        <h3 className="font-bold mb-4">Documents</h3>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label>Resume</label>
                <Input type="file" onChange={(e) => handleUpload('resume', e)} />
            </div>
            
            {candidate.status === 'Joined' && (
              <>
                <div>
                  <label>Aadhaar</label>
                  <Input type="file" onChange={(e) => handleUpload('aadhaar', e)} />
                </div>
                <div>
                  <label>PAN</label>
                  <Input type="file" onChange={(e) => handleUpload('pan', e)} />
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
}