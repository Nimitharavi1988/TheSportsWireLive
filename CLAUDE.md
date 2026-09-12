# Instructions for Claude Code

## Token usage

Operate in minimal-token-usage mode by default, in every session on this project, until the user explicitly says usage has been topped up / this restriction is lifted:

- Keep responses short — result and next step, not a narration of process.
- Don't re-read files already read or just edited in this session; trust prior tool results.
- Batch related tool calls instead of exploratory back-and-forth reads.
- Skip optional verification passes (extra screenshots, redundant console/log checks) unless the change is genuinely risky or the user needs visual proof.
- Don't spawn subagents for work that can be done directly — a subagent re-derives context from scratch, which costs more tokens than doing it inline.
- Summarize diffs/file contents back to the user instead of pasting large blocks.
