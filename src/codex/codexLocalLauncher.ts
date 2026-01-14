import { spawn } from 'node:child_process';
import type { UUID } from 'node:crypto';

<<<<<<< HEAD
=======
import { ApiSessionClient } from '@/api/apiSession';
>>>>>>> d850441de3e60ac7547133f9e7ea5083865087ae
import { logger } from '@/ui/logger';
import { MessageQueue2 } from '@/utils/MessageQueue2';
import type { CodexMode } from './mode';
import { createCodexRolloutScanner, findLatestCodexRolloutForCwd, findSessionFileById } from './utils/rolloutScanner';
import { extractResumeSessionId } from './utils/resume';
import { ensureHappySessionTagForCodexSession } from './utils/codexSessionMap';
<<<<<<< HEAD
import type { SessionController } from './sessionController';
=======
>>>>>>> d850441de3e60ac7547133f9e7ea5083865087ae

export type CodexLocalReason = 'switch' | 'exit';

export interface CodexLocalResult {
    reason: CodexLocalReason;
    resumeFile?: string | null;
}

export interface CodexLocalOptions {
<<<<<<< HEAD
    sessionController: SessionController;
=======
    session: ApiSessionClient;
>>>>>>> d850441de3e60ac7547133f9e7ea5083865087ae
    path: string;
    resumeArgs?: string[];
    resumeSessionId?: string;
    sessionTag?: UUID;
    messageQueue: MessageQueue2<CodexMode>;
}

export async function codexLocalLauncher(opts: CodexLocalOptions): Promise<CodexLocalResult> {
    logger.debug('[codex-local] Starting local launcher');

<<<<<<< HEAD
    const { getSession, onSessionSwap } = opts.sessionController;
    let session = getSession();

=======
>>>>>>> d850441de3e60ac7547133f9e7ea5083865087ae
    let lastRolloutFile: string | null = null;
    const resumeSessionId = opts.resumeSessionId ?? extractResumeSessionId(opts.resumeArgs);

    if (resumeSessionId) {
        lastRolloutFile = await findSessionFileById(resumeSessionId);
    }
    const scanner = await createCodexRolloutScanner({
        workingDirectory: opts.path,
        allowAll: opts.resumeArgs?.includes('--all') ?? false,
        resumeSessionId: resumeSessionId ?? undefined,
        onActiveSessionFile: (file, sessionId) => {
            lastRolloutFile = file;
            if (sessionId && opts.sessionTag) {
                void ensureHappySessionTagForCodexSession(sessionId, opts.sessionTag).catch((error) => {
                    logger.debug('[codex-local] Failed to store session tag mapping', error);
                });
            }
        },
        onCodexMessage: (message) => {
<<<<<<< HEAD
            session.sendCodexMessage(message);
        },
    });

    const bindSession = (nextSession: typeof session) => {
        session = nextSession;
        session.rpcHandlerManager.registerHandler('abort', doAbort);
        session.rpcHandlerManager.registerHandler('switch', doSwitch);
    };

=======
            opts.session.sendCodexMessage(message);
        },
    });

>>>>>>> d850441de3e60ac7547133f9e7ea5083865087ae
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

<<<<<<< HEAD
    bindSession(session);
    const unsubscribe = onSessionSwap((nextSession) => {
        bindSession(nextSession);
    });

    // If messages already queued, switch immediately
        if (opts.messageQueue.size() > 0) {
            await scanner.cleanup();
            if (!lastRolloutFile) {
                lastRolloutFile = await findLatestCodexRolloutForCwd(opts.path, opts.resumeArgs?.includes('--all') ?? false);
            }
            opts.messageQueue.setOnMessage(null);
            session.rpcHandlerManager.registerHandler('abort', async () => { });
            session.rpcHandlerManager.registerHandler('switch', async () => { });
            return { reason: 'switch', resumeFile: lastRolloutFile };
        }
=======
    // RPC handlers
    opts.session.rpcHandlerManager.registerHandler('abort', doAbort);
    opts.session.rpcHandlerManager.registerHandler('switch', doSwitch);

    // If messages already queued, switch immediately
    if (opts.messageQueue.size() > 0) {
        await scanner.cleanup();
        if (!lastRolloutFile) {
            const shouldPreferMtime = opts.resumeArgs?.includes('resume') || opts.resumeArgs?.includes('--resume');
            lastRolloutFile = await findLatestCodexRolloutForCwd(
                opts.path,
                opts.resumeArgs?.includes('--all') ?? false,
                { preferMtime: shouldPreferMtime }
            );
        }
        opts.messageQueue.setOnMessage(null);
        opts.session.rpcHandlerManager.registerHandler('abort', async () => { });
        opts.session.rpcHandlerManager.registerHandler('switch', async () => { });
        return { reason: 'switch', resumeFile: lastRolloutFile };
    }
>>>>>>> d850441de3e60ac7547133f9e7ea5083865087ae

    try {
        let nextArgs = opts.resumeArgs;
        while (true) {
            if (exitReason) {
                if (!lastRolloutFile) {
                    const shouldPreferMtime = opts.resumeArgs?.includes('resume') || opts.resumeArgs?.includes('--resume');
                    lastRolloutFile = await findLatestCodexRolloutForCwd(
                        opts.path,
                        opts.resumeArgs?.includes('--all') ?? false,
                        { preferMtime: shouldPreferMtime }
                    );
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
<<<<<<< HEAD
        session.rpcHandlerManager.registerHandler('abort', async () => { });
        session.rpcHandlerManager.registerHandler('switch', async () => { });
        unsubscribe();
=======
        opts.session.rpcHandlerManager.registerHandler('abort', async () => { });
        opts.session.rpcHandlerManager.registerHandler('switch', async () => { });
>>>>>>> d850441de3e60ac7547133f9e7ea5083865087ae
        await scanner.cleanup();
    }
    if (!lastRolloutFile) {
        const shouldPreferMtime = opts.resumeArgs?.includes('resume') || opts.resumeArgs?.includes('--resume');
        lastRolloutFile = await findLatestCodexRolloutForCwd(
            opts.path,
            opts.resumeArgs?.includes('--all') ?? false,
            { preferMtime: shouldPreferMtime }
        );
    }
    return { reason: exitReason || 'exit', resumeFile: lastRolloutFile };
}
