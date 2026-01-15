import React from 'react';
import { render } from 'ink';

import { CodexResumeSelector } from '@/ui/ink/CodexResumeSelector';
import { listCodexResumeSessions, CodexResumeEntry } from './rolloutScanner';

export async function selectCodexResumeSession(opts: {
    workingDirectory: string;
    allowAll?: boolean;
    limit?: number;
}): Promise<CodexResumeEntry | null> {
    const entries = await listCodexResumeSessions({
        workingDirectory: opts.workingDirectory,
        allowAll: opts.allowAll,
        limit: opts.limit,
    });

    if (entries.length === 0) {
        console.log('No saved Codex sessions found for this directory.');
        return null;
    }

    return await new Promise((resolve) => {
        let hasResolved = false;

        const onSelect = (entry: CodexResumeEntry) => {
            if (hasResolved) return;
            hasResolved = true;
            app.unmount();
            resolve(entry);
        };

        const onCancel = () => {
            if (hasResolved) return;
            hasResolved = true;
            app.unmount();
            resolve(null);
        };

        const app = render(
            React.createElement(CodexResumeSelector, {
                entries,
                showAll: Boolean(opts.allowAll),
                onSelect,
                onCancel,
            }),
            { exitOnCtrlC: false, patchConsole: false }
        );
    });
}
