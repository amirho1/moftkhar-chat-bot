type KnowledgeSource = {
  id: string;
  name: string;
  ownership: string;
};

/** Resolve a management source without guessing between duplicate names. */
export function selectKnowledgeSource(
  sources: unknown,
  name: string,
  sourceId?: string,
): KnowledgeSource | undefined {
  if (
    !Array.isArray(sources) ||
    !sources.every(
      (source) =>
        source !== null &&
        typeof source === "object" &&
        typeof source.id === "string" &&
        source.id.trim().length > 0 &&
        typeof source.name === "string" &&
        typeof source.ownership === "string",
    )
  )
    throw new Error(
      "Unexpected source API response; stop to prevent duplicates",
    );

  const selectedId = sourceId?.trim();
  if (selectedId && /\[(?:REDACTED|MASKED)[^\]]*\]/i.test(selectedId))
    throw new Error("DOCSGPT_SOURCE_ID must not contain a redaction marker");

  const matches = sources.filter(
    (source) => source.name === name && source.ownership === "user",
  );
  if (selectedId) {
    const selected = sources.filter((source) => source.id === selectedId);
    if (
      selected.length !== 1 ||
      selected[0].name !== name ||
      selected[0].ownership !== "user"
    )
      throw new Error(
        "DOCSGPT_SOURCE_ID must identify exactly one user-owned source with the configured knowledge name; no source was selected",
      );
    return selected[0];
  }
  if (matches.length > 1)
    throw new Error(
      "Duplicate source identity requires review. Inspect sources through protected DocsGPT management and set DOCSGPT_SOURCE_ID to the reviewed source ID; existing sources were preserved",
    );
  return matches[0];
}
