import React, { useMemo, useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

import type { CodexResumeEntry } from '@/codex/utils/rolloutScanner';

interface CodexResumeSelectorProps {
    entries: CodexResumeEntry[];
    showAll: boolean;
    onSelect: (entry: CodexResumeEntry) => void;
    onCancel: () => void;
}

const MAX_PREVIEW = 120;

export const CodexResumeSelector: React.FC<CodexResumeSelectorProps> = ({
    entries,
    showAll,
    onSelect,
    onCancel,
}) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const { stdout } = useStdout();

    const filtered = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return entries;
        return entries.filter((entry) => {
            const haystack = [
                entry.preview,
                entry.gitBranch,
                entry.cwd,
                entry.id,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(normalized);
        });
    }, [entries, query]);

    useEffect(() => {
        if (selectedIndex >= filtered.length) {
            setSelectedIndex(Math.max(0, filtered.length - 1));
        }
    }, [filtered.length, selectedIndex]);

    useInput((input, key) => {
        if (key.upArrow) {
            setSelectedIndex((prev) => Math.max(0, prev - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedIndex((prev) => Math.min(filtered.length - 1, prev + 1));
            return;
        }
        if (key.return) {
            const entry = filtered[selectedIndex];
            if (entry) {
                onSelect(entry);
            }
            return;
        }
        if (key.escape || (key.ctrl && input === 'c')) {
            onCancel();
            return;
        }
        if (key.backspace || key.delete) {
            setQuery((prev) => prev.slice(0, -1));
            setSelectedIndex(0);
            return;
        }
        if (!key.ctrl && !key.meta && !key.shift && input && input.length === 1) {
            setQuery((prev) => prev + input);
            setSelectedIndex(0);
        }
    });

    const rows = useMemo(() => {
        return filtered.map((entry) => {
            const updated = formatRelativeTime(entry.updatedAt);
            const branch = entry.gitBranch ?? '-';
            const cwd = entry.cwd ?? '-';
            const preview = truncate(entry.preview, MAX_PREVIEW);
            return { entry, updated, branch, cwd, preview };
        });
    }, [filtered]);

    const maxUpdated = Math.max('Updated'.length, ...rows.map((row) => row.updated.length));
    const maxBranch = Math.max('Branch'.length, ...rows.map((row) => row.branch.length));
    const maxCwd = Math.max('CWD'.length, ...rows.map((row) => row.cwd.length));

    const totalRows = rows.length;
    const usableRows = Math.max(5, (stdout?.rows ?? 24) - 6);
    const start = Math.max(
        0,
        Math.min(selectedIndex, Math.max(0, totalRows - usableRows))
    );
    const visible = rows.slice(start, start + usableRows);

    return (
        <Box flexDirection="column" paddingY={1}>
            <Text color="cyan">Resume a previous session</Text>
            <Text dimColor>{query ? `Search: ${query}` : 'Type to search'}</Text>

            <Box marginTop={1} flexDirection="column">
                <Text>
                    {pad('Updated', maxUpdated)}  {pad('Branch', maxBranch)}{' '}
                    {showAll ? `${pad('CWD', maxCwd)} ` : ''}Conversation
                </Text>
                {visible.length === 0 ? (
                    <Text dimColor>No matching sessions.</Text>
                ) : (
                    visible.map((row, index) => {
                        const absoluteIndex = start + index;
                        const selected = absoluteIndex === selectedIndex;
                        const prefix = selected ? '>' : ' ';
                        return (
                            <Text key={row.entry.id} color={selected ? 'cyan' : undefined}>
                                {prefix} {pad(row.updated, maxUpdated)}  {pad(row.branch, maxBranch)}{' '}
                                {showAll ? `${pad(row.cwd, maxCwd)} ` : ''}{row.preview}
                            </Text>
                        );
                    })
                )}
            </Box>

            <Box marginTop={1}>
                <Text dimColor>Up/Down to navigate, Enter to resume, Esc to cancel</Text>
            </Box>
        </Box>
    );
};

function truncate(text: string, max: number): string {
    if (!text) return '';
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function pad(value: string, width: number): string {
    if (value.length >= width) return value;
    return value + ' '.repeat(width - value.length);
}

function formatRelativeTime(date?: Date): string {
    if (!date) return '-';
    const diffMs = Date.now() - date.getTime();
    const seconds = Math.max(0, Math.floor(diffMs / 1000));
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
