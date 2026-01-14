export function extractResumeSessionId(resumeArgs?: string[]): string | null {
    if (!resumeArgs || resumeArgs.length === 0) return null;
    const resumeIndex = resumeArgs.indexOf('resume');
    if (resumeIndex === -1) return null;
    const candidate = resumeArgs[resumeIndex + 1];
    if (!candidate || candidate.startsWith('-')) return null;
    return candidate;
}
