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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import ShinyText from "@/components/ShinyText";
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
  const [selectedProject, setSelectedProject] = useState<EvaluatedProject | null>(null);

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
                      onClick={() => setSelectedProject(project)}
                      className={`border-b border-border cursor-pointer hover:bg-muted/40 transition-colors ${
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

      {/* Project Detail Modal */}
      <Dialog
        open={!!selectedProject}
        onOpenChange={(open) => !open && setSelectedProject(null)}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-5xl max-h-[90vh] overflow-y-auto shadow-xl mx-4 p-4 sm:p-6">
          {selectedProject && (
            <>
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-xl flex items-center gap-2">
                  <span className="text-glow">
                    <ShinyText
                      text={selectedProject["Project Title"] || "Untitled"}
                      speed={2}
                      color="var(--foreground)"
                      shineColor="var(--primary)"
                      spread={120}
                      direction="left"
                    />
                  </span>
                  {selectedProject.cannotEvaluate ? (
                    <span className="text-amber-600 dark:text-amber-500 text-sm font-medium px-2 py-0.5 rounded bg-amber-500/10">
                      Cannot be evaluated
                    </span>
                  ) : (
                    selectedProject.evaluation && getScoreBadge(selectedProject.evaluation.score)
                  )}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    {selectedProject.evaluation
                      ? "Original submission vs AI critique"
                      : "View submission details"}
                  </p>
                  {selectedProject.driveNotAccessible && (
                    <span className="text-amber-600 dark:text-amber-500 text-sm font-medium px-2 py-1 rounded bg-amber-500/10 inline-flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Drive not accessible
                    </span>
                  )}
                </div>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm uppercase tracking-wider">
                      <span className="text-glow">
                        <ShinyText text="Original Submission" speed={2} color="var(--muted-foreground)" shineColor="var(--primary)" spread={120} direction="left" />
                      </span>
                    </h3>
                  </div>
                  <div className="space-y-4 text-sm rounded-lg bg-muted/50 p-4">
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">Problem</span>
                      <p className="text-foreground">{selectedProject["What real-world problem are you solving?"] || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">Target audience</span>
                      <p className="text-foreground">{selectedProject["Who is this problem for? (Profession / domain / user type)"] || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">AI usage</span>
                      <p className="text-foreground">{selectedProject["How does your solution use AI?"] || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">AI Tools</span>
                      <p className="text-foreground">{selectedProject["What AI Tools / Platforms have you used"] || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">User benefit</span>
                      <p className="text-foreground">{selectedProject["How does your solution help the user? (example-time saved, cost reduced, effort reduced, revenue increased)"] || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">Demo (Google Drive)</span>
                      {selectedProject["Please share GOOGLE DRIVE link having your project demo video, files and images"] ? (
                        <a
                          href={selectedProject["Please share GOOGLE DRIVE link having your project demo video, files and images"]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline hover:no-underline font-medium break-all block max-w-full"
                        >
                          {selectedProject["Please share GOOGLE DRIVE link having your project demo video, files and images"]}
                        </a>
                      ) : (
                        <p className="text-foreground">—</p>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">Detailed explanation</span>
                      <p className="text-foreground">{selectedProject["Explain your solution in detail (For ex. what you did, why is this useful)"] || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">Biggest challenge</span>
                      <p className="text-foreground">{selectedProject["What was the biggest challenge you faced during this hackathon?"] || "—"}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm uppercase tracking-wider">
                      <span className="text-glow">
                        <ShinyText text="AI Critique" speed={2} color="var(--muted-foreground)" shineColor="var(--primary)" spread={120} direction="left" />
                      </span>
                    </h3>
                  </div>
                  {selectedProject.cannotEvaluate ? (
                    <div className="space-y-4 text-sm rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
                      <p className="text-amber-700 dark:text-amber-400 font-medium">
                        Cannot be evaluated as there was no access to Drive.
                      </p>
                    </div>
                  ) : selectedProject.evaluation ? (
                    <div className="space-y-4 text-sm rounded-lg bg-primary/5 border border-primary/20 p-4">
                      <div>
                        <span className="font-medium text-muted-foreground block mb-1">Score</span>
                        <div className="mt-1">{getScoreBadge(selectedProject.evaluation.score)}</div>
                      </div>
                      <div>
                        <span className="font-medium text-muted-foreground block mb-1">Reason</span>
                        <p className="text-foreground leading-relaxed">{selectedProject.evaluation.reason_why}</p>
                      </div>
                      <div>
                        <span className="font-medium text-chart-2 block mb-2">Pros</span>
                        <ul className="space-y-1.5">
                          {selectedProject.evaluation.pros.map((p, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-chart-2 mt-0.5 shrink-0" />
                              <span className="text-foreground">{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="font-medium text-chart-5 block mb-2">Cons</span>
                        <ul className="space-y-1.5">
                          {selectedProject.evaluation.cons.map((c, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <XCircle className="h-4 w-4 text-chart-5 mt-0.5 shrink-0" />
                              <span className="text-foreground">{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {criteria.length > 0 && selectedProject.evaluation.criteria_scores && (
                        <div>
                          <span className="font-medium text-muted-foreground block mb-2">Score breakdown</span>
                          <div className="rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/50 border-b border-border">
                                  <th className="text-left p-2 sm:p-3 font-medium text-foreground">Criterion</th>
                                  <th className="text-right p-2 sm:p-3 font-medium text-foreground w-20">Max</th>
                                  <th className="text-right p-2 sm:p-3 font-medium text-foreground w-20">Given</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const scores = selectedProject.evaluation.criteria_scores ?? [];
                                  const scoresByName = new Map(scores.map((s) => [s.name, s]));
                                  return criteria.map((c) => {
                                    const s = scoresByName.get(c.name);
                                    return s
                                      ? { name: c.name, max: c.points, given: s.given }
                                      : { name: c.name, max: c.points, given: null as number | null };
                                  });
                                })().map((row, i) => (
                                  <tr key={i} className="border-b border-border last:border-0">
                                    <td className="p-2 sm:p-3 text-foreground break-words">{row.name}</td>
                                    <td className="p-2 sm:p-3 text-right text-muted-foreground">{row.max}</td>
                                    <td className="p-2 sm:p-3 text-right font-medium text-foreground">
                                      {typeof row.given === "number" ? row.given : "—"}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="bg-muted/30 font-semibold">
                                  <td className="p-2 sm:p-3 text-foreground">Total</td>
                                  <td className="p-2 sm:p-3 text-right text-muted-foreground">{maxScore}</td>
                                  <td className="p-2 sm:p-3 text-right text-foreground">{selectedProject.evaluation.score}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : selectedProject.status === "error" ? (
                    <div className="rounded-lg bg-chart-5/10 border border-chart-5/30 p-4">
                      <p className="text-chart-5 font-medium">
                        {selectedProject.error || "Evaluation failed"}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-muted/50 border border-border p-6 text-center">
                      <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Not yet evaluated.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
