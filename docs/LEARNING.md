# Learning DocMind

This is the study guide for explaining the project in an interview. Read it next to the code. Each section names the file, the idea, and a question you should be able to answer out loud.

The sample library is five original notes about the system itself: RAG, chunking, streaming, vector stores, and evals. Asking the app about those notes is a good way to rehearse.

## 1. Follow one question

Ask: "Why do we overlap chunks before embedding them?"

1. `components/workspace.tsx` sends the text with `useChat`. The request body also carries `documentIds` when the library filter is on.
2. `app/api/chat/route.ts` reads the latest user text. In demo mode it calls `mockChatResponse`. With a live provider it calls `liveChatResponse`.
3. `lib/agent/intent.ts` classifies the question. This one is retrieval, not math, compare, summarise, or web.
4. `lib/agent/turn.ts` calls `retrievePassages`.
5. The store embeds the question and ranks chunks in `lib/rag/rank.ts`.
6. `lib/rag/answer.ts` copies the best sentences and numbers them `[1]`, `[2]`.
7. `lib/agent/mock-stream.ts` writes tool chunks, then text deltas, then `data-citation` parts, on a Vercel AI SDK UI message stream.
8. `components/chat-thread.tsx` renders the tool step and turns `[1]` into a button.
9. `components/source-drawer.tsx` loads `GET /api/documents/:id` and highlights the quoted sentence inside the chunk.

Say that sequence without looking. If you can, you understand the product.

## 2. The RAG pipeline

Retrieval-augmented generation means the writer has to read first.

| Stage | Where | What happens |
| --- | --- | --- |
| Ingest | `app/api/documents/route.ts`, `lib/ingest/*` | PDF, Markdown, paste, or URL becomes plain text. |
| Chunk | `lib/rag/chunk.ts` | Headings start sections. Sections are windowed. |
| Embed | `lib/rag/embed.ts` | Each chunk becomes a vector with the same function the query will use. |
| Store | `lib/store/local.ts` or `lib/store/pg.ts` | Vectors sit next to the text. |
| Retrieve | `lib/rag/rank.ts` | The question is embedded and ranked against chunks. |
| Generate | `lib/rag/answer.ts` or the live model | The answer is allowed to use what retrieval returned. |
| Cite | chat thread + source drawer | The reader can check the sentence. |

**Interview point.** The generator is not the hard part to make honest. The hard part is refusing to answer when retrieval is weak. `composeGroundedAnswer` abstains when there are no hits above the score floor. Abstention is a feature. A confident paragraph with no passage behind it is the bug.

**Exercise.** Add an out-of-corpus question to `lib/eval/golden.ts`, such as "What is the capital of Portugal?", and assert that `planTurn` returns no citations. Then try a near-miss question and see whether the abstain threshold is too timid or too aggressive.

## 3. Chunking

`chunkText` splits on markdown headings first, then `windowText` packs a section into windows of about 900 characters with about 140 characters of overlap.

Why overlap exists: a break in the middle of an argument would otherwise leave the second window without the sentence that makes it meaningful. The overlap keeps that sentence in both windows, so either one can be cited.

Breaks prefer a paragraph boundary, then a sentence boundary, then a hard cut. A tiny tail is discarded in favor of the hard cut so the loop cannot emit scraps.

The seed note "Chunking and embeddings in practice" describes these numbers. If you change the constants, change the note, or the demo will quote a lie. That is a useful property of an extractive demo.

**Exercise.** Build a fixture where the important sentence sits on the boundary. Confirm it appears in two chunks. Then set overlap to 0 and watch the golden-set hit rate. Write down which question failed.

## 4. Embeddings

An embedding is a list of numbers. Cosine similarity compares direction. Two notes about the same idea should point the same way even if one is longer. `hashEmbed` L2-normalises, so cosine is just the dot product. See `cosineSimilarity`.

Demo mode does not call an embedding API. `hashEmbed` is feature hashing:

- Tokenise, drop stopwords, weight by log term frequency.
- Hash each token into a bucket in a 256-dimension vector.
- A second hash and a sign bit spread the token and let unrelated tokens cancel.
- Character trigrams add a little robustness to spelling.

Hashing is deterministic and free. It is bad at paraphrase: "overlap" and "shared context window" will not land in the same buckets. That is why retrieval is hybrid.

A hosted model such as `text-embedding-3-small` is better at paraphrase and costs a key. `embedText` sends `dimensions` so the vector width still matches the column. Mixed widths are not comparable. `embedderId` records which function built a local store. Switching back to hash rebuilds those vectors. Switching to OpenAI does not silently spend money on a rebuild. Delete `.data` yourself.

**Exercise.** In a test, embed "chunk overlap" and "shared sliding window" with the hash embedder and print the cosine. Then describe, without calling an API, what a neural embedder would do differently. If you have a key, set `EMBEDDING_PROVIDER=openai` on one fixture and compare the two scores.

## 5. Hybrid retrieval

`rankChunks` blends two signals:

- Cosine on the vectors, weight 0.62.
- A BM25-style lexical score, weight 0.38, normalised by the best score in the candidate set.

BM25 rewards a query term that is rare in the corpus and frequent in the chunk, and it discounts chunks that are long. The implementation is in `lexicalScores`. It is not a Postgres `tsvector`. The same function reranks pgvector candidates, so the two stores do not hide two different rankers.

pgvector's job, in `lib/store/pg.ts`, is candidate generation. It asks Postgres for the nearest rows by cosine distance, using the HNSW index from `drizzle/init.sql`. The app then reranks those rows in process. For a library of dozens of notes the local store just ranks everything. That is the right design until a sequential scan hurts.

