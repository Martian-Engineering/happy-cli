import { describe, expect, it } from 'vitest';

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';

import { listCodexResumeSessions } from '../utils/rolloutScanner';

describe('rolloutScanner preview sanitization', () => {
    it('strips ANSI escape codes and control characters from resume previews', async () => {
        const originalCodexHome = process.env.CODEX_HOME;

        const tmpRoot = await mkdtemp(join(os.tmpdir(), 'happy-cli-codex-preview-'));
        try {
            const projectDir = join(tmpRoot, 'project');
            const sessionsDir = join(tmpRoot, 'sessions');
            await mkdir(projectDir, { recursive: true });
            await mkdir(sessionsDir, { recursive: true });

            process.env.CODEX_HOME = tmpRoot;

            const sessionId = '019bbb78-fd0a-7be1-b731-684e43c306cf';
            const rawMessage = [
                'Hello',
                '\u001b[31mRED\u001b[0m',
                '\u001b]0;title\u0007',
                '\u0000null',
                'world',
            ].join(' ');

            const rolloutFile = join(
                sessionsDir,
                'rollout-2026-01-15T00-00-00-00000000-0000-0000-0000-000000000000.jsonl'
            );

            await writeFile(
                rolloutFile,
                [
                    JSON.stringify({
                        type: 'session_meta',
                        payload: {
                            meta: {
                                id: sessionId,
                                cwd: projectDir,
                                git: { branch: 'master' },
                            },
                        },
                    }),
                    JSON.stringify({
                        type: 'response_item',
                        payload: {
                            type: 'message',
                            role: 'user',
                            content: [{ type: 'input_text', text: rawMessage }],
                        },
                    }),
                ].join('\n') + '\n'
            );

            const entries = await listCodexResumeSessions({ workingDirectory: projectDir });
            expect(entries).toHaveLength(1);

            const preview = entries[0]?.preview ?? '';
            expect(preview).toContain('Hello RED');
            expect(preview).toContain('world');
            expect(preview).not.toMatch(/[\u001B\u009B]/);
            expect(preview).not.toMatch(/[\u0000-\u001F\u007F-\u009F]/);
        } finally {
            process.env.CODEX_HOME = originalCodexHome;
            await rm(tmpRoot, { recursive: true, force: true });
        }
    });
});
