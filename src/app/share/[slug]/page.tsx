"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { EvaluatedProject, JudgingCriterion } from "@/lib/types";

interface ShareData {
  id: string;
  name: string;
  criteria: JudgingCriterion[];
  user_email?: string | null;
  created_at: string;
  projects: EvaluatedProject[];
}

export default function SharePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/share/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-xl font-semibold">Evaluation not found</h1>
        <p className="text-muted-foreground text-center max-w-md">
          This link may have expired or the evaluation was removed.
        </p>
        <Button asChild variant="outline">
          <Link href="/" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Hackathon Evaluator
          </Link>
        </Button>
      </div>
    );
  }

  const criteria = data.criteria ?? [];
  const maxScore =
    criteria.length > 0
      ? criteria.reduce((s, c) => s + c.points, 0)
      : 100;

  const getScoreBadge = (score: number) => {
    const pct = maxScore > 0 ? score / maxScore : 0;
    const isHigh = pct >= 0.8;
    const isMid = pct >= 0.6 && !isHigh;
    return (
      <span
        className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-md text-sm font-bold ${
          isHigh
            ? "bg-chart-2/25 text-chart-2"
            : isMid
              ? "bg-chart-3/25 text-chart-3"
              : "bg-chart-5/25 text-chart-5"
        }`}
      >
        {score}/{maxScore}
      </span>
    );
  };

  const sortedByScore = [...data.projects].sort((a, b) => {
    if (a.cannotEvaluate && b.cannotEvaluate) return 0;
    if (a.cannotEvaluate) return 1;
    if (b.cannotEvaluate) return -1;
    const sa = a.evaluation?.score ?? -1;
    const sb = b.evaluation?.score ?? -1;
    return sb - sa;
  });
  const rankMap = new Map<string, number>();
  let rank = 1;
  let prevScore: number | null = null;
  for (const p of sortedByScore) {
    if (p.cannotEvaluate) continue;
    if (p.evaluation) {
      if (prevScore !== null && p.evaluation.score < prevScore) rank++;
      rankMap.set(p.id, rank);
      prevScore = p.evaluation.score;
    }
  }

  const getStatusBadge = (status: EvaluatedProject["status"]) => {
    switch (status) {
      case "processed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-chart-2/20 text-chart-2 border border-chart-2/30">
            <CheckCircle2 className="h-3.5 w-3.5" /> Processed
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-chart-1/20 text-chart-1 border border-chart-1/30">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-chart-5/20 text-chart-5 border border-chart-5/30">
            <XCircle className="h-3.5 w-3.5" /> Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
            <Clock className="h-3.5 w-3.5" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="flex h-12 sm:h-16 items-center justify-between px-4 max-w-7xl mx-auto">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Shared evaluation
          </span>
        </div>
      </header>

      <main className="container px-4 py-6 sm:py-8 max-w-7xl mx-auto">
        <Card className="shadow-soft mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {data.name}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {data.user_email && (
                <span>Uploaded by {data.user_email}</span>
              )}
              {data.user_email && data.created_at && " · "}
              {data.created_at &&
                new Date(data.created_at).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-soft overflow-hidden">
          <CardContent className="p-0">
            <div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-4 font-semibold text-foreground w-14">
                      S.No
                    </th>
                    <th className="text-left p-4 font-semibold text-foreground">
                      Project Title
                    </th>
                    <th className="text-left p-4 font-semibold text-foreground">
                      Total Score
                    </th>
                    <th className="text-left p-4 font-semibold text-foreground">
                      Rank
                    </th>
                    <th className="text-left p-4 font-semibold text-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((project, idx) => (
                    <tr
                      key={project.id}
                      className={`border-b border-border ${
                        idx % 2 === 1 ? "bg-muted/20" : ""
                      }`}
                    >
                      <td className="p-4 text-muted-foreground font-medium">
                        {idx + 1}
                      </td>
                      <td className="p-4 font-medium text-foreground break-words">
                        {project["Project Title"] || "Untitled"}
                      </td>
                      <td className="p-4">
                        {project.cannotEvaluate ? (
                          <span className="text-amber-600 dark:text-amber-500 text-sm font-medium">
                            Cannot evaluate
                          </span>
                        ) : project.evaluation ? (
                          getScoreBadge(project.evaluation.score)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        {rankMap.has(project.id) ? (
                          <span className="font-medium text-foreground">
                            #{rankMap.get(project.id)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          {getStatusBadge(project.status)}
                          {project.driveNotAccessible && (
                            <span
                              className="inline-flex text-amber-600 dark:text-amber-500"
                              title="Drive not accessible"
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
