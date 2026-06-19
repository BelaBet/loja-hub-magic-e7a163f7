import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Institution = {
  id: string;
  nome: string;
  cnpj: string | null;
  owner_user_id: string;
};

type Ctx = {
  loading: boolean;
  institutions: Institution[];
  current: Institution | null;
  setCurrentId: (id: string) => void;
  refresh: () => Promise<void>;
};

const InstitutionContext = createContext<Ctx | undefined>(undefined);

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      setInstitutions([]);
      setLoading(false);
      return;
    }
    const { data, error } = await (supabase as any)
      .from("institutions")
      .select("id, nome, cnpj, owner_user_id")
      .order("created_at", { ascending: true });
    if (!error && data) {
      setInstitutions(data as Institution[]);
      setCurrentId((prev) => prev ?? (data[0]?.id ?? null));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const current = institutions.find((i) => i.id === currentId) ?? null;

  return (
    <InstitutionContext.Provider
      value={{ loading, institutions, current, setCurrentId, refresh: load }}
    >
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitutions() {
  const ctx = useContext(InstitutionContext);
  if (!ctx) throw new Error("useInstitutions must be used within InstitutionProvider");
  return ctx;
}