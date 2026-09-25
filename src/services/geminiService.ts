const Type = {
  OBJECT: 'OBJECT',
  ARRAY: 'ARRAY',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN'
};

export interface AtsEvaluation {
  score: number;
  passed: boolean;
  summary: string;
  breakdown: {
    keywordMatch: number;
    skillsAlignment: number;
    experienceRelevance: number;
    formattingReadability: number;
  };
  matchedKeywords: string[];
  missingKeywords: string[];
  actionableRecommendations: string[];
}

export interface GapAnalysis {
  hardGaps: string[];
  contextGaps: string[];
}

export interface ClarifyingQuestion {
  question: string;
}

export interface RevampedContent {
  professionalSummary: string;
  bulletPoints: {
    original: string;
    revamped: string;
    starMethod: {
      situation?: string;
      task?: string;
      action?: string;
      result?: string;
    };
  }[];
}

async function callAiApi(action: string, prompt: string, config?: any) {
  const response = await fetch(`/api/ai/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, config })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `AI request failed: ${action}`);
  }
  
  const data = await response.json();
  return data.text;
}

function parseAiJson<T>(raw: string): T {
  let cleaned = (raw || '').trim();
  // Strip markdown code fences if model enclosed JSON in ```json ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }
  
  // Find outermost JSON object or array
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  return JSON.parse(cleaned) as T;
}

