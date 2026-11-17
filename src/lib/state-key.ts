/** Separate deployments sharing Redis without trusting browser-controlled namespaces. */
export default function stateKey(suffix: string) {
  const prefix = process.env.CHAT_STATE_PREFIX ?? "starter";
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(prefix))
    throw new Error("invalid_state_namespace");
  return `${prefix}:${suffix}`;
}