**Interview point.** An index does not fix a bad similarity function. Say that, then point at the blend weights.

**Exercise.** Change `LEXICAL_WEIGHT` to 0 and rerun `npm run eval`. Then set it to 1. Record which questions move. That is an ablation, and it is a good story.

## 6. Streaming

The browser does not wait for a finished essay. The server writes a UI message stream. The chunks that matter here:

- `start` carries metadata: mock or live, and the provider name.
- `tool-input-start`, `tool-input-available`, `tool-output-available` are one visible tool step.
- `text-start`, `text-delta`, `text-end` are the prose.
- `data-citation` is the structured citation, separate from the `[1]` marker in the text.
- `finish` closes the message.

`useChat` folds those chunks into `message.parts`. The thread renders parts. It does not scrape a blob of text and guess. That is why a mock agent and a live model can share a UI.

`MOCK_STREAM_DELAY_MS` slows the demo so the steps are visible. CI sets it to 0. The delay is cosmetic. The plan is computed before the first token, which you should be honest about: demo streaming shows work that has already finished. A live model streams because the model itself is still generating.

**Exercise.** In the browser devtools, watch the response to `/api/chat` and name three chunk types before the answer is complete. Then set the delay to 80 and watch the tool step sit on "Running".

## 7. Tool calling

Tools in this app:

| Tool | When | Implementation |
| --- | --- | --- |
| `retrieve` | Default library question | Hybrid search, then an extractive answer |
| `calculator` | "Calculate …" or a bare expression | Recursive-descent parser, not `eval` |
| `webSearch` | The user asks for the web | DuckDuckGo Instant Answers, or an honest miss |
| `summariseDocument` | "Summarise …" | Title match, then the first sentence of each chunk |
| `compareDocuments` | "Compare A with B" | Two searches, quoted side by side |

The demo router is a stand-in for a model. It is deterministic, which makes the tests possible. The live path in `lib/agent/live.ts` registers the same tools with Zod input schemas and `streamText`. `stepCountIs(6)` stops a model that will not stop calling tools.

The calculator is a good interview exhibit. Language models are unreliable at arithmetic. A tool with a real parser is reliable, and the UI shows the call so the number's origin is obvious. The parser refuses words and division by zero.

Web search is not allowed to costume itself as a library citation. Offline, the note says it is not a web result.

URL ingest is a different door and it is hostile. `lib/ingest/url-guard.ts` allows only http(s), blocks localhost, link-local, and private ranges, and checks DNS so a public name cannot resolve to `127.0.0.1`. Redirects are followed manually and checked again.

**Exercise.** Add a tool, `outline`, that returns only headings. Wire it in the router and in `live.ts`. Add a unit test that the intent "Outline the streaming notes" selects it. Do not add a path that uses `eval` or `Function` for the calculator.

## 8. Evals

`lib/eval/golden.ts` is a list of questions and the document id that should appear in the top three hits. `npm run eval` prints hit@3. `tests/eval.test.ts` fails if the rate is below 1. A second test checks that the quoted sentence is actually inside the chunk. That is citation precision for an extractive system: it is structural, not a vibe.

Hit rate does not measure whether a paraphrasing model told the truth. For a live model you would sample answers and check that each cited passage entails the claim. Start that by hand. Write the failures back into the golden set.

Keep at least one question the corpus cannot answer, and expect abstention. A perfect hit rate on only in-corpus questions can hide a system that never says "I don't know".

**Exercise.** Add a sixth seed note and two golden questions. Change the chunk size until one question fails. Fix it by editing the note or the chunker, and say which lever you pulled and why.

## 9. Stores, auth, and deploy

`getStore` picks `LocalVectorStore` unless `VECTOR_STORE=pgvector`. Both classes implement `lib/store/types.ts`. The API routes do not know which one they have.

The local file is `.data/store.json`, gitignored. Writes go to a temp file and then rename, so a crash mid-write does not leave a half JSON document. A single in-process queue serialises those writes.

The Drizzle schema in `lib/db/schema.ts` matches `drizzle/init.sql`. Postgres deletes chunks with `ON DELETE CASCADE`. The local store filters them out.

`DOCMIND_ACCESS_KEY` is optional. When it is unset, the app is open. When it is set, chat and ingest require the header or an httpOnly cookie. Health stays public so the UI can show the lock.

Vercel can host the Next.js app. The local store will not survive an ephemeral filesystem. Say that before someone asks. The durable option is `DATABASE_URL`.

## 10. Tests worth defending

- `tests/rag.test.ts` covers overlap, normalisation, rank, quoting, and abstention.
- `tests/tools.test.ts` covers the calculator, the router, SSRF host classes, PDF literals, and web search with a fake fetcher.
- `tests/eval.test.ts` is the retrieval regression and the citation check.
- `e2e/demo.spec.ts` drives the real server: a cited answer, the calculator, and the mobile library sheet.

Playwright runs against `next start`, not the dev server, so it sees the production bundle.

## 11. A 90-second explanation

"DocMind is a research workspace. Documents are chunked, embedded, and stored, locally by default or in pgvector. A question is embedded with the same function and ranked with cosine plus BM25. Demo mode has no model: it quotes the winning sentences and streams them through the AI SDK protocol, with the tool call visible. Citations open the chunk. A live OpenAI, Anthropic, or Ollama model can use the same tools. I keep a golden set so a chunking change that drops the right document fails CI. URL ingest refuses private hosts. The point of the demo is that an answer you cannot click back to the source is not finished."
