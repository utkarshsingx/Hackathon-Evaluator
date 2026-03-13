"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ShareButtonProps {
  evaluationId: string;
  disabled?: boolean;
  className?: string;
}

export function ShareButton({
  evaluationId,
  disabled,
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleShare = async () => {
    try {
      const res = await fetch(`/api/evaluations/${evaluationId}/share`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create share link");
      }

      const { url } = data;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share this link with anyone to view the results.",
        variant: "success",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to create link",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      disabled={disabled}
      className={className}
    >
      {copied ? (
        <Check className="h-4 w-4 mr-2 text-chart-2" />
      ) : (
        <Share2 className="h-4 w-4 mr-2" />
      )}
      {copied ? "Copied!" : "Share"}
    </Button>
  );
}
