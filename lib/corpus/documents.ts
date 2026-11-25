export type SeedDocument = {
  id: string;
  title: string;
  text: string;
};

export const SEED_VERSION = 1;

export const SEED_DOCUMENTS: SeedDocument[] = [
  {
    id: "seed-rag",
    title: "Retrieval-augmented generation, a field guide",
    text: `# What retrieval-augmented generation is

A retrieval-augmented generation system answers a question by reading a small set of source passages before it writes. The pipeline has four stages: ingest, chunk, embed, and retrieve. The generator is only allowed to lean on what the retriever returned.

Ingest turns a PDF, a markdown note, or a web page into plain text. Chunking cuts that text into passages short enough to embed and specific enough to cite. Embedding maps each passage to a vector so similar wording lands nearby. Retrieval, given a new question, embeds the question with the same function and returns the nearest passages.

# Citations and faithfulness

DocMind keeps those passages visible. An inline citation is a numbered marker that jumps back to the exact chunk. That jump is the difference between a fluent answer and a checkable one. If the retriever returns nothing useful, the honest answer is that the library does not cover the question.

Faithfulness means every claim can be traced to a retrieved passage. Demo mode guarantees that by being extractive: it quotes the best sentences instead of paraphrasing them with a model that might invent a detail. A live model is instructed to cite the index numbers from the retrieve tool and to admit when the passages are silent.

# Tools around retrieval

A practical agent also has tools that are not retrieval. A calculator should own arithmetic, because language models mis-add. A web search tool should be labeled as web evidence and not mixed into library citations. Summarise and compare tools are retrieval with a narrower job: they pick one document, or two documents, and read them on purpose.

When you explain this in an interview, walk the request. The browser posts the message history. The server embeds the question, runs hybrid search, optionally calls another tool, then streams tokens. The client paints each tool-call step as it moves from input to output, then paints the answer, and wires each citation marker to a chunk id.
`,
  },
  {
    id: "seed-chunking",
    title: "Chunking and embeddings in practice",
    text: `# Why chunk size matters

Chunking decides what a citation can point at. A chunk that is too large mixes topics, so the vector is a blur and the citation is a whole chapter. A chunk that is too small loses the heading that gives a sentence its meaning. DocMind uses a window of about 900 characters with an overlap of about 140 characters. Overlap of about 140 characters keeps neighbouring chunks attached to the heading that explains them before those chunks are embedded.

Breaks prefer a paragraph boundary, then a sentence boundary, and only then a hard cut. Markdown headings start a new section so a heading stays with the paragraphs under it. Pages from a PDF are prefixed with the page label before they are windowed, which gives the reader a way back to the original page.

# Embeddings and cosine similarity

An embedding is a list of numbers. Cosine similarity compares direction, not length, so two passages about the same idea score high even when one is longer. Neural embedding models, such as a hosted text embedding model, capture paraphrase. They need an API key and they fix the vector width, often 1536 dimensions, which has to match the database column.

# Feature hashing for the demo

Demo mode uses feature hashing instead of a hosted model. Each token is hashed into a bucket in a 256-dimension vector, with a sign so unrelated tokens cancel instead of piling up. The vector is L2-normalised. Hashing is deterministic, needs no network, and is good enough for a small library of distinct notes. It is weaker at paraphrase, which is why retrieval here is hybrid: cosine similarity on the hash vector plus a BM25-style lexical score. The lexical score catches exact terms the hash smeared across buckets. The blend weights cosine at 0.62 and the lexical score at 0.38, after the lexical score is normalised.

Re-embed the whole library if you change the embedder or the dimension. Mixed vectors are not comparable. Postgres stores them in a pgvector column of a fixed width. The local JSON store stores the same arrays beside the chunk text so a recruiter can run the project with no database at all.
`,
  },
  {
    id: "seed-streaming",
    title: "Streaming responses and tool calling",
    text: `# Streaming as server-sent events

A research agent should show its work while it works. Streaming means the server sends the answer in pieces, as server-sent events, instead of waiting for the full completion. The Vercel AI SDK represents those pieces as a UI message stream: a start chunk, tool chunks, text deltas, and a finish chunk. The React hook useChat folds that stream into message parts the interface can render.

# The tool-call step

Tool calling is a loop. The model, or the demo router that stands in for a model, chooses a tool name and a JSON input. The server runs the tool, appends the output, and only then writes the prose. DocMind's tools are retrieve, calculator, webSearch, summariseDocument, and compareDocuments. Each one is a visible tool-call step. The step shows the input while it runs and the output when it finishes, so a reader can see that a number came from the calculator and a paragraph came from retrieve.

In demo mode there is no language model. A small router reads the question. Arithmetic goes to the calculator. A question that says compare goes to compareDocuments. Summarise goes to summariseDocument. An explicit web request goes to webSearch. Everything else retrieves from the library. The answer text is then streamed word by word so the interface still feels alive. The delay is configurable with MOCK_STREAM_DELAY_MS and is set to zero in continuous integration.

# Live providers

A live provider uses the same tool definitions through streamText. OpenAI, Anthropic, and an Ollama server exposed with an OpenAI-compatible base URL are selected with LLM_PROVIDER. The system instruction tells the model to call retrieve before answering from the library and to cite passage indexes. A step limit stops the loop so a confused model cannot call tools forever.

The client never has to know which provider ran. It only understands parts: text, tool, and citation data. That split is the piece to draw on a whiteboard.
`,
  },
  {
    id: "seed-stores",
    title: "Local vector stores and pgvector",
    text: `# The local JSON store

DocMind ships with two stores behind one interface. The default is a local JSON file in the .data directory. It needs no Docker and no accounts. On first launch the sample library is embedded and written there. The file is gitignored. Search loads the chunks and ranks them in process, which is the right design for a portfolio corpus of dozens of documents, not millions.

# Graduating to pgvector

pgvector is the graduation path. Docker Compose starts Postgres 16 with the pgvector extension. Set VECTOR_STORE to pgvector and set DATABASE_URL, then the same ingest path inserts rows. Chunks live in a table with a vector column of 256 dimensions and an HNSW index using vector cosine ops. Candidate generation asks Postgres for the nearest rows by cosine distance. The application still reranks those candidates with the lexical score, so the hybrid logic is not forked into two algorithms.

Choose the local store when you want a recruiter to clone the repository and run it. Choose pgvector when you want to talk about indexes, durability, and sharing one corpus across processes. The HNSW index matters once a sequential scan of every embedding gets slow. Until then, the honest complexity is the ranking function, not the database.

# Deletes, seeds, and secrets

Deleting a document deletes its chunks. In Postgres that is a foreign key with ON DELETE CASCADE. In the local file it is a filter. Seed documents have stable ids. Restoring the sample library reinserts any seed id that is missing without duplicating it.

Do not commit the data file or a database password. The compose file uses a local development password, and the example env file documents every variable with no secret filled in.
`,
  },
  {
    id: "seed-evals",
    title: "Evaluating a RAG system",
    text: `# A golden set

A retrieval system is testable. DocMind keeps a golden set of questions, each with the document id that ought to appear in the top three hits. The eval script embeds each question, runs hybrid search, and reports hit rate. A unit test fails if that hit rate drops, which is how a change to chunk size or to the blend weights gets caught.

Hit rate at three asks a narrow question: did we surface the right document? It does not ask whether the answer sentence was faithful. Citation precision asks that second question. For an extractive demo, precision is structural. Every quoted sentence is copied from a retrieved chunk, and the marker points at that chunk. For a live model, sample answers and check that each cited passage actually entails the claim. That review can be manual at first. Write the failures down. They become the next golden questions.

# Abstention is a feature

Other numbers worth knowing are recall at k, mean reciprocal rank, and the rate of abstentions. Abstention is a feature. If the top score is weak, DocMind says the library does not cover the question instead of stretching a passage. A high hit rate with no abstentions can hide confident wrong answers on questions that were never in the corpus. Keep a few out-of-corpus questions in the set and expect the abstain path.

Run the eval with npm run eval before you change the ranker. Talk about it in an interview as a regression suite for search, separate from the Playwright tests that check the streamed interface.
`,
  },
];
