import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Bug, LogOut, History } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import CodeEditorPanel from "@/components/CodeEditorPanel";
import ConfigPanel from "@/components/ConfigPanel";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { user, signOut } = useAuth();
  const [buggyCode, setBuggyCode] = useState("");
  const [correctCode, setCorrectCode] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // Branch 1 state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!buggyCode.trim() && !correctCode.trim() && !additionalInfo.trim()) {
      toast.error("Please provide at least some code or problem info to analyze");
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-problem", {
        body: {
          buggyCode,
          correctCode,
          additionalInfo,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to analyze problem");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.schema) {
        setAnalysisResult(data.schema);
        toast.success("Problem analyzed successfully!");
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      setAnalysisError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFindFailing = () => {
    if (!analysisResult) {
      toast.error("Run Branch 1 analysis first");
      return;
    }
    toast.info("Branch 2 & 3 coming next!");
  };

  const handleRunSingle = () => {
    toast.info("Single test run coming in Phase 3!");
  };

  return (
    <div className="dark flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Bug className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-base font-bold text-foreground">Debug</span>
          <span className="ml-2 rounded bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground text-xs">
            <History className="h-3.5 w-3.5" />
            History
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={35} minSize={20}>
            <CodeEditorPanel
              label="Your Code (Buggy)"
              language="cpp"
              value={buggyCode}
              onChange={setBuggyCode}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={35} minSize={20}>
            <CodeEditorPanel
              label="Correct Code (Reference)"
              language="cpp"
              value={correctCode}
              onChange={setCorrectCode}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={30} minSize={20}>
            <ConfigPanel
              additionalInfo={additionalInfo}
              onAdditionalInfoChange={setAdditionalInfo}
              onFindFailing={handleFindFailing}
              onRunSingle={handleRunSingle}
              loading={loading}
              analysisResult={analysisResult}
              analysisError={analysisError}
              analyzing={analyzing}
              onAnalyze={handleAnalyze}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default Index;
