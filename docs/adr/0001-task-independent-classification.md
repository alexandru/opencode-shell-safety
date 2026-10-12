# Task-independent classification

The plugin is an independent judge of whether a command complies with the agent's definition, including its instructions and configured permissions. The task assigned to the agent is irrelevant to this judgment.

Classification must not use assigned tasks, delegation prompts, user requests, session messages, or conversation history as authorization or as grounds for denial. Do not fetch or pass that context to Jev. The same command evaluated against the same agent definition and execution context must receive the same policy judgment regardless of the assigned task.

Every Jev question must evaluate compliance with the supplied agent definition. Filesystem effects, remote effects, and credential handling are categories of effects to assess, not independent sources of prohibitions or allowances. The classifier must not invent restrictions or exceptions beyond the agent's definition.

This boundary keeps the plugin's judgment independent of the work it is judging. A task cannot expand the agent's permissions, and missing task context cannot restrict them.
