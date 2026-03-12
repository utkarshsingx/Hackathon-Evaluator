"use client";

import { useCallback, useState, useEffect } from "react";
import {
  Settings,
  Upload,
  Play,
  Download,
  Search,
  ChevronUp,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileSpreadsheet,
  Sparkles,
  BarChart3,
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
import { useToast } from "@/components/ui/use-toast";
import { evaluateProject } from "@/lib/gemini";
import { parseCSV, exportToCSV, downloadCSV } from "@/lib/csv";
import type { EvaluatedProject, HackathonProject } from "@/lib/types";
import ShinyText from "@/components/ShinyText";

const API_KEY_STORAGE = "gemini-api-key";
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000;

export function Dashboard() {
  const [apiKey, setApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [projects, setProjects] = useState<EvaluatedProject[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: "title" | "score" | "status";
    direction: "asc" | "desc";
  } | null>(null);
  const [selectedProject, setSelectedProject] =
    useState<EvaluatedProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  // Load API key from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(API_KEY_STORAGE);
    if (stored) setApiKey(stored);
  }, []);

  const saveApiKey = useCallback(() => {
    const key = apiKey.trim();
    if (key) {
      localStorage.setItem(API_KEY_STORAGE, key);
      toast({
        title: "API Key saved",
        description: "Your API key has been stored securely.",
        variant: "success",
      });
      setShowSettings(false);
    } else {
      toast({
        title: "Invalid key",
        description: "Please enter a valid API key.",
        variant: "destructive",
      });
    }
  }, [apiKey, toast]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".csv")) {
        toast({
          title: "Invalid file",
          description: "Please upload a CSV file.",
          variant: "destructive",
        });
        return;
      }

      try {
        const parsedProjects = await parseCSV(file);
        const evaluated: EvaluatedProject[] = parsedProjects.map((p) => ({
          ...p,
          status: "pending" as const,
        }));
        setProjects(evaluated);
        toast({
          title: "CSV loaded",
          description: `${evaluated.length} projects loaded successfully.`,
          variant: "success",
        });
      } catch (err) {
        toast({
          title: "Upload failed",
          description:
            err instanceof Error ? err.message : "Failed to parse CSV",
          variant: "destructive",
        });
      }
    },
    [toast]
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
    const storedKey = localStorage.getItem(API_KEY_STORAGE);
    if (!storedKey?.trim()) {
      toast({
        title: "API key required",
        description: "Please add your API key in Settings first.",
        variant: "destructive",
      });
      setShowSettings(true);
      return;
    }

    const pending = projects.filter((p) => p.status === "pending");
    if (pending.length === 0) {
      toast({
        title: "Nothing to process",
        description: "All projects have already been evaluated.",
        variant: "default",
      });
      return;
    }

    setIsProcessing(true);

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);

      for (const project of batch) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === project.id ? { ...p, status: "processing" as const } : p
          )
        );

        try {
          const result = await evaluateProject(storedKey, project);
          setProjects((prev) =>
            prev.map((p) =>
              p.id === project.id
                ? {
                    ...p,
                    evaluation: result,
                    status: "processed" as const,
                  }
                : p
            )
          );
          toast({
            title: `Evaluated: ${project["Project Title"]}`,
            description: `Score: ${result.score}/10`,
            variant: "success",
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          setProjects((prev) =>
            prev.map((p) =>
              p.id === project.id
                ? {
                    ...p,
                    status: "error" as const,
                    error: msg,
                  }
                : p
            )
          );
          toast({
            title: `Error: ${project["Project Title"]}`,
            description: msg,
            variant: "destructive",
          });
        }

        // Small delay between requests to respect rate limits
        await new Promise((r) => setTimeout(r, 500));
      }

      if (i + BATCH_SIZE < pending.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    setIsProcessing(false);
    toast({
      title: "Processing complete",
      description: "All projects have been evaluated.",
      variant: "success",
    });
  }, [projects, toast]);

  const handleExport = useCallback(() => {
    if (projects.length === 0) {
      toast({
        title: "No data",
        description: "Upload a CSV and evaluate projects first.",
        variant: "destructive",
      });
      return;
    }
    const csv = exportToCSV(projects);
    downloadCSV(csv);
    toast({
      title: "Export complete",
      description: "Evaluations downloaded as CSV.",
      variant: "success",
    });
  }, [projects, toast]);

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
      const sa = a.evaluation?.score ?? -1;
      const sb = b.evaluation?.score ?? -1;
      cmp = sa - sb;
    } else {
      cmp = a.status.localeCompare(b.status);
    }
    return direction === "asc" ? cmp : -cmp;
  });

  const toggleSort = (key: "title" | "score" | "status") => {
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
    column: "title" | "score" | "status";
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

  const getScoreBadge = (score: number) => {
    if (score >= 8) {
      return (
        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-md text-sm font-bold bg-chart-2/25 text-chart-2">
          {score}/10
        </span>
      );
    }
    if (score >= 6) {
      return (
        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-md text-sm font-bold bg-chart-3/25 text-chart-3">
          {score}/10
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-md text-sm font-bold bg-chart-5/25 text-chart-5">
        {score}/10
      </span>
    );
  };

  const processedCount = projects.filter((p) => p.status === "processed").length;
  const pendingCount = projects.filter((p) => p.status === "pending").length;

  return (
    <div className="relative min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-center px-4 max-w-7xl mx-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </header>

      <main className="container px-4 py-8 space-y-8 max-w-7xl mx-auto">
        {/* API Key Settings Dialog */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                API Key Setup
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Enter your API key. It will be stored locally in
                your browser (localStorage) and never sent to our servers.
              </p>
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveApiKey()}
                  className="h-11"
                />
              </div>
              <Button onClick={saveApiKey} className="w-full h-11">
                Save & Continue
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* CSV Upload */}
        <Card className="shadow-soft overflow-hidden animate-in-slide-slow">
          <CardHeader className="pb-4">
            <CardTitle className="flex justify-center text-center text-2xl">
              <ShinyText
                text="Upload Submissions"
                speed={2}
                color="var(--foreground)"
                shineColor="var(--primary)"
                spread={120}
                direction="left"
              />
            </CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto text-center">
              Upload a CSV with the required columns: Timestamp, Email, Phone Number, Project
              Title, What real-world problem are you solving?, Who is this problem for?, How does your solution use AI?, What AI Tools / Platforms have you used, How does your solution help the user?, Demo Link, Detailed Explanation, Biggest Challenge.
            </p>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-14 text-center transition-all duration-500 ease-out ${
                isDragging
                  ? "border-primary bg-primary/10 scale-[1.01] shadow-glow"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${
                isDragging ? "bg-primary/20" : "bg-muted"
              }`}>
                <Upload className={`h-8 w-8 transition-colors ${
                  isDragging ? "text-primary" : "text-muted-foreground"
                }`} />
              </div>
              <p className="text-base font-medium text-foreground mb-1">
                {isDragging ? "Drop your file here" : "Drag and drop your CSV here"}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
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
                className="gap-2 h-10 px-6"
              >
                <Upload className="h-4 w-4" />
                Choose file
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Actions & Table */}
        {projects.length > 0 && (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-in-fade">
              <Card className="shadow-soft">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{projects.length}</p>
                    <p className="text-xs text-muted-foreground">Total Projects</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/20 text-chart-2">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{processedCount}</p>
                    <p className="text-xs text-muted-foreground">Processed</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/20 text-chart-3">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-soft sm:col-span-1">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/20 text-chart-1">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {processedCount > 0 ? Math.round((processedCount / projects.length) * 100) : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">Complete</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center animate-in-fade">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by project title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 rounded-lg focus-visible:ring-2"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  onClick={processAll}
                  disabled={isProcessing}
                  className="gap-2 flex-1 sm:flex-initial h-11 px-6 bg-primary hover:bg-primary/90"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Process All
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  className="gap-2 flex-1 sm:flex-initial h-11 px-6"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>

            <Card className="shadow-soft overflow-hidden animate-in-slide">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th
                          className="text-left p-4 font-semibold text-foreground cursor-pointer hover:bg-muted transition-colors select-none"
                          onClick={() => toggleSort("title")}
                        >
                          <span className="flex items-center gap-1">
                            Project Title
                            <SortIcon column="title" />
                          </span>
                        </th>
                        <th
                          className="text-left p-4 font-semibold text-foreground cursor-pointer hover:bg-muted transition-colors select-none"
                          onClick={() => toggleSort("score")}
                        >
                          <span className="flex items-center gap-1">
                            Total Score
                            <SortIcon column="score" />
                          </span>
                        </th>
                        <th
                          className="text-left p-4 font-semibold text-foreground cursor-pointer hover:bg-muted transition-colors select-none"
                          onClick={() => toggleSort("status")}
                        >
                          <span className="flex items-center gap-1">
                            Status
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
                          <td className="p-4 font-medium text-foreground">
                            {project["Project Title"] || "Untitled"}
                          </td>
                          <td className="p-4">
                            {project.evaluation ? (
                              getScoreBadge(project.evaluation.score)
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-4">
                            {getStatusBadge(project.status)}
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
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted mb-6 animate-in-fade">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-bold mb-2">
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
      </main>

      {/* Detail View Modal */}
      <Dialog
        open={!!selectedProject}
        onOpenChange={(open) => !open && setSelectedProject(null)}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto shadow-xl">
          {selectedProject && (
            <>
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-xl flex items-center gap-2">
                  {selectedProject["Project Title"]}
                  {selectedProject.evaluation && (
                    getScoreBadge(selectedProject.evaluation.score)
                  )}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedProject.evaluation
                    ? "Original submission vs AI critique"
                    : "View submission details"}
                </p>
              </DialogHeader>
              <div className="grid md:grid-cols-2 gap-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                      Original Submission
                    </h3>
                  </div>
                  <div className="space-y-4 text-sm rounded-lg bg-muted/50 p-4">
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">Problem</span>
                      <p className="text-foreground">{selectedProject["What real-world problem are you solving?"] || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">Target audience</span>
                      <p className="text-foreground">{selectedProject["Who is this problem for?"] || "—"}</p>
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
                      <p className="text-foreground">{selectedProject["How does your solution help the user?"] || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-slate-600 dark:text-slate-400 block mb-1">Demo</span>
                      <a
                        href={selectedProject["Demo Link"]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline hover:no-underline font-medium"
                      >
                        {selectedProject["Demo Link"] || "—"}
                      </a>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">Detailed explanation</span>
                      <p className="text-foreground">{selectedProject["Detailed Explanation"] || "—"}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">Biggest challenge</span>
                      <p className="text-foreground">{selectedProject["Biggest Challenge"] || "—"}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                      AI Critique
                    </h3>
                  </div>
                  {selectedProject.evaluation ? (
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
