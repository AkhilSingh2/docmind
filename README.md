# DocMind

Research that cites its sources.

DocMind is a portfolio research agent for [Akhilendra Singh](https://github.com/AkhilSingh2). You load PDFs, Markdown, and public web pages. You ask a question. The agent retrieves the passage, shows the tool call, and streams an answer whose numbered citations jump back to the exact chunk.

It runs with **zero API keys**. Demo mode uses a deterministic embedder and an extractive answerer, so a recruiter can clone the repo and try the full loop on a seeded library of interview notes.

![DocMind on desktop: library, a cited answer, and the source passage](docs/images/desktop-research.png)

![DocMind on a phone](docs/images/mobile-research.png)

## Features

- Upload a PDF, Markdown, or text file, paste a note, or ingest a public URL.
- Chunk with heading-aware windows and overlap, then embed.
- Hybrid retrieval: hashed vectors plus a BM25-style lexical score. Optional Postgres + pgvector.
- Streamed answers over the Vercel AI SDK UI message stream.
- Inline citations that open the source passage and highlight the quoted sentence.
- Visible tool steps: retrieve, calculator, web search, summarise, and compare.
- Provider switch: mock (default), OpenAI, Anthropic, or Ollama.
- Optional shared access key. Open by default.
- Dark and light themes, keyboard access, and a layout that works on a phone.
- Unit tests, a golden-set retrieval eval, Playwright, and GitHub Actions.

## Architecture

```mermaid
flowchart LR
  UI[Workspace] -->|messages| Chat[POST /api/chat]
  Chat --> Mode{LLM_PROVIDER}
  Mode -->|mock| Router[Intent router]
  Mode -->|openai, anthropic, ollama| Model[streamText and tools]
  Router --> Tools[Tool implementations]
  Model --> Tools
  Tools --> Search[Hybrid rank]
  Search --> Store[(Local JSON or pgvector)]
  Chat --> Stream[UI message stream]
  Stream --> UI
```

Ingest is a separate path: a file, paste, or URL becomes text, then chunks, then embeddings, then rows in the same store. The sample library is inserted the first time the store is empty.

## Tech stack

- Next.js App Router and TypeScript
- Vercel AI SDK (`streamText`, `useChat`, UI message streams)
- Tailwind CSS and Framer Motion
- Drizzle schema for Postgres, with a local JSON store as the default
- pgvector via Docker Compose
- Vitest, Playwright, GitHub Actions

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The sample notes are already searchable. Try:

- Why do we overlap chunks before embedding them?
- Compare the local vector store with pgvector
- How should I evaluate a RAG system?
- Calculate (12 + 8) * 3

Other commands:

```bash
npm test          # unit tests, including the golden-set hit rate
npm run eval      # print hit@3 for the sample library
npm run lint
npm run typecheck
npm run build && npm start
npm run test:e2e  # needs a production build first; Playwright boots it
```

## Demo mode

`LLM_PROVIDER` defaults to `mock` and `EMBEDDING_PROVIDER` defaults to `hash`. Nothing is called over the network to answer a library question.

Demo mode is extractive on purpose. The router picks a tool, retrieval returns passages, and the answer quotes sentences from those passages. A citation cannot point at a sentence the library does not contain. Web search uses DuckDuckGo Instant Answers when the network allows, and otherwise says that no live abstract came back. It does not invent news.

Set `MOCK_STREAM_DELAY_MS=0` if you want the stream to flush immediately. CI does this.

## Real models and Postgres

Copy `.env.example` to `.env.local`. Never commit that file.

```bash
LLM_PROVIDER=openai          # or anthropic, or ollama
OPENAI_API_KEY=...           # only for OpenAI
EMBEDDING_PROVIDER=openai    # optional; hash still works with a live chat model
```

The live path uses the same five tools through `streamText`. The system instruction tells the model to cite passage indexes from the tool output.

For pgvector:

```bash
docker compose up -d
```

Then set `VECTOR_STORE=pgvector` and `DATABASE_URL=postgres://docmind:docmind@localhost:5432/docmind`. The app applies `drizzle/init.sql` if the `chunks` table is missing. The vector column is 256 dimensions, matching the default embedder. If you change `EMBEDDING_DIMENSIONS`, change the column too and re-index. Delete `.data/` after switching embedders so old vectors are not mixed with new ones.

`DOCMIND_ACCESS_KEY`, when set, requires that passphrase before chat and ingest. Leave it unset for the public demo.

## Deploy on Vercel

1. Import the GitHub repository.
2. Framework preset: Next.js. No extra build command.
3. Leave `LLM_PROVIDER` unset, or set it to `mock`, for a keyless demo.
4. The local JSON store lives on the instance disk. On Vercel that disk is ephemeral, so the sample library is reseeded when the instance is fresh and uploaded files do not survive a cold start. For a durable corpus, run Postgres + pgvector somewhere reachable and set `DATABASE_URL` and `VECTOR_STORE=pgvector`.
5. Add `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` only if you set a live provider.
6. Do not put secrets in the repo. `.env.example` lists every variable.

## What this demonstrates

- A retrieval pipeline you can trace from the upload route to the citation button.
- Hybrid search, and why a hash embedder still needs a lexical score.
- Streaming and tool calling with one UI protocol for a mock agent and a live model.
- An eval that fails the build when the right document drops out of the top three.
- SSRF checks on URL ingest, optional auth, and a deploy story that does not require a key to be impressive.

The study guide is [docs/LEARNING.md](docs/LEARNING.md). It maps the interview explanation onto the files.
