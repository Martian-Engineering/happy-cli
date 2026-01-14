import { spawn } from 'node:child_process';

import { ApiSessionClient } from '@/api/apiSession';
import { logger } from '@/ui/logger';
import { MessageQueue2 } from '@/utils/MessageQueue2';
import type { CodexMode } from './mode';
import { createCodexRolloutScanner, findLatestCodexRolloutForCwd, findSessionFileById } from './utils/rolloutScanner';
import { extractResumeSessionId } from './utils/resume';

export type CodexLocalReason = 'switch' | 'exit';

export interface CodexLocalResult {
    reason: CodexLocalReason;
    resumeFile?: string | null;
}

export interface CodexLocalOptions {
    session: ApiSessionClient;
    path: string;
    resumeArgs?: string[];
    resumeSessionId?: string;
    messageQueue: MessageQueue2<CodexMode>;
}

export async function codexLocalLauncher(opts: CodexLocalOptions): Promise<CodexLocalResult> {
    logger.debug('[codex-local] Starting local launcher');

    let lastRolloutFile: string | null = null;
    const resumeSessionId = opts.resumeSessionId ?? extractResumeSessionId(opts.resumeArgs);

    if (resumeSessionId) {
        lastRolloutFile = await findSessionFileById(resumeSessionId);
    }
    const scanner = await createCodexRolloutScanner({
        workingDirectory: opts.path,
        allowAll: opts.resumeArgs?.includes('--all') ?? false,
        resumeSessionId: resumeSessionId ?? undefined,
        onActiveSessionFile: (file) => {
            lastRolloutFile = file;
        },
        onCodexMessage: (message) => {
            opts.session.sendCodexMessage(message);
        },
    });

    let exitReason: CodexLocalReason | null = null;
    const processAbortController = new AbortController();
    let childExit: Promise<void> | null = null;

    async function abortProcess() {
        if (!processAbortController.signal.aborted) {
            processAbortController.abort();
        }
        if (childExit) {
            await childExit;
        }
    }

    async function doSwitch() {
        logger.debug('[codex-local] Switching to remote mode');
        if (!exitReason) {
            exitReason = 'switch';
        }
        await abortProcess();
    }

    async function doAbort() {
        logger.debug('[codex-local] Abort requested');
        if (!exitReason) {
            exitReason = 'switch';
        }
        opts.messageQueue.reset();
        await abortProcess();
    }

    // Switch to remote when messages arrive
    opts.messageQueue.setOnMessage(() => {
        void doSwitch();
    });

    // RPC handlers
    opts.session.rpcHandlerManager.registerHandler('abort', doAbort);
    opts.session.rpcHandlerManager.registerHandler('switch', doSwitch);

    // If messages already queued, switch immediately
    if (opts.messageQueue.size() > 0) {
        await scanner.cleanup();
        if (!lastRolloutFile) {
            lastRolloutFile = await findLatestCodexRolloutForCwd(opts.path, opts.resumeArgs?.includes('--all') ?? false);
        }
        opts.messageQueue.setOnMessage(null);
        opts.session.rpcHandlerManager.registerHandler('abort', async () => { });
        opts.session.rpcHandlerManager.registerHandler('switch', async () => { });
        return { reason: 'switch', resumeFile: lastRolloutFile };
    }

    try {
        let nextArgs = opts.resumeArgs;
        while (true) {
            if (exitReason) {
                if (!lastRolloutFile) {
                    lastRolloutFile = await findLatestCodexRolloutForCwd(opts.path, opts.resumeArgs?.includes('--all') ?? false);
                }
                return { reason: exitReason, resumeFile: lastRolloutFile };
            }

            const args = nextArgs ?? [];
            nextArgs = undefined;
            logger.debug('[codex-local] Spawning codex', args);

            childExit = new Promise<void>((resolve) => {
                const child = spawn('codex', args, {
                    stdio: 'inherit',
                    cwd: opts.path,
                    env: process.env,
                });

                const abortHandler = () => {
                    if (!child.killed) {
                        child.kill('SIGTERM');
                    }
                };

                processAbortController.signal.addEventListener('abort', abortHandler);

                child.on('exit', () => {
                    processAbortController.signal.removeEventListener('abort', abortHandler);
                    resolve();
                });
                child.on('error', () => {
                    processAbortController.signal.removeEventListener('abort', abortHandler);
                    resolve();
                });
            });
            await childExit;

            if (!exitReason) {
                exitReason = 'exit';
            }
        }
    } finally {
        childExit = null;
        opts.messageQueue.setOnMessage(null);
        opts.session.rpcHandlerManager.registerHandler('abort', async () => { });
        opts.session.rpcHandlerManager.registerHandler('switch', async () => { });
        await scanner.cleanup();
    }
    if (!lastRolloutFile) {
        lastRolloutFile = await findLatestCodexRolloutForCwd(opts.path, opts.resumeArgs?.includes('--all') ?? false);
    }
    return { reason: exitReason || 'exit', resumeFile: lastRolloutFile };
}
