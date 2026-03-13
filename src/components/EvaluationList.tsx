"use client";

import { FileSpreadsheet, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EvaluationSummary {
  id: string;
  name: string;
  user_email?: string | null;
  created_at: string;
  updated_at?: string | null;
  last_evaluated_at?: string | null;
  share_slug?: string | null;
}

interface EvaluationListProps {
  evaluations: EvaluationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

export function EvaluationList({
  evaluations,
  activeId,
  onSelect,
  onCreateNew,
}: EvaluationListProps) {
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-foreground">
            Your evaluations
          </h3>
          <Button variant="outline" size="sm" onClick={onCreateNew}>
            New
          </Button>
        </div>
        {evaluations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No evaluations yet. Upload a CSV to create one.
          </p>
        ) : (
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {evaluations.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onSelect(e.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg transition-colors flex items-start gap-2",
                    activeId === e.id
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "hover:bg-muted/50 text-foreground"
                  )}
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{e.name}</p>
                    {e.user_email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <User className="h-3 w-3" />
                        {e.user_email}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Uploaded {formatDate(e.created_at)}
                      {e.last_evaluated_at && (
                        <> · Evaluated {formatDateTime(e.last_evaluated_at)}</>
                      )}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
