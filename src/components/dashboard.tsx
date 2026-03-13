"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import {
  Settings,
  Upload,
  Play,
  Download,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileSpreadsheet,
  Sparkles,
  BarChart3,
  Plus,
  Trash2,
  Pause,
  RotateCcw,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import type { AIProvider } from "@/lib/ai";
import {
  parseCSV,
  exportToCSV,
  downloadCSV,
  downloadExcel,
  downloadPDF,
  CSVValidationError,
} from "@/lib/csv";
import type { EvaluatedProject, HackathonProject, JudgingCriterion } from "@/lib/types";
import { DEFAULT_CRITERIA } from "@/lib/types";
import ShinyText from "@/components/ShinyText";
import { AuthButton } from "@/components/AuthButton";
import { AuthGuard } from "@/components/AuthGuard";
import { EvaluationList, type EvaluationSummary } from "@/components/EvaluationList";
import { ShareButton } from "@/components/ShareButton";

const API_PROVIDER_STORAGE = "hackathon-api-provider";
const USAGE_LOG_STORAGE = "hackathon-usage-log";

interface UsageLogEntry {
  timestamp: string;
  projectTitle: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000;

export function Dashboard() {
  const [apiProvider, setApiProvider] = useState<AIProvider>("gemini");
  const [showSettings, setShowSettings] = useState(false);
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationSummary[]>([]);
  const [projects, setProjects] = useState<EvaluatedProject[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: "title" | "score" | "status" | "rank";
    direction: "asc" | "desc";
  } | null>(null);
  const [selectedProject, setSelectedProject] =
    useState<EvaluatedProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [csvError, setCsvError] = useState<{
    title: string;
    validation: import("@/lib/csv").CSVValidationResult;
  } | null>(null);
  const [criteria, setCriteria] = useState<JudgingCriterion[]>(DEFAULT_CRITERIA);
  const [usageLog, setUsageLog] = useState<UsageLogEntry[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [loadingEvaluations, setLoadingEvaluations] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const pauseRequestedRef = useRef(false);
  const { toast } = useToast();

  // Load API provider and usage log from localStorage
  useEffect(() => {
    const storedProvider = localStorage.getItem(API_PROVIDER_STORAGE);
    if (storedProvider === "openai" || storedProvider === "gemini") setApiProvider(storedProvider);
    const storedUsage = localStorage.getItem(USAGE_LOG_STORAGE);
    if (storedUsage) {
      try {
        const parsed = JSON.parse(storedUsage) as UsageLogEntry[];
        if (Array.isArray(parsed)) setUsageLog(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (usageLog.length > 0) {
      localStorage.setItem(USAGE_LOG_STORAGE, JSON.stringify(usageLog));
    }
  }, [usageLog]);

  // Fetch admin status on mount
  useEffect(() => {
    fetch("/api/admin")
      .then((res) => (res.ok ? res.json() : { isAdmin: false, userId: null }))
      .then((data: { isAdmin?: boolean; userId?: string | null }) => {
        setIsAdmin(data.isAdmin ?? false);
        setCurrentUserId(data.userId ?? null);
      })
      .catch(() => {});
  }, []);

  // Fetch evaluations list on mount
  useEffect(() => {
    fetch("/api/evaluations")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: EvaluationSummary[]) => {
        setEvaluations(Array.isArray(data) ? data : []);
        if (data?.length > 0 && !evaluationId) {
          setEvaluationId(data[0].id);
        }
      })
      .catch(() => setEvaluations([]))
      .finally(() => setLoadingEvaluations(false));
  }, []);

  // Load default criteria when no evaluation is selected
  useEffect(() => {
    if (!evaluationId) {
      fetch("/api/criteria")
        .then((res) => (res.ok ? res.json() : { criteria: DEFAULT_CRITERIA }))
        .then((data: { criteria?: JudgingCriterion[] }) => {
          const c = Array.isArray(data.criteria) && data.criteria.length > 0 ? data.criteria : DEFAULT_CRITERIA;
          setCriteria(c);
        })
        .catch(() => setCriteria(DEFAULT_CRITERIA));
    }
  }, [evaluationId]);

  // Load evaluation when evaluationId changes
  useEffect(() => {
    if (!evaluationId) {
      setProjects([]);
      setUploadedFileName("");
      return;
    }
    fetch(`/api/evaluations/${evaluationId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data: { projects: EvaluatedProject[]; criteria?: JudgingCriterion[]; name?: string }) => {
        setProjects(data.projects ?? []);
        const apiCriteria = Array.isArray(data.criteria) && data.criteria.length > 0 ? data.criteria : [];
        const byName = new Map(apiCriteria.map((c) => [c.name, c]));
        const merged = apiCriteria.length === 0
          ? DEFAULT_CRITERIA
          : DEFAULT_CRITERIA.map((c) => byName.get(c.name) ?? c);
        setCriteria(merged);
        setUploadedFileName(data.name?.replace(/\.csv$/i, "") ?? "");
        if (merged.length !== apiCriteria.length) {
          fetch(`/api/evaluations/${evaluationId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ criteria: merged }),
          }).catch(() => {});
        }
      })
      .catch(() => {
        toast({ title: "Failed to load evaluation", variant: "destructive" });
      });
  }, [evaluationId, toast]);

  const refreshEvaluations = useCallback(() => {
    fetch("/api/evaluations")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: EvaluationSummary[]) => setEvaluations(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handleDeleteEvaluation = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this evaluation? This cannot be undone.")) return;
      try {
        const res = await fetch(`/api/evaluations/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to delete");
        }
        if (evaluationId === id) setEvaluationId(null);
        refreshEvaluations();
        toast({ title: "Evaluation deleted", variant: "success" });
      } catch (err) {
        toast({
          title: "Delete failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    [evaluationId, refreshEvaluations, toast]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".csv")) {
        setCsvError({
          title: "Wrong file type",
          validation: {
            valid: false,
            missingHeaders: [],
            foundHeaders: [],
            parseError: `You selected "${file.name}". Please choose a CSV file (.csv). CSV files are plain text tables that can be opened in Excel or Google Sheets.`,
            rowCount: 0,
          },
        });
        return;
      }

      try {
        const parsedProjects = await parseCSV(file);
        const evaluated: EvaluatedProject[] = parsedProjects.map((p) => ({
          ...p,
          status: "pending" as const,
        }));
        const baseName = file.name.replace(/\.csv$/i, "");

        const res = await fetch("/api/evaluations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: baseName,
            projects: evaluated,
            criteria,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to create");

        setEvaluationId(data.id);
        setUploadedFileName(baseName);
        refreshEvaluations();
        toast({
          title: "CSV loaded",
          description: `${file.name} — ${evaluated.length} projects loaded.`,
          variant: "success",
        });
      } catch (err) {
        if (err instanceof CSVValidationError) {
          setCsvError({
            title: "CSV format issue",
            validation: err.validation,
          });
        } else {
          setCsvError({
            title: "Could not upload",
            validation: {
              valid: false,
              missingHeaders: [],
              foundHeaders: [],
              parseError: err instanceof Error ? err.message : "Unknown error",
              rowCount: 0,
            },
          });
        }
      }
    },
    [toast, criteria, refreshEvaluations]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
      e.target.value = "";
    },
    [handleFileUpload]
  );

  const processAll = useCallback(async () => {
    const toProcess = projects.filter((p) => p.status === "pending" || p.status === "error");
    if (toProcess.length === 0) {
      toast({
        title: "Nothing to process",
        description: "All projects have already been evaluated.",
        variant: "default",
      });
      return;
    }

    setIsProcessing(true);
    pauseRequestedRef.current = false;

    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      if (pauseRequestedRef.current) {
        toast({ title: "Paused", description: "Evaluation paused. Click Process All to resume.", variant: "default" });
        break;
      }
      const batch = toProcess.slice(i, i + BATCH_SIZE);

      for (const project of batch) {
        if (pauseRequestedRef.current) break;
        setProjects((prev) =>
          prev.map((p) =>
            p.id === project.id ? { ...p, status: "processing" as const } : p
          )
        );

        try {
          const judgingCriteria = criteria.length > 0 ? criteria : [...DEFAULT_CRITERIA];
          const storedProvider = (localStorage.getItem(API_PROVIDER_STORAGE) || "gemini") as AIProvider;

          const res = await fetch("/api/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              project,
              provider: storedProvider,
              criteria: judgingCriteria,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Evaluation failed");
          }
          const { usage, driveNotAccessible, ...result } = data;
          if (usage) {
            setUsageLog((prev) => [
              ...prev,
              {
                timestamp: new Date().toISOString(),
                projectTitle: project["Project Title"],
                promptTokens: usage.promptTokens ?? 0,
                completionTokens: usage.completionTokens ?? 0,
                totalTokens: usage.totalTokens ?? 0,
              },
            ]);
          }
          const updated = {
            ...project,
            evaluation: result,
            status: "processed" as const,
            error: undefined,
            driveNotAccessible: driveNotAccessible ?? false,
          };
          setProjects((prev) =>
            prev.map((p) => (p.id === project.id ? updated : p))
          );
          if (evaluationId) {
            fetch(`/api/evaluations/${evaluationId}/projects`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project: updated }),
            }).catch(() => {});
          }
          const totalPts = judgingCriteria.reduce((s, c) => s + c.points, 0);
          toast({
            title: `Evaluated: ${project["Project Title"]}`,
            description: driveNotAccessible
              ? `Score: ${result.score}/${totalPts} (Drive not accessible)`
              : `Score: ${result.score}/${totalPts}`,
            variant: "success",
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          const errProject = {
            ...project,
            status: "error" as const,
            error: msg,
          };
          setProjects((prev) =>
            prev.map((p) => (p.id === project.id ? errProject : p))
          );
          if (evaluationId) {
            fetch(`/api/evaluations/${evaluationId}/projects`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project: errProject }),
            }).catch(() => {});
          }
          toast({
            title: `Error: ${project["Project Title"]}`,
            description: msg,
            variant: "destructive",
          });
        }

        // Small delay between requests to respect rate limits
        await new Promise((r) => setTimeout(r, 500));
      }

      if (pauseRequestedRef.current) break;
      if (i + BATCH_SIZE < toProcess.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    setIsProcessing(false);
    if (!pauseRequestedRef.current) {
      toast({
        title: "Processing complete",
        description: "All projects have been evaluated.",
        variant: "success",
      });
      refreshEvaluations();
    }
  }, [projects, toast, criteria, evaluationId, refreshEvaluations]);

  const pauseEvaluation = useCallback(() => {
    pauseRequestedRef.current = true;
  }, []);

  const evaluateSingleProject = useCallback(
    async (project: EvaluatedProject) => {
      const judgingCriteria = criteria.length > 0 ? criteria : [...DEFAULT_CRITERIA];
      const storedProvider = (localStorage.getItem(API_PROVIDER_STORAGE) || "gemini") as AIProvider;

      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, status: "processing" as const } : p))
      );
      setSelectedProject((prev) =>
        prev?.id === project.id ? { ...prev, status: "processing" as const } : prev
      );

      try {
        const res = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project, provider: storedProvider, criteria: judgingCriteria }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Evaluation failed");

        const { usage, driveNotAccessible, ...result } = data;
        if (usage) {
          setUsageLog((prev) => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              projectTitle: project["Project Title"],
              promptTokens: usage.promptTokens ?? 0,
              completionTokens: usage.completionTokens ?? 0,
              totalTokens: usage.totalTokens ?? 0,
            },
          ]);
        }
        const updated = {
          ...project,
          evaluation: result,
          status: "processed" as const,
          error: undefined,
          driveNotAccessible: driveNotAccessible ?? false,
        };
        setProjects((prev) =>
          prev.map((p) => (p.id === project.id ? updated : p))
        );
        setSelectedProject((prev) =>
          prev?.id === project.id ? { ...prev, ...updated } : prev
        );
        if (evaluationId) {
          fetch(`/api/evaluations/${evaluationId}/projects`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project: updated }),
          }).then(() => refreshEvaluations()).catch(() => {});
        }
        const totalPts = judgingCriteria.reduce((s, c) => s + c.points, 0);
        toast({
          title: "Re-evaluated",
          description: driveNotAccessible
            ? `${project["Project Title"]} — Score: ${result.score}/${totalPts} (Drive not accessible)`
            : `${project["Project Title"]} — Score: ${result.score}/${totalPts}`,
          variant: "success",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        const errProject = { ...project, status: "error" as const, error: msg };
        setProjects((prev) =>
          prev.map((p) => (p.id === project.id ? errProject : p))
        );
        setSelectedProject((prev) =>
          prev?.id === project.id ? { ...prev, ...errProject } : prev
        );
        if (evaluationId) {
          fetch(`/api/evaluations/${evaluationId}/projects`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project: errProject }),
          }).catch(() => {});
        }
        toast({ title: "Evaluation failed", description: msg, variant: "destructive" });
      }
    },
    [toast, criteria, evaluationId, refreshEvaluations]
  );

  const handleReEvaluate = useCallback(
    (project: EvaluatedProject, e: React.MouseEvent) => {
      e.stopPropagation();
      evaluateSingleProject({
        ...project,
        status: "pending",
        evaluation: undefined,
        error: undefined,
        cannotEvaluate: undefined,
      });
    },
    [evaluateSingleProject]
  );

  const handleExport = useCallback(
    (format: "csv" | "excel" | "pdf") => {
      if (projects.length === 0) {
        toast({
          title: "No data",
          description: "Upload a CSV and evaluate projects first.",
          variant: "destructive",
        });
        return;
      }
      const baseName = uploadedFileName || "hackathon-evaluations";
      const exportName = `${baseName} - evaluation`;
      const total = criteria.length > 0 ? criteria.reduce((s, c) => s + c.points, 0) : 100;
      if (format === "csv") {
        const csv = exportToCSV(projects, total);
        downloadCSV(csv, `${exportName}.csv`);
      } else if (format === "excel") {
        downloadExcel(projects, `${exportName}.xlsx`, total);
      } else {
        downloadPDF(projects, `${exportName}.pdf`, total);
      }
      toast({
        title: "Export complete",
        description: `${format.toUpperCase()} downloaded with original fields plus Marks, Reason, Pros & Cons.`,
        variant: "success",
      });
    },
    [projects, uploadedFileName, criteria, toast]
  );

  const handleDownloadUsageLog = useCallback(() => {
    if (usageLog.length === 0) {
      toast({
        title: "No usage data",
        description: "Evaluate projects to see AI credits/tokens used.",
        variant: "default",
      });
      return;
    }
    const total = usageLog.reduce((s, e) => s + e.totalTokens, 0);
    const lines = [
      "Hackathon Evaluator - AI Usage Log",
      `Generated: ${new Date().toISOString()}`,
      `Total evaluations: ${usageLog.length}`,
      `Total tokens used: ${total}`,
      "",
      "---",
      "",
      ...usageLog.map(
        (e) =>
          `[${e.timestamp}] ${e.projectTitle}: prompt=${e.promptTokens} completion=${e.completionTokens} total=${e.totalTokens}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hackathon-usage-log-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Usage log downloaded", variant: "success" });
  }, [usageLog, toast]);

  const filteredProjects = projects.filter((p) =>
    searchQuery
      ? p["Project Title"].toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    let cmp = 0;
    if (key === "title") {
      cmp = a["Project Title"].localeCompare(b["Project Title"]);
    } else if (key === "score") {
      if (a.cannotEvaluate && b.cannotEvaluate) cmp = 0;
      else if (a.cannotEvaluate) cmp = 1;
      else if (b.cannotEvaluate) cmp = -1;
      else {
        const sa = a.evaluation?.score ?? -1;
        const sb = b.evaluation?.score ?? -1;
        cmp = sa - sb;
      }
    } else if (key === "rank") {
      if (a.cannotEvaluate && b.cannotEvaluate) cmp = 0;
      else if (a.cannotEvaluate) cmp = 1;
      else if (b.cannotEvaluate) cmp = -1;
      else {
        const sa = a.evaluation?.score ?? -1;
        const sb = b.evaluation?.score ?? -1;
        cmp = sb - sa;
      }
    } else {
      cmp = a.status.localeCompare(b.status);
    }
    return direction === "asc" ? cmp : -cmp;
  });

  const sortedByScore = [...filteredProjects].sort((a, b) => {
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

  const toggleSort = (key: "title" | "score" | "status" | "rank") => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const SortIcon = ({
    column,
  }: {
    column: "title" | "score" | "status" | "rank";
  }) => {
    if (sortConfig?.key !== column) return null;
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1" />
    );
  };

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

  const maxScore =
    criteria.length > 0 ? criteria.reduce((s, c) => s + c.points, 0) : DEFAULT_CRITERIA.reduce((s, c) => s + c.points, 0);
  const getScoreBadge = (score: number, large?: boolean) => {
    const pct = maxScore > 0 ? score / maxScore : 0;
    const isHigh = pct >= 0.8;
    const isMid = pct >= 0.6 && !isHigh;
    const sizeClass = large ? "min-w-[4rem] px-3 py-1.5 text-2xl sm:text-3xl" : "min-w-[2.5rem] px-2 py-0.5 text-sm";
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md font-bold ${sizeClass} ${
          isHigh ? "bg-chart-2/25 text-chart-2" : isMid ? "bg-chart-3/25 text-chart-3" : "bg-chart-5/25 text-chart-5"
        }`}
      >
        {score}/{maxScore}
      </span>
    );
  };

  const processedCount = projects.filter((p) => p.status === "processed").length;
  const pendingCount = projects.filter((p) => p.status === "pending").length;
  const errorCount = projects.filter((p) => p.status === "error").length;
  const toProcessCount = pendingCount + errorCount;

  return (
    <div className="relative min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl supports-[padding:env(safe-area-inset-top)]:pt-[env(safe-area-inset-top)]">
        <div className="flex min-h-12 sm:h-16 items-center justify-between px-3 sm:px-4 max-w-7xl mx-auto gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
            className="gap-1.5 sm:gap-2 min-h-[44px] h-11 sm:h-10 text-sm"
          >
            <Settings className="h-4 w-4 shrink-0" />
            Settings
          </Button>
          <AuthButton />
        </div>
      </header>

      <main className="container px-3 sm:px-4 py-4 sm:py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-6 sm:space-y-8 max-w-7xl mx-auto">
        <AuthGuard>
        {/* Settings Dialog */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto mx-2 sm:mx-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Settings
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-8">
              {/* AI Provider Toggle */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Evaluate with</h3>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={apiProvider === "gemini" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 min-h-[44px]"
                    onClick={() => {
                      setApiProvider("gemini");
                      localStorage.setItem(API_PROVIDER_STORAGE, "gemini");
                    }}
                  >
                    Gemini
                  </Button>
                  <Button
                    type="button"
                    variant={apiProvider === "openai" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 min-h-[44px]"
                    onClick={() => {
                      setApiProvider("openai");
                      localStorage.setItem(API_PROVIDER_STORAGE, "openai");
                    }}
                  >
                    OpenAI
                  </Button>
                </div>
              </div>

              {/* Judging Criteria */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-foreground">Judging Criteria</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Define the criteria for evaluating projects. These criteria are used by the AI
                  and shown in the project detail modal. Each criterion has a name, points, and
                  optional description. Total:{" "}
                  <span className="font-medium text-foreground">
                    {criteria.reduce((s, c) => s + c.points, 0)} points
                  </span>
                </p>
                <div className="space-y-3">
                  {criteria.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-3 sm:p-4 rounded-lg border border-border bg-muted/30 space-y-2 overflow-hidden"
                    >
                      <div className="flex gap-2 items-center min-w-0">
                        <span className="text-sm font-medium text-muted-foreground w-6 shrink-0">
                          {idx + 1}.
                        </span>
                        <Input
                          placeholder="Criterion name"
                          value={c.name}
                          onChange={(e) => {
                            const next = [...criteria];
                            next[idx] = { ...next[idx], name: e.target.value };
                            setCriteria(next);
                            if (evaluationId) {
                              fetch(`/api/evaluations/${evaluationId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ criteria: next }),
                              }).catch(() => {});
                            }
                          }}
                          className="h-9 font-medium flex-1 min-w-0"
                        />
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          placeholder="Pts"
                          value={c.points}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 1) {
                              const next = [...criteria];
                              next[idx] = { ...next[idx], points: v };
                            setCriteria(next);
                            if (evaluationId) {
                              fetch(`/api/evaluations/${evaluationId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ criteria: next }),
                              }).catch(() => {});
                            }
                            }
                          }}
                          className="h-9 w-14 shrink-0"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            const next = criteria.filter((_, i) => i !== idx);
                            setCriteria(next);
                            if (evaluationId) {
                              fetch(`/api/evaluations/${evaluationId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ criteria: next.length ? next : [] }),
                              }).catch(() => {});
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Description (optional)"
                        value={c.description ?? ""}
                        onChange={(e) => {
                          const next = [...criteria];
                          next[idx] = { ...next[idx], description: e.target.value || undefined };
                            setCriteria(next);
                            if (evaluationId) {
                              fetch(`/api/evaluations/${evaluationId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ criteria: next }),
                              }).catch(() => {});
                            }
                        }}
                        className="h-8 text-sm w-full min-w-0"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 flex-1 min-w-[140px] min-h-[44px]"
                    onClick={() => {
                      const next = [...criteria, { name: "New criterion", points: 1, description: "" }];
                            setCriteria(next);
                            if (evaluationId) {
                              fetch(`/api/evaluations/${evaluationId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ criteria: next }),
                              }).catch(() => {});
                            }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add criterion
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 min-h-[44px]"
                    onClick={() => {
                      fetch("/api/criteria", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ criteria }),
                      })
                        .then((res) => {
                          if (res.ok) {
                            toast({
                              title: "Saved as default",
                              description: "New evaluations will use these criteria.",
                              variant: "success",
                            });
                          }
                        })
                        .catch(() => {});
                    }}
                  >
                    Save as default
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 min-h-[44px]"
                    onClick={() => {
                      fetch("/api/criteria")
                        .then((res) => (res.ok ? res.json() : { criteria: DEFAULT_CRITERIA }))
                        .then((data: { criteria?: JudgingCriterion[] }) => {
                          const defaultCriteria =
                            Array.isArray(data.criteria) && data.criteria.length > 0
                              ? data.criteria
                              : DEFAULT_CRITERIA;
                          setCriteria([...defaultCriteria]);
                          if (evaluationId) {
                            fetch(`/api/evaluations/${evaluationId}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ criteria: defaultCriteria }),
                            }).catch(() => {});
                          }
                          toast({
                            title: "Reset to defaults",
                            description: "Judging criteria updated.",
                            variant: "success",
                          });
                        })
                        .catch(() => {
                          setCriteria([...DEFAULT_CRITERIA]);
                          if (evaluationId) {
                            fetch(`/api/evaluations/${evaluationId}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ criteria: DEFAULT_CRITERIA }),
                            }).catch(() => {});
                          }
                          toast({
                            title: "Reset to defaults",
                            description: "Judging criteria updated.",
                            variant: "success",
                          });
                        });
                    }}
                  >
                    Reset to default
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* CSV Validation Error Dialog */}
        <Dialog open={!!csvError} onOpenChange={(open) => !open && setCsvError(null)}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-lg mx-2 sm:mx-4 max-h-[85dvh] sm:max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5 shrink-0" />
                {csvError?.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-base leading-relaxed">
              {csvError?.validation.parseError && (
                <p className="text-foreground">
                  {csvError.validation.parseError}
                </p>
              )}
              {csvError?.validation.missingHeaders &&
                csvError.validation.missingHeaders.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">
                      Your CSV is missing these required columns:
                    </p>
                    <ul className="list-inside list-disc space-y-1 rounded-lg bg-muted/50 px-4 py-3 text-sm text-foreground">
                      {csvError.validation.missingHeaders.map((h) => (
                        <li key={h} className="leading-7">
                          {h}
                        </li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground">
                      Column names must match exactly (including punctuation and
                      capitalization). Use{" "}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
                        sample-submissions.csv
                      </code>{" "}
                      as a reference.
                    </p>
                  </div>
                )}
              {csvError?.validation.foundHeaders &&
                csvError.validation.foundHeaders.length > 0 &&
                csvError.validation.missingHeaders?.length > 0 && (
                  <details className="rounded-lg border border-border p-3">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                      Columns found in your file ({csvError.validation.foundHeaders.length})
                    </summary>
                    <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-sm text-muted-foreground">
                      {csvError.validation.foundHeaders.map((h) => (
                        <li key={h} className="truncate">
                          {h || "(empty)"}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Evaluation List */}
        {!loadingEvaluations && (
          <EvaluationList
            evaluations={evaluations}
            activeId={evaluationId}
            onSelect={setEvaluationId}
            onCreateNew={() => setEvaluationId(null)}
            onDelete={handleDeleteEvaluation}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
          />
        )}

        {/* CSV Upload */}
        <Card className="shadow-soft overflow-hidden animate-in-slide-slow">
          <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
            <CardTitle className="flex justify-center text-center text-xl sm:text-2xl">
              <ShinyText
                text="Upload Submissions"
                speed={2}
                color="var(--foreground)"
                shineColor="var(--primary)"
                spread={120}
                direction="left"
              />
            </CardTitle>
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto text-center space-y-3">
              <p>
                Use a CSV with submission data.
              </p>
              <details className="column-list-details rounded-lg border border-border bg-muted/30 p-3 transition-colors duration-200">
                <summary className="flex items-center justify-center cursor-pointer font-medium text-foreground hover:text-primary transition-colors duration-200 select-none list-none [&::-webkit-details-marker]:hidden">
                  View full column list
                </summary>
                <ul className="column-list-content mt-2 space-y-1 text-xs text-center list-none">
                  <li>• Timestamp, Email, Phone Number, Project Title</li>
                  <li>• What real-world problem are you solving?</li>
                  <li>• Who is this problem for? (Profession / domain / user type)</li>
                  <li>• How does your solution use AI?</li>
                  <li>• What AI Tools / Platforms have you used</li>
                  <li>• How does your solution help the user? (example-time saved…)</li>
                  <li>• Please share GOOGLE DRIVE link having your project demo video, files and images</li>
                  <li>• Explain your solution in detail (For ex. what you did, why is this useful)</li>
                  <li>• What was the biggest challenge you faced during this hackathon?</li>
                  <li className="text-muted-foreground/80">Optional: Score and Reason</li>
                </ul>
              </details>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-6 sm:p-10 md:p-14 text-center transition-all duration-500 ease-out ${
                isDragging
                  ? "border-primary bg-primary/10 scale-[1.01] shadow-glow"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className={`mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl transition-colors ${
                isDragging ? "bg-primary/20" : "bg-muted"
              }`}>
                <Upload className={`h-8 w-8 transition-colors ${
                  isDragging ? "text-primary" : "text-muted-foreground"
                }`} />
              </div>
              <p className="text-sm sm:text-base font-medium text-foreground mb-1">
                {isDragging ? "Drop your file here" : "Drag and drop your CSV here"}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
                or click to browse from your computer
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
                id="csv-upload"
              />
              <Button
                variant="secondary"
                onClick={() =>
                  document.getElementById("csv-upload")?.click()
                }
                className="gap-2 min-h-[44px] h-11 px-6"
              >
                <Upload className="h-4 w-4" />
                Choose file
              </Button>
              {projects.length > 0 && uploadedFileName && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Current file: <span className="font-medium text-foreground">{uploadedFileName}.csv</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions & Table */}
        {projects.length > 0 && (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 animate-in-fade">
              <Card className="shadow-soft">
                <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground truncate">{projects.length}</p>
                    <p className="text-xs text-muted-foreground">Total Projects</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-chart-2/20 text-chart-2 shrink-0">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground truncate">{processedCount}</p>
                    <p className="text-xs text-muted-foreground">Processed</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-chart-3/20 text-chart-3 shrink-0">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground truncate">{toProcessCount}</p>
                    <p className="text-xs text-muted-foreground">
                      To Process{errorCount > 0 ? ` (${pendingCount} pending, ${errorCount} retry)` : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft sm:col-span-1">
                <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-chart-1/20 text-chart-1 shrink-0">
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground truncate">
                      {processedCount > 0 ? Math.round((processedCount / projects.length) * 100) : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">Complete</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-stretch sm:items-center animate-in-fade">
              <div className="relative w-full sm:w-80 md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 sm:pl-10 h-11 rounded-lg focus-visible:ring-2 text-sm sm:text-base"
                />
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Button
                  onClick={processAll}
                  disabled={isProcessing || toProcessCount === 0}
                  className="gap-1.5 sm:gap-2 flex-1 sm:flex-initial min-h-[44px] h-11 px-4 sm:px-6 text-sm bg-primary hover:bg-primary/90"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Process All
                </Button>
                {isProcessing && (
                  <Button
                    variant="outline"
                    onClick={pauseEvaluation}
                    className="gap-1.5 sm:gap-2 min-h-[44px] h-11 px-4 sm:px-6 text-sm border-destructive/50 text-destructive hover:bg-destructive/10"
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-1.5 sm:gap-2 flex-1 sm:flex-initial min-h-[44px] h-11 px-4 sm:px-6 text-sm"
                    >
                      <Download className="h-4 w-4" />
                      Export
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport("csv")}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("excel")}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("pdf")}>
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {evaluationId && (
                  <ShareButton
                    evaluationId={evaluationId}
                    className="gap-1.5 min-h-[44px] h-11 px-3 sm:px-4 text-sm"
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 min-h-[44px] h-11 px-3 sm:px-4 text-sm"
                  onClick={handleDownloadUsageLog}
                  title="Download AI usage/credits log"
                >
                  <BarChart3 className="h-4 w-4" />
                  Usage log
                </Button>
              </div>
            </div>

            <Card className="shadow-soft overflow-hidden animate-in-slide">
              <CardContent className="p-0">
                {/* Mobile: sort filter */}
                <div className="sm:hidden flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                  <span className="text-sm font-medium text-muted-foreground shrink-0">Sort by</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-h-[44px] justify-between gap-2 font-normal"
                      >
                        <span className="truncate">
                          {sortConfig?.key === "title" && (sortConfig.direction === "asc" ? "Title (A→Z)" : "Title (Z→A)")}
                          {sortConfig?.key === "score" && (sortConfig.direction === "desc" ? "Score (high first)" : "Score (low first)")}
                          {sortConfig?.key === "rank" && (sortConfig.direction === "asc" ? "Rank (1st first)" : "Rank (last first)")}
                          {sortConfig?.key === "status" && (sortConfig.direction === "asc" ? "Status (A→Z)" : "Status (Z→A)")}
                          {!sortConfig && "Select..."}
                        </span>
                        <ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[calc(100vw-3rem)] max-w-[280px]">
                      <DropdownMenuItem onClick={() => setSortConfig({ key: "title", direction: "asc" })}>
                        Title (A→Z)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortConfig({ key: "title", direction: "desc" })}>
                        Title (Z→A)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortConfig({ key: "score", direction: "desc" })}>
                        Score (high first)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortConfig({ key: "score", direction: "asc" })}>
                        Score (low first)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortConfig({ key: "rank", direction: "asc" })}>
                        Rank (1st first)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortConfig({ key: "rank", direction: "desc" })}>
                        Rank (last first)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortConfig({ key: "status", direction: "asc" })}>
                        Status (A→Z)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortConfig({ key: "status", direction: "desc" })}>
                        Status (Z→A)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {/* Mobile: card list */}
                <div className="sm:hidden divide-y divide-border">
                  {sortedProjects.map((project, idx) => (
                    <button
                      type="button"
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      className={`w-full text-left px-4 py-3.5 active:bg-muted/50 transition-colors touch-manipulation min-h-[52px] flex items-center gap-3 ${
                        idx % 2 === 1 ? "bg-muted/20" : ""
                      }`}
                    >
                      <span className="text-muted-foreground font-medium text-sm w-6 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate text-sm">
                          {project["Project Title"] || "Untitled"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {project.Email || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {project.driveNotAccessible && (
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0" />
                        )}
                        {project.cannotEvaluate ? (
                          <span className="text-amber-600 dark:text-amber-500 text-xs font-medium">
                            N/A
                          </span>
                        ) : project.evaluation ? (
                          getScoreBadge(project.evaluation.score)
                        ) : project.status === "error" ? (
                          <XCircle className="h-4 w-4 text-chart-5 shrink-0" />
                        ) : project.status === "processing" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-chart-1 shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        {!project.cannotEvaluate && rankMap.has(project.id) && (
                          <span className="text-muted-foreground font-medium text-xs">
                            #{rankMap.get(project.id)}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
                {/* Desktop: table */}
                <div className="hidden sm:block -mx-2 sm:mx-0 overflow-x-auto">
                  <table className="w-full min-w-[500px] sm:min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left p-2 sm:p-4 font-semibold w-10 sm:w-14 shrink-0 text-xs sm:text-base">
                          <span className="text-glow">
                            <ShinyText text="S.No" speed={2} color="var(--foreground)" shineColor="var(--primary)" spread={120} direction="left" />
                          </span>
                        </th>
                        <th className="text-left p-2 sm:p-4 font-semibold text-xs sm:text-base min-w-[180px] sm:min-w-[240px]">
                          <span className="text-glow">
                            <ShinyText text="Email" speed={2} color="var(--foreground)" shineColor="var(--primary)" spread={120} direction="left" />
                          </span>
                        </th>
                        <th
                          className="text-left p-2 sm:p-4 font-semibold cursor-pointer hover:bg-muted transition-colors select-none text-xs sm:text-base"
                          onClick={() => toggleSort("title")}
                        >
                          <span className="flex items-center gap-1 text-glow">
                            <ShinyText text="Project Title" speed={2} color="var(--foreground)" shineColor="var(--primary)" spread={120} direction="left" />
                            <SortIcon column="title" />
                          </span>
                        </th>
                        <th
                          className="text-left p-2 sm:p-4 font-semibold cursor-pointer hover:bg-muted transition-colors select-none text-xs sm:text-base"
                          onClick={() => toggleSort("score")}
                        >
                          <span className="flex items-center gap-1 whitespace-nowrap text-glow">
                            <ShinyText text="Total Score" speed={2} color="var(--foreground)" shineColor="var(--primary)" spread={120} direction="left" />
                            <SortIcon column="score" />
                          </span>
                        </th>
                        <th
                          className="text-left p-2 sm:p-4 font-semibold cursor-pointer hover:bg-muted transition-colors select-none text-xs sm:text-base"
                          onClick={() => toggleSort("rank")}
                        >
                          <span className="flex items-center gap-1 text-glow">
                            <ShinyText text="Rank" speed={2} color="var(--foreground)" shineColor="var(--primary)" spread={120} direction="left" />
                            <SortIcon column="rank" />
                          </span>
                        </th>
                        <th
                          className="text-left p-2 sm:p-4 font-semibold cursor-pointer hover:bg-muted transition-colors select-none text-xs sm:text-base"
                          onClick={() => toggleSort("status")}
                        >
                          <span className="flex items-center gap-1 text-glow">
                            <ShinyText text="Status" speed={2} color="var(--foreground)" shineColor="var(--primary)" spread={120} direction="left" />
                            <SortIcon column="status" />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProjects.map((project, idx) => (
                        <tr
                          key={project.id}
                          className={`border-b border-border cursor-pointer transition-colors hover:bg-muted/50 ${
                            idx % 2 === 1 ? "bg-muted/20" : ""
                          }`}
                          onClick={() => setSelectedProject(project)}
                        >
                          <td className="p-2 sm:p-4 text-muted-foreground font-medium w-10 sm:w-14 text-xs sm:text-base">
                            {idx + 1}
                          </td>
                          <td className="p-2 sm:p-4 text-xs sm:text-sm text-foreground break-all min-w-0 max-w-[200px] sm:max-w-[260px]">
                            {project.Email || "—"}
                          </td>
                          <td className="p-2 sm:p-4 font-medium text-foreground text-sm sm:text-base break-words">
                            {project["Project Title"] || "Untitled"}
                          </td>
                          <td className="p-2 sm:p-4">
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
                          <td className="p-2 sm:p-4">
                            {rankMap.has(project.id) ? (
                              <span className="font-medium text-foreground">
                                #{rankMap.get(project.id)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-2 sm:p-4">
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
          </>
        )}

        {projects.length === 0 && (
          <Card className="border-dashed border-border bg-muted/30 animate-in-scale">
            <CardContent className="flex flex-col items-center justify-center py-12 sm:py-20 text-center px-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted mb-6 animate-in-fade">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2">
                <span className="inline-block text-glow">
                  <ShinyText
                    text="No projects yet"
                    speed={2}
                    color="var(--foreground)"
                    shineColor="var(--primary)"
                    spread={120}
                    direction="left"
                  />
                </span>
              </h3>
              <p className="text-muted-foreground max-w-sm mb-6 text-base">
                Upload a CSV file with hackathon submissions above to get started. We&apos;ll evaluate each project with AI.
              </p>
              <Button
                variant="outline"
                onClick={() => document.getElementById("csv-upload")?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload your first CSV
              </Button>
            </CardContent>
          </Card>
        )}
        </AuthGuard>
      </main>

      {/* Detail View Modal */}
      <Dialog
        open={!!selectedProject}
        onOpenChange={(open) => !open && setSelectedProject(null)}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-5xl max-h-[90dvh] sm:max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-xl mx-2 sm:mx-4 p-4 sm:p-6">
          {selectedProject && (
            <>
              <DialogHeader className="space-y-3">
                <DialogTitle className="text-xl text-center sm:text-left">
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
                </DialogTitle>
                <div className="flex justify-center py-2">
                  {selectedProject.cannotEvaluate ? (
                    <span className="text-amber-600 dark:text-amber-500 text-lg sm:text-xl font-medium px-3 py-1.5 rounded bg-amber-500/10">
                      Cannot be evaluated
                    </span>
                  ) : selectedProject.evaluation ? (
                    getScoreBadge(selectedProject.evaluation.score, true)
                  ) : null}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 items-center">
                  <p className="text-sm text-muted-foreground shrink-0">
                    {selectedProject.evaluation
                      ? "Original submission vs AI critique"
                      : "View submission details"}
                  </p>
                  {(selectedProject.evaluation ||
                    selectedProject.status === "error" ||
                    selectedProject.cannotEvaluate) && (
                    <div className="flex flex-wrap items-center justify-center gap-2 min-w-0">
                      {selectedProject.driveNotAccessible && (
                        <span className="text-amber-600 dark:text-amber-500 text-sm font-medium px-2 py-1 rounded bg-amber-500/10 inline-flex items-center gap-1 shrink-0">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Drive not accessible
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 min-h-[44px] shrink-0"
                        onClick={(e) =>
                          handleReEvaluate(
                            { ...selectedProject, cannotEvaluate: false, driveNotAccessible: false },
                            e
                          )
                        }
                        disabled={isProcessing || selectedProject.status === "processing"}
                      >
                        {selectedProject.status === "processing" ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Re-evaluating...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-3.5 w-3.5" />
                            Re-evaluate
                          </>
                        )}
                      </Button>
                    </div>
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
                    <div className="md:hidden">
                      <span className="font-medium text-muted-foreground block mb-1">Email</span>
                      <p className="text-foreground break-all">{selectedProject.Email || "—"}</p>
                    </div>
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
                      <span className="font-medium text-slate-600 dark:text-slate-400 block mb-1">Demo (Google Drive)</span>
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
                      <p className="text-muted-foreground">
                        This project was manually flagged. You can click Re-evaluate to run AI evaluation again if
                        access is restored.
                      </p>
                    </div>
                  ) : selectedProject.evaluation ? (
                    <div className="space-y-4 text-sm rounded-lg bg-primary/5 border border-primary/20 p-4">
                      <div>
                        <span className="font-medium text-muted-foreground block mb-1">Score</span>
                        <div className="mt-1">{getScoreBadge(selectedProject.evaluation.score, true)}</div>
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
                        <div>
                          <span className="font-medium text-muted-foreground block mb-2">
                            Score breakdown (by criteria from Settings)
                          </span>
                          {(() => {
                            const scores = selectedProject.evaluation.criteria_scores ?? [];
                            const scoresByName = new Map(scores.map((s) => [s.name, s]));
                            const rows = criteria.map((c) => {
                              const s = scoresByName.get(c.name);
                              return s
                                ? { name: c.name, max: c.points, given: s.given }
                                : { name: c.name, max: c.points, given: null as number | null };
                            });
                            return (
                              <>
                                {/* Mobile: card list */}
                                <div className="md:hidden space-y-2">
                                  {rows.map((row, i) => {
                                    const given = typeof (row as { given?: number }).given === "number" ? (row as { given: number }).given : null;
                                    const pct = row.max > 0 && given !== null ? (given / row.max) * 100 : 0;
                                    const badgeColor = pct >= 80 ? "bg-chart-2/25 text-chart-2" : pct >= 60 ? "bg-chart-3/25 text-chart-3" : "bg-chart-5/25 text-chart-5";
                                    const barColor = pct >= 80 ? "bg-chart-2/40" : pct >= 60 ? "bg-chart-3/40" : "bg-chart-5/40";
                                    return (
                                      <div
                                        key={i}
                                        className="rounded-lg border border-border bg-muted/30 p-3 min-h-[44px] flex flex-col gap-2"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-sm font-medium text-foreground break-words flex-1 min-w-0">
                                            {row.name}
                                          </p>
                                          {given !== null ? (
                                            <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-md text-sm font-bold shrink-0 tabular-nums ${badgeColor}`}>
                                              {given}/{row.max}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground text-sm">—</span>
                                          )}
                                        </div>
                                        {given !== null && (
                                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                            <div
                                              className={`h-full rounded-full transition-all ${barColor}`}
                                              style={{ width: `${Math.min(100, pct)}%` }}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between font-semibold">
                                    <span className="text-foreground">Total</span>
                                    {getScoreBadge(selectedProject.evaluation.score, true)}
                                  </div>
                                </div>
                                {/* Desktop: table */}
                                <div className="hidden md:block rounded-lg border border-border overflow-x-auto">
                                  <table className="w-full text-sm min-w-[200px]">
                                    <thead>
                                      <tr className="bg-muted/50 border-b border-border">
                                        <th className="text-left p-2 sm:p-3 font-medium text-foreground">Criterion</th>
                                        <th className="text-right p-2 sm:p-3 font-medium text-foreground w-20">Max</th>
                                        <th className="text-right p-2 sm:p-3 font-medium text-foreground w-20">Given</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rows.map((row, i) => (
                                        <tr key={i} className="border-b border-border last:border-0">
                                          <td className="p-2 sm:p-3 text-foreground break-words">{row.name}</td>
                                          <td className="p-2 sm:p-3 text-right text-muted-foreground">{row.max}</td>
                                          <td className="p-2 sm:p-3 text-right font-medium text-foreground">
                                            {typeof (row as { given?: number }).given === "number" ? (row as { given: number }).given : "—"}
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
                              </>
                            );
                          })()}
                        </div>
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
                      <p className="text-muted-foreground">
                        Not yet evaluated. Click &quot;Process All&quot; to run AI evaluation.
                      </p>
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
