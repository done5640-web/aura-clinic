import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

export default function NoAccess() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <ShieldAlert className="w-10 h-10 text-warning mb-2" />
          <CardTitle>Asnjë klinikë e caktuar</CardTitle>
          <CardDescription>
            Llogaria juaj ekziston por nuk është caktuar në asnjë klinikë. Kontaktoni administratorin tuaj, ose dilni dhe përdorni një llogari demo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={async () => { await signOut(); nav("/auth"); }}>Dil nga llogaria</Button>
        </CardContent>
      </Card>
    </div>
  );
}