export const geminiService = {
  async extractJdFromHtml(html: string): Promise<string> {
    const prompt = `Extract the Job Description text from the following HTML content of a job post. 
        Focus on: Job Title, Company, Responsibilities, Requirements, and Skills.
        Return ONLY the clean text content of the job description. Do not include HTML tags or metadata.
        
        HTML:
        ${html.substring(0, 40000)}`;

    return await callAiApi('extract', prompt);
  },

  async calculateAtsScore(cv: string, jd: string): Promise<AtsEvaluation> {
    const prompt = `
        You are an enterprise Applicant Tracking System (ATS) screening engine and executive talent assessor.
        Analyze the Candidate Resume (CV) against the target Job Description (JD).
        Calculate an objective ATS compatibility match score from 0 to 100 based on:
        1. Exact and semantic keyword match (40%)
        2. Required technical and leadership skills alignment (30%)
        3. Experience depth, seniority level, and industry relevance (20%)
        4. Measurable outcomes, action-verbs, and ATS parseability (10%)

        Scoring Rules:
        - Provide an integer score between 0 and 100.
        - Set passed to true if and only if score > 70 (strictly above 70).
        - Identify 4-7 matched keywords/skills found in both.
        - Identify 4-6 critical missing keywords or certifications from the JD that are absent or underrepresented in the CV.
        - Write a concise 2-3 sentence executive assessment summary.
        - Provide 3 specific, actionable recommendations to improve the score.

        CV:
        ${cv.substring(0, 15000)}

        Job Description:
        ${jd.substring(0, 10000)}

        Return JSON matching this schema:
        {
          "score": number,
          "passed": boolean,
          "summary": string,
          "breakdown": {
            "keywordMatch": number,
            "skillsAlignment": number,
            "experienceRelevance": number,
            "formattingReadability": number
          },
          "matchedKeywords": string[],
          "missingKeywords": string[],
          "actionableRecommendations": string[]
        }
    `;

    const text = await callAiApi('calculateAts', prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          passed: { type: Type.BOOLEAN },
          summary: { type: Type.STRING },
          breakdown: {
            type: Type.OBJECT,
            properties: {
              keywordMatch: { type: Type.NUMBER },
              skillsAlignment: { type: Type.NUMBER },
              experienceRelevance: { type: Type.NUMBER },
              formattingReadability: { type: Type.NUMBER },
            },
            required: ["keywordMatch", "skillsAlignment", "experienceRelevance", "formattingReadability"]
          },
          matchedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          actionableRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["score", "passed", "summary", "breakdown", "matchedKeywords", "missingKeywords", "actionableRecommendations"],
      },
    });

    const parsed = parseAiJson<AtsEvaluation>(text);
    const roundedScore = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    return {
      ...parsed,
      score: roundedScore,
      passed: roundedScore > 70,
      breakdown: {
        keywordMatch: Math.max(0, Math.min(100, Math.round(Number(parsed.breakdown?.keywordMatch) || 0))),
        skillsAlignment: Math.max(0, Math.min(100, Math.round(Number(parsed.breakdown?.skillsAlignment) || 0))),
        experienceRelevance: Math.max(0, Math.min(100, Math.round(Number(parsed.breakdown?.experienceRelevance) || 0))),
        formattingReadability: Math.max(0, Math.min(100, Math.round(Number(parsed.breakdown?.formattingReadability) || 0))),
      },
      matchedKeywords: Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : [],
      missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
      actionableRecommendations: Array.isArray(parsed.actionableRecommendations) ? parsed.actionableRecommendations : [],
    };
  },

  async analyzeGap(cv: string, jd: string): Promise<GapAnalysis> {
    const prompt = `
        Analyze the following CV and Job Description (JD) to identify gaps.
        Hard Gaps: Specific skills, certifications, or tools mentioned in the JD that are missing from the CV.
        Context Gaps: Experiences in the CV that are relevant but need more detail to align with the JD's seniority or industry focus.

        CV:
        ${cv.substring(0, 15000)}

        JD:
        ${jd.substring(0, 10000)}
        
        Return JSON matching this schema:
        { "hardGaps": string[], "contextGaps": string[] }
    `;

    const text = await callAiApi('analyzeGap', prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hardGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
          contextGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["hardGaps", "contextGaps"],
      },
    });
    
    return parseAiJson<GapAnalysis>(text);
  },

  async generateQuestions(cv: string, jd: string, gaps: GapAnalysis): Promise<ClarifyingQuestion[]> {
    const prompt = `
        Based on the CV, JD, and identified gaps, ask 3 targeted clarifying questions to help fill those gaps.
        Focus on extracting specific metrics, KPIs, tools, or methodologies that might be missing or understated.

        CV:
        ${cv.substring(0, 10000)}

        JD:
        ${jd.substring(0, 8000)}

        Gaps:
        ${JSON.stringify(gaps)}

        Return JSON matching this schema:
        [ { "question": string } ]
    `;

    const text = await callAiApi('generateQuestions', prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
          },
          required: ["question"],
        },
      },
    });

    return parseAiJson<ClarifyingQuestion[]>(text);
  },

  async revampContent(cv: string, jd: string, clarifications: string): Promise<RevampedContent> {
    const prompt = `
        Using the CV, JD, and the user's clarifications, rewrite the professional summary and select 3 to 4 key bullet points to overhaul.
        Rules:
        1. Professional summary must mirror the JD's requirements and target seniority.
        2. Select 3 to 4 key bullet points from the CV and rewrite them into high-impact executive statements using the STAR method (Situation, Task, Action, Result).
        3. Prioritize keywords and competencies from the JD for ATS compatibility.
        4. Focus on quantifiable achievements and metrics provided in the clarifications.

        CV:
        ${cv.substring(0, 15000)}

        Job Description:
        ${jd.substring(0, 10000)}

        Clarifications:
        ${clarifications.substring(0, 5000)}

        Return JSON matching this schema:
        { 
          "professionalSummary": string, 
          "bulletPoints": [
            { 
              "original": string, 
              "revamped": string, 
              "starMethod": { "situation": string, "task": string, "action": string, "result": string }
            }
          ]
        }
    `;

    const text = await callAiApi('revampContent', prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          professionalSummary: { type: Type.STRING },
          bulletPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                revamped: { type: Type.STRING },
                starMethod: {
                  type: Type.OBJECT,
                  properties: {
                    situation: { type: Type.STRING },
                    task: { type: Type.STRING },
                    action: { type: Type.STRING },
                    result: { type: Type.STRING },
                  },
                },
              },
              required: ["original", "revamped"],
            },
          },
        },
        required: ["professionalSummary", "bulletPoints"],
      },
    });

    return parseAiJson<RevampedContent>(text);
  },

  async generateFinalDocument(content: RevampedContent, template = "Standard Executive Format"): Promise<string> {
    const prompt = `
        Generate the final CV in a clean, professional Markdown format using the provided revamped content.
        Follow the ${template} style.
        Ensure it is high-impact, easy to scan, and ATS-friendly.

        Content: ${JSON.stringify(content)}
    `;
    return await callAiApi('generateFinal', prompt);
  },
};
