"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { AuthButton } from "./AuthButton";
import { Card, CardContent } from "./ui/card";
import { FileSpreadsheet } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user: initialUser } }) => {
      setUser(initialUser);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="border-dashed border-border bg-muted/30 animate-in-scale max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted mb-6">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold mb-2">
            Sign in to get started
          </h3>
          <p className="text-muted-foreground max-w-sm mb-6 text-base">
            Sign in with Google to upload CSV submissions, evaluate projects with
            AI, and share results with your team.
          </p>
          <AuthButton />
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
