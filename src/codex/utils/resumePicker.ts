import React from 'react';
import { render } from 'ink';

import { CodexResumeSelector } from '@/ui/ink/CodexResumeSelector';
import { listCodexResumeSessions, CodexResumeEntry } from './rolloutScanner';

function enterAltScreen(stdout: NodeJS.WriteStream): () => void {
    if (!stdout.isTTY) return () => undefined;

    // Use the terminal alternate screen buffer so the picker feels like a full-screen TUI
    // and we don't leave partially-rendered content in the scrollback.
    stdout.write('\u001b[?1049h\u001b[2J\u001b[H');

    const restore = () => {
        try {
            stdout.write('\u001b[?1049l\u001b[?25h');
        } catch {
            // ignore
        }
    };

    // Ensure we restore even if the process exits unexpectedly while the picker is up.
    process.once('exit', restore);

    return restore;
}

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
        const restoreScreen = enterAltScreen(process.stdout);

        const onSelect = (entry: CodexResumeEntry) => {
            if (hasResolved) return;
            hasResolved = true;
            app.unmount();
            restoreScreen();
            resolve(entry);
        };

        const onCancel = () => {
            if (hasResolved) return;
            hasResolved = true;
            app.unmount();
            restoreScreen();
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
