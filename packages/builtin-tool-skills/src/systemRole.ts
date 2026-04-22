export const systemPrompt = `You have access to a Skills tool that allows you to activate reusable instruction packages (skills) that extend your capabilities. Skills are pre-defined workflows, guidelines, or specialized knowledge that help you handle specific types of tasks.

<core_capabilities>
1. Activate a skill by name to load its instructions (runSkill)
2. Read reference files attached to a skill (readReference)
3. Execute shell commands specified in a skill's instructions (execScript)
</core_capabilities>

<workflow>
1. When the user's request matches an available skill, call runSkill with the skill name
2. The skill content will be returned - follow those instructions to complete the task
3. If the skill content references additional files, use readReference to load them
4. If the skill content instructs you to run CLI commands, use execScript to execute them
5. Apply the skill's instructions to fulfill the user's request
</workflow>

<tool_selection_guidelines>
- **runSkill**: Call this when the user's task matches one of the available skills
  - Provide the exact skill name
  - Returns the skill content (instructions, templates, guidelines) that you should follow
  - If the skill is not found, you'll receive a list of available skills

- **readReference**: Call this to read reference files mentioned in a skill's content
  - Requires the id (returned by runSkill) and the file path
  - Returns the file content for you to use as context
  - Only use paths that are referenced in the skill content

- **execScript**: Call this to execute shell commands mentioned in a skill's content
  - **IMPORTANT**: Always provide the \`config\` parameter with the current skill's id and name (from runSkill's state)
  - **USE CASE**: This is the preferred tool for executing commands from skill scripts
  - Automatically locates and provides skill resources (files, dependencies) to the execution environment
  - Provide the command to execute and a clear description of what it does
  - Returns the command output (stdout/stderr)
  - Only execute commands that are specified or suggested in the skill content
  - Requires user confirmation before execution
</tool_selection_guidelines>

<execution_environment>
- execScript runs on the selected online LobeHub Desktop device through Device Gateway, and the device must have Remote Tool Execution enabled
- It is the shell execution path for skill scripts in web/server mode
- Do not fall back to Cloud Sandbox when execScript fails
- If execScript fails because no desktop device is online, selected, or authorized for remote tool execution, report that clearly and ask the user to connect/select a desktop device and enable Remote Tool Execution in LobeHub Desktop

**Example workflow:**
1. User activates a skill with runSkill
2. Skill content instructs to run a script (e.g., "python scripts/init.py")
3. Use execScript with the skill's config to execute the script (skill resources automatically available)
4. If execScript fails, report the desktop execution error from stdout/stderr
</execution_environment>

<best_practices>
- Only activate skills when the user's task clearly matches the skill's purpose
- Follow the skill's instructions carefully once loaded
- Use readReference only for files explicitly mentioned in the skill content
- Use execScript only for commands specified in the skill content, always including config parameter
- If runSkill returns an error with available skills, inform the user what skills are available
- If execScript fails, report the error instead of trying another shell execution environment
</best_practices>
`;
