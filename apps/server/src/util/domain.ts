import { config } from "../config.js";

/** label（如 my-cat）→ 完整域名（如 w2s-my-cat.example.com） */
export function fullDomain(label: string): string {
  return config.deploy.domainTemplate.replace("{label}", label);
}
