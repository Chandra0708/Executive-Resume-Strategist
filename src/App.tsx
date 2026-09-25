import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Target, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  HelpCircle, 
  ChevronRight, 
  Download, 
  RefreshCw,
  Award,
  CircleDot,
  Upload,
  Link as LinkIcon,
  Lock,
  Unlock,
  AlertTriangle,
  BarChart3,
  Check,
  Plus,
  Edit3,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import { geminiService, GapAnalysis, ClarifyingQuestion, RevampedContent, AtsEvaluation } from './services/geminiService';
import { extractTextFromPdf } from './lib/pdfUtils';

/**
 * Utility for tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Stage = 'idle' | 'intake' | 'ats' | 'analysis' | 'interview' | 'approval' | 'final';

export default function App() {
  const [stage, setStage] = useState<Stage>('idle');
  const [cv, setCv] = useState('');
  const [jd, setJd] = useState('');
  const [jdUrl, setJdUrl] = useState('');
  const [isJdUrlInputOpen, setIsJdUrlInputOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Data from AI
  const [atsEvaluation, setAtsEvaluation] = useState<AtsEvaluation | null>(null);
  const [isEditingCvInAts, setIsEditingCvInAts] = useState(false);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revampedData, setRevampedData] = useState<RevampedContent | null>(null);
  const [finalCv, setFinalCv] = useState('');

  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [jdFileName, setJdFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExtractJdFromUrl = async () => {
    if (!jdUrl) return;
    setIsLoading(true);
    try {
      // Step 1: Fetch HTML from our proxy
      const fetchResponse = await fetch('/api/fetch-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jdUrl })
      });
      const fetchData = await fetchResponse.json();
      
      if (!fetchData.html) {
        throw new Error(fetchData.error || 'Failed to fetch page content');
      }

      // Step 2: Use Gemini on the frontend to extract JD from HTML
      const extractedText = await geminiService.extractJdFromHtml(fetchData.html);
      
      if (extractedText) {
        setJd(extractedText);
        setJdFileName('Extracted from: ' + new URL(jdUrl).hostname);
        setIsJdUrlInputOpen(false);
      } else {
        throw new Error('Failed to extract meaningful content');
      }
    } catch (error: any) {
      console.error(error);
      alert('Could not extract job description from this link automatically. Please copy and paste the job description text manually.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'cv' | 'jd') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const text = await extractTextFromPdf(file);
        if (target === 'cv') {
          setCv(text);
          setCvFileName(file.name);
        } else {
          setJd(text);
          setJdFileName(file.name);
        }
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === 'string') {
              resolve(content);
            } else {
              reject(new Error('Failed to read text file'));
            }
          };
          reader.onerror = () => reject(new Error('File reader error'));
          reader.readAsText(file);
        });

        if (target === 'cv') {
          setCv(text);
          setCvFileName(file.name);
        } else {
          setJd(text);
          setJdFileName(file.name);
        }
      } else {
        alert('Please upload a .pdf, .txt, or .md file.');
      }
    } catch (error) {
      console.error('File processing error:', error);
      alert('Failed to process the file. Please try copy-pasting.');
    } finally {
      setIsLoading(false);
      // Reset input so the same file can be uploaded again if needed
      e.target.value = '';
    }
  };

  const handleStartIntake = () => {
    setError(null);
    setStage('intake');
  };

  const handleCalculateAts = async () => {
    if (!cv.trim() || !jd.trim()) {
      alert("Please provide both your CV and the Job Description.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const evaluation = await geminiService.calculateAtsScore(cv, jd);
      setAtsEvaluation(evaluation);
      setStage('ats');
      if (evaluation.score <= 70) {
        setIsEditingCvInAts(true);
      } else {
        setIsEditingCvInAts(false);
      }
    } catch (err: any) {
      console.error('ATS Calculation error:', err);
      setError(err.message || 'Failed to calculate ATS score. Please check your inputs and try again.');
      alert(err.message || 'Failed to calculate ATS score. Please check your inputs and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!cv || !jd) return;
    if (!atsEvaluation || atsEvaluation.score <= 70) {
      setError("An ATS score strictly above 70 is required before analyzing strategy gaps.");
      alert("An ATS score strictly above 70 is required before analyzing strategy gaps.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await geminiService.analyzeGap(cv, jd);
      setGapAnalysis(result);
      setStage('analysis');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Analysis failed. Please check your inputs and try again.');
      alert(err.message || 'Analysis failed. Please check your inputs and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToInterview = async () => {
    if (!gapAnalysis) return;
    setIsLoading(true);
    setError(null);
    try {
      const q = await geminiService.generateQuestions(cv, jd, gapAnalysis);
      setQuestions(q);
      setStage('interview');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate interview questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitInterview = async () => {
    let clarificationString = Object.entries(answers)
      .filter(([_, text]) => text && text.trim().length > 0)
      .map(([index, text]) => `Question: ${questions[Number(index)]?.question || 'Question'}\nAnswer: ${text}`)
      .join('\n\n');

    if (!clarificationString.trim()) {
      clarificationString = 'No additional interview answers provided. Please re-engineer executive summary and achievements based on CV metrics and JD requirements.';
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await geminiService.revampContent(cv, jd, clarificationString);
      setRevampedData(result);
      setStage('approval');
    } catch (err: any) {
      console.error('Optimization plan error:', err);
      setError(err.message || 'Failed to generate optimization plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!revampedData) return;
    setIsLoading(true);
    setError(null);
    try {
      const final = await geminiService.generateFinalDocument(revampedData);
      setFinalCv(final);
      setStage('final');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate final document. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans selection:bg-[#EAE1D1]">
      <header className="fixed top-0 left-0 right-0 h-16 border-b border-[#E5E5E5] bg-white/80 backdrop-blur-md z-50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-6 h-6 text-[#8B7355]" />
          <span className="font-serif italic font-medium text-xl tracking-tight text-[#2D2D2D]">Executive Strategist</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-[#8B7355] overflow-x-auto py-1">
          <span className={cn(stage !== 'idle' && stage !== 'intake' && 'opacity-30')}>01 Intake</span>
          <ChevronRight className="w-3 h-3 opacity-20 flex-shrink-0" />
          <span className={cn(stage !== 'ats' && 'opacity-30')}>02 ATS</span>
          <ChevronRight className="w-3 h-3 opacity-20 flex-shrink-0" />
          <span className={cn(stage !== 'analysis' && 'opacity-30')}>03 Gaps</span>
          <ChevronRight className="w-3 h-3 opacity-20 flex-shrink-0" />
          <span className={cn(stage !== 'interview' && 'opacity-30')}>04 Strategy</span>
          <ChevronRight className="w-3 h-3 opacity-20 flex-shrink-0" />
          <span className={cn(stage !== 'approval' && stage !== 'final' && 'opacity-30')}>05 Finish</span>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {stage === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
              id="landing-page"
            >
              <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E5E5E5] bg-white text-xs font-bold uppercase tracking-widest text-[#8B7355]">
                <Sparkles className="w-3 h-3" />
                Precision Career Engineering
              </div>
              <h1 className="text-6xl md:text-8xl font-serif font-light leading-[0.9] tracking-tighter text-[#1A1A1A] mb-8">
                Transform your career <br />
                <span className="italic">at the executive level.</span>
              </h1>
              <p className="text-xl text-[#666] max-w-2xl mx-auto mb-12 leading-relaxed">
                An expert strategist to overhaul your CV, identify strategic gaps, and extract high-impact achievements using the STAR method.
              </p>
              <button
                onClick={handleStartIntake}
                id="start-button"
                className="group relative inline-flex items-center justify-center gap-3 bg-[#1A1A1A] text-white px-10 py-5 rounded-full text-lg font-medium transition-all hover:pr-12 hover:bg-[#2D2D2D]"
              >
                Start Strategy Session
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-2" />
              </button>
            </motion.div>
          )}

          {stage === 'intake' && (
            <motion.div
              key="intake"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid gap-12"
            >
              <div className="flex flex-col gap-2 border-l-2 border-[#1A1A1A] pl-6 py-2">
                <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#8B7355]">Stage 01</span>
                <h2 className="text-4xl font-serif italic text-[#1A1A1A]">Data Intake</h2>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between min-h-[32px] mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-[#8B7355]" />
                      <label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                        CV Content
                        {cvFileName && <span className="text-[10px] lowercase font-medium opacity-50 italic">(Optional)</span>}
                      </label>
                    </div>
                    {!cvFileName ? (
                      <label className="cursor-pointer group flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E5E5E5] hover:bg-[#FDFCFB] hover:border-[#8B7355] transition-all">
                        <Upload className="w-3.5 h-3.5 text-[#8B7355]" />
                        <span className="text-[10px] font-bold uppercase tracking-tight text-[#666] group-hover:text-[#1A1A1A]">Upload CV</span>
                        <input type="file" className="hidden" accept=".pdf,.txt,.md" onChange={(e) => handleFileUpload(e, 'cv')} />
                      </label>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FDFCFB] border border-[#8B7355]/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#8B7355]" />
                        <span className="text-[10px] font-bold truncate max-w-[100px]">{cvFileName}</span>
                        <button 
                          onClick={() => { setCv(''); setCvFileName(null); }}
                          className="text-[10px] text-red-500 hover:underline font-bold uppercase ml-1"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                  <textarea
                    className="w-full h-[400px] p-6 bg-white border border-[#E5E5E5] rounded-3xl resize-none focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 focus:border-[#8B7355] transition-all"
                    placeholder={cvFileName ? "Review or edit extracted text..." : "Paste your CV text here, or use the upload option above..."}
                    value={cv}
                    onChange={(e) => {
                      setCv(e.target.value);
                      if (cvFileName) setCvFileName(null);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between min-h-[32px] mb-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-[#8B7355]" />
                      <label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                        Job Description
                        {jdFileName && <span className="text-[10px] lowercase font-medium opacity-50 italic">(Optional)</span>}
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      {!jdFileName ? (
                        <>
                          <button 
                            onClick={() => setIsJdUrlInputOpen(!isJdUrlInputOpen)}
                            className={cn(
                              "group flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all",
                              isJdUrlInputOpen ? "bg-[#1A1A1A] text-white border-[#1A1A1A]" : "border-[#E5E5E5] hover:bg-[#FDFCFB] hover:border-[#8B7355]"
                            )}
                          >
                            <LinkIcon className={cn("w-3.5 h-3.5", isJdUrlInputOpen ? "text-white" : "text-[#8B7355]")} />
                            <span className={cn("text-[10px] font-bold uppercase tracking-tight", isJdUrlInputOpen ? "text-white" : "text-[#666] group-hover:text-[#1A1A1A]")}>Link</span>
                          </button>
                          <label className="cursor-pointer group flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E5E5E5] hover:bg-[#FDFCFB] hover:border-[#8B7355] transition-all">
                            <Upload className="w-3.5 h-3.5 text-[#8B7355]" />
                            <span className="text-[10px] font-bold uppercase tracking-tight text-[#666] group-hover:text-[#1A1A1A]">Upload JD</span>
                            <input type="file" className="hidden" accept=".pdf,.txt,.md" onChange={(e) => handleFileUpload(e, 'jd')} />
                          </label>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FDFCFB] border border-[#8B7355]/30">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#8B7355]" />
                          <span className="text-[10px] font-bold truncate max-w-[100px]">{jdFileName}</span>
                          <button 
                            onClick={() => { setJd(''); setJdFileName(null); setJdUrl(''); }}
                            className="text-[10px] text-red-500 hover:underline font-bold uppercase ml-1"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isJdUrlInputOpen && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mb-2"
                      >
                        <div className="flex gap-2 p-1 bg-white border border-[#E5E5E5] rounded-2xl">
                          <input 
                            type="url" 
                            className="flex-grow px-4 py-2 text-sm focus:outline-none"
                            placeholder="Paste LinkedIn or Job Portal URL..."
                            value={jdUrl}
                            onChange={(e) => setJdUrl(e.target.value)}
                          />
                          <button 
                            onClick={handleExtractJdFromUrl}
                            disabled={!jdUrl || isLoading}
                            className="bg-[#1A1A1A] text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all disabled:opacity-50"
                          >
                            {isLoading ? '...' : 'Extract'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <textarea
                    className="w-full h-[400px] p-6 bg-white border border-[#E5E5E5] rounded-3xl resize-none focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 focus:border-[#8B7355] transition-all"
                    placeholder={jdFileName ? "Review or edit job description requirements..." : "Paste the job description here, or use the link/upload options above..."}
                    value={jd}
                    onChange={(e) => {
                      setJd(e.target.value);
                      if (jdFileName) setJdFileName(null);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#E5E5E5]/70">
                <div className="flex items-center gap-2.5 text-xs text-[#666]">
                  <ShieldCheck className="w-4 h-4 text-[#8B7355] flex-shrink-0" />
                  <span>
                    ATS screening evaluates resume match first. An ATS score <strong>above 70</strong> is required before analyzing strategy gaps.
                  </span>
                </div>
                <button
                  onClick={handleCalculateAts}
                  disabled={isLoading || !cv.trim() || !jd.trim()}
                  className="inline-flex items-center gap-3 bg-[#1A1A1A] text-white px-8 py-4 rounded-full font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2D2D2D] transition-all min-w-[240px] justify-center shadow-lg active:scale-[0.99] flex-shrink-0"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-[#EAE1D1]" />
                      <span>Evaluating ATS Score...</span>
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-5 h-5 text-[#EAE1D1]" />
                      <span>Calculate ATS Score</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {stage === 'ats' && atsEvaluation && (
            <motion.div
              key="ats"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              className="space-y-10"
            >
              {/* Stage header */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2 border-l-2 border-[#1A1A1A] pl-6 py-2">
                  <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#8B7355]">Stage 02</span>
                  <h2 className="text-4xl font-serif italic text-[#1A1A1A]">ATS Compatibility Screening</h2>
                </div>
                <button
                  onClick={() => setStage('intake')}
                  className="text-xs font-bold uppercase tracking-widest text-[#8B7355] hover:text-[#1A1A1A] transition-colors flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#E5E5E5] hover:bg-white"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Inputs
                </button>
              </div>

              {/* Hero Score Banner */}
              <div className={cn(
                "rounded-[36px] p-8 md:p-10 border transition-all relative overflow-hidden",
                atsEvaluation.score > 70 
                  ? "bg-gradient-to-br from-white via-[#F4F9F5] to-[#EAF5EC] border-emerald-200 shadow-sm"
                  : "bg-gradient-to-br from-white via-[#FFF8F6] to-[#FFF0EC] border-amber-200 shadow-sm"
              )}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                    {/* Circular score display */}
                    <div className="relative flex-shrink-0">
                      <div className={cn(
                        "w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center bg-white shadow-md",
                        atsEvaluation.score > 70 ? "border-emerald-500 text-emerald-700" : "border-amber-500 text-amber-700"
                      )}>
                        <span className="text-4xl font-bold font-serif tracking-tight leading-none">
                          {atsEvaluation.score}
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#888] mt-0.5">
                          / 100
                        </span>
                      </div>
                      {atsEvaluation.score > 70 ? (
                        <div className="absolute -top-1 -right-1 bg-emerald-600 text-white rounded-full p-1.5 shadow">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="absolute -top-1 -right-1 bg-amber-600 text-white rounded-full p-1.5 shadow">
                          <Lock className="w-4 h-4 stroke-[2.5]" />
                        </div>
                      )}
                    </div>

                    {/* Status & Summary */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                          atsEvaluation.score > 70 
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        )}>
                          {atsEvaluation.score > 70 ? "✓ Passed ATS Screening (>70)" : "⚠️ Below ATS Hurdle (Score ≤ 70)"}
                        </span>
                        <span className="text-xs text-[#666] font-medium">
                          Benchmark: &gt; 70 Required
                        </span>
                      </div>
                      
                      <h3 className="text-2xl font-serif font-medium text-[#1A1A1A]">
                        {atsEvaluation.score > 70 
                          ? "Eligible for Deep Strategy Gap Analysis" 
                          : "ATS Score Below 70 Threshold"}
                      </h3>

                      <p className="text-sm text-[#555] max-w-xl leading-relaxed">
                        {atsEvaluation.summary}
                      </p>
                    </div>
                  </div>

                  {/* Gatekeeper Action Status Badge */}
                  <div className="flex flex-col items-center md:items-end gap-2 text-right">
                    {atsEvaluation.score > 70 ? (
                      <div className="bg-emerald-600/10 text-emerald-800 text-xs px-4 py-2 rounded-2xl border border-emerald-300/60 font-semibold flex items-center gap-2">
                        <Unlock className="w-4 h-4 text-emerald-600" />
                        <span>Strategy Gap Analysis Unlocked</span>
                      </div>
                    ) : (
                      <div className="bg-amber-600/10 text-amber-900 text-xs px-4 py-2 rounded-2xl border border-amber-300/60 font-semibold flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-700" />
                        <span>Strategy Gap Analysis Locked</span>
                      </div>
                    )}
                    <span className="text-[11px] text-[#777] italic">
                      {atsEvaluation.score > 70 
                        ? "Score qualifies for gap analysis" 
                        : "Score must exceed 70 to unlock gap analysis"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Metrics Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Keyword Match", val: atsEvaluation.breakdown.keywordMatch, desc: "Exact & semantic terminology" },
                  { label: "Skills Alignment", val: atsEvaluation.breakdown.skillsAlignment, desc: "Technical & leadership skills" },
                  { label: "Experience Relevance", val: atsEvaluation.breakdown.experienceRelevance, desc: "Seniority & industry depth" },
                  { label: "ATS Formatting", val: atsEvaluation.breakdown.formattingReadability, desc: "Parsability & metric density" },
                ].map((metric, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl border border-[#E5E5E5] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-[#666]">{metric.label}</span>
                      <span className="font-bold text-[#1A1A1A]">{metric.val}%</span>
                    </div>
                    <div className="w-full bg-[#F0EFEB] rounded-full h-2 overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          metric.val >= 70 ? "bg-emerald-600" : metric.val >= 50 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${metric.val}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[#888] leading-tight pt-1">{metric.desc}</p>
                  </div>
                ))}
              </div>

              {/* Keywords analysis: Matched vs Missing */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                      Matched Keywords ({atsEvaluation.matchedKeywords.length})
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {atsEvaluation.matchedKeywords.length > 0 ? (
                      atsEvaluation.matchedKeywords.map((kw, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          {kw}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[#888] italic">No high-confidence keyword matches detected.</span>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                      Missing Critical Keywords ({atsEvaluation.missingKeywords.length})
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {atsEvaluation.missingKeywords.length > 0 ? (
                      atsEvaluation.missingKeywords.map((kw, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200">
                          <Plus className="w-3 h-3 text-amber-600" />
                          {kw}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[#888] italic">All core JD keywords present in CV.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actionable Recommendations */}
              {atsEvaluation.actionableRecommendations?.length > 0 && (
                <div className="bg-[#FAF9F6] border border-[#E8E6DF] rounded-3xl p-6 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B7355] flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    Actionable ATS Recommendations
                  </h4>
                  <ul className="space-y-2 text-sm text-[#444]">
                    {atsEvaluation.actionableRecommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="font-serif text-[#8B7355] font-bold">0{i+1}.</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick Resume Editor when below 70 or when user wants to tweak */}
              <div className="border border-[#E5E5E5] rounded-3xl bg-white overflow-hidden shadow-sm">
                <div 
                  onClick={() => setIsEditingCvInAts(!isEditingCvInAts)}
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-[#FDFCFB] transition-colors border-b border-[#F0F0F0]"
                >
                  <div className="flex items-center gap-3">
                    <Edit3 className="w-4 h-4 text-[#8B7355]" />
                    <div>
                      <span className="text-sm font-bold text-[#1A1A1A]">
                        {isEditingCvInAts ? "Hide Resume Quick Editor" : "Quick Edit Resume to Improve ATS Score"}
                      </span>
                      <p className="text-xs text-[#666]">
                        {atsEvaluation.score <= 70 
                          ? "Add missing keywords and quantifiable metrics here to push your score above 70." 
                          : "Fine-tune your resume content before proceeding to gap analysis."}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8B7355]">
                    {isEditingCvInAts ? "Collapse" : "Expand"}
                  </span>
                </div>

                {isEditingCvInAts && (
                  <div className="p-6 space-y-4 bg-[#FAF9F6]">
                    <textarea
                      className="w-full h-64 p-4 bg-white border border-[#E5E5E5] rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 focus:border-[#8B7355] text-sm font-mono text-[#333]"
                      value={cv}
                      onChange={(e) => setCv(e.target.value)}
                      placeholder="Edit your CV text..."
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleCalculateAts}
                        disabled={isLoading || !cv.trim()}
                        className="inline-flex items-center gap-2 bg-[#1A1A1A] text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#2D2D2D] transition-all disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-[#EAE1D1]" />
                            <span>Re-scoring ATS...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            <span>Re-calculate ATS Score</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Stage 02 Action Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#E5E5E5]">
                <button
                  onClick={() => setStage('intake')}
                  className="text-xs font-bold uppercase tracking-widest text-[#666] hover:text-[#1A1A1A] transition-colors"
                >
                  ← Back to Data Intake
                </button>

                <div className="flex items-center gap-4">
                  {atsEvaluation.score <= 70 ? (
                    <div className="flex flex-col items-center sm:items-end gap-1.5">
                      <button
                        disabled={true}
                        className="inline-flex items-center gap-2 bg-[#E5E5E5] text-[#888] px-8 py-4 rounded-full font-medium cursor-not-allowed border border-[#D5D5D5]"
                        title="ATS Score must be strictly above 70 to allow strategy gap analysis."
                      >
                        <Lock className="w-4 h-4 text-[#888]" />
                        <span>Analyze Strategy Gaps (Locked: Requires &gt; 70)</span>
                      </button>
                      <span className="text-[11px] text-amber-700 font-medium">
                        Current score is {atsEvaluation.score}/100. Reach above 70 to unlock gap analysis.
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={handleRunAnalysis}
                      disabled={isLoading}
                      className="inline-flex items-center gap-3 bg-[#1A1A1A] text-white px-9 py-4 rounded-full font-medium hover:bg-[#2D2D2D] transition-all shadow-lg active:scale-[0.99]"
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin text-[#EAE1D1]" />
                          <span>Running Gap Analysis...</span>
                        </>
                      ) : (
                        <>
                          <span>Analyze Strategy Gaps</span>
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {stage === 'analysis' && gapAnalysis && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-12"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-2 border-l-2 border-[#1A1A1A] pl-6 py-2">
                  <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#8B7355]">Stage 03</span>
                  <h2 className="text-4xl font-serif italic text-[#1A1A1A]">Gap Analysis & Benchmarking</h2>
                </div>
                {atsEvaluation && (
                  <button
                    onClick={() => setStage('ats')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold uppercase tracking-wider hover:bg-emerald-100 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ATS Benchmark: {atsEvaluation.score}/100 (Passed)</span>
                  </button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-[#1A1A1A] text-white rounded-[40px] p-10 overflow-hidden relative">
                  <CircleDot className="absolute -top-10 -right-10 w-40 h-40 opacity-5 text-white" />
                  <h3 className="text-2xl font-serif italic mb-6 flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#EAE1D1]" />
                    Hard Gaps
                  </h3>
                  <p className="text-sm text-[#999] mb-8 font-medium px-4 border-l border-[#333]">Missing specific technical skills or credentials required for this seniority.</p>
                  <ul className="space-y-4">
                    {gapAnalysis.hardGaps.map((gap, i) => (
                      <motion.li 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="flex gap-3 text-lg leading-tight"
                      >
                        <span className="text-[#8B7355] font-serif">/</span>
                        {gap}
                      </motion.li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white border border-[#E5E5E5] rounded-[40px] p-10 relative overflow-hidden">
                  <Sparkles className="absolute -bottom-10 -right-10 w-40 h-40 opacity-5 text-[#8B7355]" />
                  <h3 className="text-2xl font-serif italic mb-6 flex items-center gap-3 text-[#1A1A1A]">
                    <Sparkles className="w-6 h-6 text-[#8B7355]" />
                    Context Gaps
                  </h3>
                  <p className="text-sm text-[#666] mb-8 font-medium px-4 border-l border-[#E5E5E5]">Experiences that are present but need strategic refocusing to hit executive benchmarks.</p>
                  <ul className="space-y-4">
                    {gapAnalysis.contextGaps.map((gap, i) => (
                      <motion.li 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="flex gap-3 text-lg leading-tight text-[#2D2D2D]"
                      >
                        <span className="text-[#8B7355] font-serif">/</span>
                        {gap}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-col items-center gap-6 py-12">
                <p className="text-[#666] italic text-center max-w-lg">Next, our coach will ask a few clarifying questions to extract the necessary metrics and context to bridge these gaps.</p>
                <button
                  onClick={handleGoToInterview}
                  className="bg-[#1A1A1A] text-white px-10 py-5 rounded-full font-semibold inline-flex items-center gap-3 hover:bg-[#2D2D2D] transition-all min-w-[280px] justify-center"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Preparing Interview...</span>
                    </>
                  ) : (
                    <>
                      <span>Begin Strategy Interview</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {stage === 'interview' && (
            <motion.div
              key="interview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex flex-col gap-2 border-l-2 border-[#1A1A1A] pl-6 py-2">
                <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#8B7355]">Stage 04</span>
                <h2 className="text-4xl font-serif italic text-[#1A1A1A]">Strategic Interview</h2>
              </div>

              <div className="space-y-12">
                {questions.map((q, i) => (
                  <div key={i} className="group flex flex-col gap-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full border border-[#E5E5E5] flex items-center justify-center text-xs font-bold text-[#8B7355]">
                        {i + 1}
                      </div>
                      <p className="text-2xl font-medium text-[#1A1A1A] leading-snug">
                        {q.question}
                      </p>
                    </div>
                    <div className="pl-12 relative">
                      <textarea
                        className={cn(
                          "w-full h-32 p-4 bg-transparent border-b border-[#E5E5E5] resize-none focus:outline-none focus:border-[#1A1A1A] transition-all placeholder:italic text-[#444]",
                          isLoading && "opacity-50 cursor-not-allowed"
                        )}
                        placeholder="Provide specific metrics, tools, or situational context..."
                        value={answers[i] || ''}
                        disabled={isLoading}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                      />
                      {isLoading && (
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                          <RefreshCw className="w-4 h-4 text-[#8B7355] animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-end gap-3 pt-12">
                <button
                  onClick={handleSubmitInterview}
                  disabled={isLoading}
                  className="group bg-[#1A1A1A] text-white px-10 py-5 rounded-full font-semibold disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#2D2D2D] transition-all min-w-[280px] justify-center shadow-lg active:scale-[0.99] flex items-center gap-3"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-[#EAE1D1]" />
                      <span>Generating Optimization Plan...</span>
                    </>
                  ) : (
                    <>
                      <span>Generate Optimization Plan</span>
                      <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
                {isLoading && (
                  <p className="text-xs text-[#8B7355] italic flex items-center gap-1.5 animate-pulse">
                    <Sparkles className="w-3.5 h-3.5" />
                    Synthesizing executive summary & STAR bullet points (~3-5s)...
                  </p>
                )}
                {error && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-2 flex items-center gap-3 mt-1">
                    <span>{error}</span>
                    <button 
                      onClick={() => handleSubmitInterview()} 
                      className="underline font-bold text-red-700 hover:text-red-900"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {stage === 'approval' && revampedData && (
            <motion.div
              key="approval"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              <div className="flex flex-col gap-2 border-l-2 border-[#1A1A1A] pl-6 py-2">
                <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#8B7355]">Stage 05</span>
                <h2 className="text-4xl font-serif italic text-[#1A1A1A]">Strategy & Revamp Review</h2>
              </div>

              <section className="bg-[#1A1A1A] text-white p-12 rounded-[40px] space-y-6">
                <h4 className="text-xs uppercase tracking-[0.3em] font-bold text-[#8B7355]">Executive Summary Re-Engineering</h4>
                <p className="text-2xl font-light leading-relaxed italic text-[#E5E5E5]">
                  {revampedData.professionalSummary}
                </p>
              </section>

              <section className="space-y-8">
                <h4 className="text-xs uppercase tracking-[0.3em] font-bold text-[#8B7355] border-b border-[#E5E5E5] pb-4">Revamped Bullet Points (STAR Method)</h4>
                <div className="grid gap-6">
                  {revampedData.bulletPoints.map((point, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-8 p-8 rounded-3xl border border-[#E5E5E5] bg-white group hover:bg-[#FDFCFB] transition-all">
                      <div className="md:col-span-2 space-y-2 opacity-50 transition-opacity group-hover:opacity-100">
                        <span className="text-[10px] uppercase font-black tracking-tighter text-[#666]">Legacy Achievement</span>
                        <p className="text-sm italic">{point.original}</p>
                      </div>
                      <div className="md:col-span-3 space-y-4">
                        <span className="text-[10px] uppercase font-black tracking-tighter text-[#1A1A1A] flex items-center gap-2">
                          <Sparkles className="w-3 h-3 text-[#8B7355]" />
                          Executive Revamp
                        </span>
                        <p className="text-lg font-medium text-[#1A1A1A] line-height-tight">{point.revamped}</p>
                        <div className="grid grid-cols-4 gap-2 pt-4 border-t border-[#F0F0F0]">
                          {['S', 'T', 'A', 'R'].map((letter, idx) => {
                            const labels = ['Situation', 'Task', 'Action', 'Result'];
                            return (
                              <div key={idx} className="flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-[#8B7355]">{letter}</span>
                                <span className="text-[10px] text-[#999] truncate">{labels[idx]}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex justify-center pt-8">
                <button
                  onClick={handleApprove}
                  className="bg-[#1A1A1A] text-white px-12 py-6 rounded-full font-bold text-lg inline-flex items-center gap-3 hover:scale-105 transition-all shadow-xl min-w-[320px] justify-center"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Formatting Final CV...</span>
                    </>
                  ) : (
                    <>
                      <span>Finalize & Format CV</span>
                      <ArrowRight className="w-6 h-6" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {stage === 'final' && (
            <motion.div
              key="final"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2 border-l-2 border-[#1A1A1A] pl-6 py-2">
                  <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#8B7355]">Success</span>
                  <h2 className="text-4xl font-serif italic text-[#1A1A1A]">Mission Accomplished</h2>
                </div>
                <button 
                  onClick={() => {
                    const blob = new Blob([finalCv], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'Executive_CV_Strategized.md';
                    a.click();
                  }}
                  className="p-4 rounded-full border border-[#E5E5E5] hover:bg-white hover:shadow-lg transition-all"
                  title="Download Markdown"
                >
                  <Download className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-white border border-[#E5E5E5] rounded-[40px] p-12 shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#8B7355] via-[#2D2D2D] to-[#8B7355] rounded-t-[40px]" />
                <div className="prose prose-stone max-w-none prose-headings:font-serif prose-headings:italic prose-h1:text-4xl text-[#333]">
                  <ReactMarkdown>{finalCv}</ReactMarkdown>
                </div>
              </div>

              <div className="flex justify-center flex-col items-center gap-6 py-12">
                <p className="text-[#666] font-medium">Ready to dominate your next interview.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs font-bold uppercase tracking-[0.3em] text-[#8B7355] cursor-pointer hover:text-[#1A1A1A] transition-colors"
                >
                  Start New Session
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Loading Overlay */}
      {isLoading && (stage === 'analysis' || stage === 'interview' || stage === 'approval' || stage === 'final') && (
        <div className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <RefreshCw className="w-12 h-12 text-[#1A1A1A] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Award className="w-4 h-4 text-[#8B7355]" />
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#8B7355]">Orchestrating Strategy...</p>
          </div>
        </div>
      )}
    </div>
  );
}
