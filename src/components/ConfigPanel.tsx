import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Play, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConfigPanelProps {
  additionalInfo: string;
  onAdditionalInfoChange: (val: string) => void;
  onFindFailing: () => void;
  onRunSingle: () => void;
  loading: boolean;
  analysisResult: Record<string, unknown> | null;
  analysisError: string | null;
  analyzing: boolean;
  onAnalyze: () => void;
}

export default function ConfigPanel({
  additionalInfo,
  onAdditionalInfoChange,
  onFindFailing,
  onRunSingle,
  loading,
  analysisResult,
  analysisError,
  analyzing,
  onAnalyze,
}: ConfigPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-border bg-secondary/30 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Configuration
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          <div className="space-y-2">
            <Label className="text-foreground text-sm">
              Problem Details (Optional)
            </Label>
            <Textarea
              placeholder={`Paste any additional context here:\n\n• Problem constraints (e.g., 1 ≤ N ≤ 10^5)\n• Problem statement or description\n• Input/output format\n• Edge cases to consider`}
              className="min-h-[180px] font-mono text-xs text-foreground"
              value={additionalInfo}
              onChange={(e) => onAdditionalInfoChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              AI will auto-detect the language and input format from your code
            </p>
          </div>

          {/* Branch 1: Analyze Problem */}
          <div className="space-y-3 pt-2">
            <Button
              className="w-full gap-2"
              variant="secondary"
              onClick={onAnalyze}
              disabled={analyzing}
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {analyzing ? "Analyzing Problem..." : "🧠 Analyze Problem (Branch 1)"}
            </Button>

            {analysisError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{analysisError}</p>
              </div>
            )}

            {analysisResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-medium text-foreground">
                    Analysis Complete — {analysisResult.problem_meta
                      ? (analysisResult.problem_meta as Record<string, string>).name
                      : "Problem Schema"}
                  </span>
                </div>
                <div className="rounded-md border border-border bg-secondary/30 p-3 max-h-[300px] overflow-auto">
                  <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap break-words">
                    {JSON.stringify(analysisResult, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Phase 3 Buttons */}
          <div className="space-y-3 border-t border-border pt-4">
            <Button
              className="w-full gap-2"
              onClick={onFindFailing}
              disabled={loading || !analysisResult}
            >
              <Play className="h-4 w-4" />
              {loading ? "Searching..." : "🔍 Find Failing Test Case"}
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={onRunSingle}
              disabled={loading}
            >
              <Play className="h-4 w-4" />
              Run Single Test
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
