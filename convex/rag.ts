import { RAG } from "@convex-dev/rag";
import { components } from "./_generated/api";
import { google } from "@ai-sdk/google";

export const rag = new RAG(components.rag, {
  textEmbeddingModel: google.textEmbedding("text-embedding-004"),
  embeddingDimension: 768,
  filterNames: ["date"],
});
