import type { FirewallRemediation } from "../events.js";

/**
 * Build the standard set of firewall-block remediations for a non-interactive
 * block event. Shared by every tool that gates a risky action (fills, form
 * submissions, navigation, and Tabstack URL fetches) so the guidance is
 * identical across sinks.
 */
export function buildFirewallRemediations(blockedHostnames: string[]): FirewallRemediation[] {
  const uniqueHosts = Array.from(new Set(blockedHostnames.filter((h): h is string => Boolean(h))));
  return [
    {
      kind: "add-trusted-hostnames",
      hostnames: uniqueHosts,
      description:
        uniqueHosts.length > 0
          ? `Add ${uniqueHosts.join(", ")} to trusted_hostnames to allow this action on this site.`
          : "Add the page hostname to trusted_hostnames to allow this action on this site.",
    },
    {
      kind: "enable-interactive-mode",
      description:
        "Run in interactive mode by providing a UserDataCallback so the agent can ask the user to approve sensitive fields per-action via request_user_data.",
    },
    {
      kind: "enable-unsafe-mode",
      description:
        "Set unsafe_mode=true to disable the action firewall entirely. WARNING: prompt injection from page content can then drive the agent to submit any field, including personal and credential data, to attacker-controlled forms.",
    },
  ];
}
