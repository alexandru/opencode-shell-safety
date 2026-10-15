import { Schema } from "effect"
import { copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

export type IsolatedOpenCode = {
  readonly project: string
  readonly homeDirectory: string
  readonly url: string
  readonly request: (method: "GET" | "POST" | "DELETE", path: string, body?: string) => Promise<string>
  readonly createProject: (name: string) => Promise<string>
  readonly stop: () => Promise<void>
}

const StartupResponse = Schema.Struct({ url: Schema.String })
const LocalPluginSource = Schema.Struct({ type: Schema.Literal("local"), path: Schema.String })
const NonLocalPluginSource = Schema.Struct({
  type: Schema.String,
  path: Schema.optionalKey(Schema.String),
})
const PluginSource = Schema.Union([LocalPluginSource, NonLocalPluginSource])
const PluginResponse = Schema.Struct({
  data: Schema.Array(Schema.Struct({ id: Schema.String, source: PluginSource })),
})

const repository = fileURLToPath(new URL("../..", import.meta.url))
const fixtures = fileURLToPath(new URL("../fixtures/agents", import.meta.url))
const fixtureNames = ["Analyst.md", "Explorer.md", "Librarian.md", "Junior.md", "Solo.md"]
const password = "shell-safety-e2e"

const options = {
  endpoint: "https://api.typesafe.ai/v1/systemone",
  model: "jev-1.13.0",
  apiKeyEnv: "TYPESAFE_API_KEY",
  allowProbability: 0.35,
  violationProbability: 0.5,
  timeoutMs: 15000,
  maxAttempts: 2,
  retryDelayMs: 250,
  cache: { capacity: 256, ttlMs: 300000 },
  agents: {
    Analyst: {
      enabled: true,
      thresholds: { allowProbability: 0.35, violationProbability: 0.55 },
    },
    Explorer: {
      enabled: true,
      allowed_tools: ["cellar"],
      http: { methods: [], credentials: {} },
    },
    Librarian: {
      enabled: true,
      allowed_tools: ["cellar", "gh", "az", "curl"],
      http: {
        methods: ["GET", "HEAD"],
        credentials: {
          BRAVE_SEARCH_API_KEY: ["api.search.brave.com"],
          OS_TK: {
            hosts: ["orangesharing.com"],
            scheme: "https",
            header: "Authorization",
            disclosure: "deny",
          },
        },
      },
    },
    Junior: {
      enabled: true,
      thresholds: { allowProbability: 0.35, violationProbability: 0.55 },
      http: {
        methods: ["GET", "HEAD"],
        credentials: { BRAVE_SEARCH_API_KEY: ["api.search.brave.com"] },
      },
    },
    Solo: {
      enabled: true,
      fallback: "ask",
    },
  },
}

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })

const readFirstLine = async (stream: ReadableStream<Uint8Array<ArrayBuffer>>): Promise<string> => {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let text = ""
  try {
    while (true) {
      const chunk = await reader.read()
      text += decoder.decode(chunk.value, { stream: !chunk.done })
      const newline = text.indexOf("\n")
      if (newline >= 0) return text.slice(0, newline).replace(/\r$/, "")
      if (chunk.done) return text
    }
  } finally {
    reader.releaseLock()
  }
}

const runtimeDirectories = ["home", "config", "data", "cache", "state", "db"]

const createRuntimeRoot = async (): Promise<string> => {
  const testRuntime = join(repository, ".test-runtime")
  await mkdir(testRuntime, { recursive: true })
  const runtimeRoot = await mkdtemp(join(testRuntime, "run-"))
  await Promise.all(runtimeDirectories.map((directory) => mkdir(join(runtimeRoot, directory))))
  return runtimeRoot
}

const opencodeConfig = () => {
  return {
    $schema: "https://opencode.ai/config.json",
    update: "disable",
    websearch: false,
    model: "openai/gpt-5.6-sol",
    experimental: {
      policies: [{ action: "provider.use", resource: "opencode", effect: "deny" }],
    },
    agents: {
      ask: { disabled: true },
      plan: { disabled: true },
      build: { disabled: true },
      general: { disabled: true },
      explore: { disabled: true },
      scout: { disabled: true },
      Analyst: { model: "opencode-go/deepseek-v4.1-flash#low" },
      Junior: { model: "opencode-go/deepseek-v4.1-flash#max" },
      Explorer: { model: "opencode-go/deepseek-v4.1-flash#low" },
      Librarian: { model: "opencode-go/deepseek-v4.1-flash#low" },
      Solo: { model: "opencode-go/deepseek-v4.1-flash#low" },
    },
    plugins: [{ package: join(repository, "src"), options }],
    permissions: [
      { action: "external_directory", resource: "*", effect: "deny" },
      { action: "external_directory", resource: "~/.agents/skills", effect: "allow" },
      { action: "external_directory", resource: "~/.agents/skills/**", effect: "allow" },
      { action: "external_directory", resource: "~/.config/opencode/skills", effect: "allow" },
      { action: "external_directory", resource: "~/.config/opencode/skills/**", effect: "allow" },
      { action: "external_directory", resource: "/tmp", effect: "allow" },
      { action: "external_directory", resource: "/tmp/**", effect: "allow" },
      { action: "external_directory", resource: "/private/tmp", effect: "allow" },
      { action: "external_directory", resource: "/private/tmp/**", effect: "allow" },
      { action: "external_directory", resource: "~/.m2/repository/**", effect: "allow" },
      { action: "external_directory", resource: "~/.npm", effect: "allow" },
      { action: "external_directory", resource: "~/.npm/**", effect: "allow" },
      { action: "external_directory", resource: "~/.gradle/caches/**", effect: "allow" },
      { action: "external_directory", resource: "~/.ivy2/cache/**", effect: "allow" },
      { action: "external_directory", resource: "~/.cache/coursier/**", effect: "allow" },
      { action: "external_directory", resource: "~/Library/Caches/Coursier/**", effect: "allow" },
      { action: "external_directory", resource: "~/.config/opencode", effect: "allow" },
      { action: "external_directory", resource: "~/.config/opencode/**", effect: "allow" },
      { action: "external_directory", resource: "~/.local/share/opencode", effect: "allow" },
      { action: "external_directory", resource: "~/.local/share/opencode/**", effect: "allow" },
      { action: "external_directory", resource: "~/.local/state/opencode", effect: "allow" },
      { action: "external_directory", resource: "~/.local/state/opencode/**", effect: "allow" },
      { action: "external_directory", resource: "~/.cache/opencode", effect: "allow" },
      { action: "external_directory", resource: "~/.cache/opencode/**", effect: "allow" },
      { action: "external_directory", resource: "~/.opencode", effect: "allow" },
      { action: "external_directory", resource: "~/.opencode/**", effect: "allow" },
    ],
  }
}

export const startIsolatedOpenCode = async (projectName?: string): Promise<IsolatedOpenCode> => {
  const runtimeRoot = await createRuntimeRoot()
  const project = projectName === undefined ? repository : join(runtimeRoot, projectName)
  let child: Bun.Subprocess<"pipe", "pipe", "pipe"> | undefined
  let stderr = ""
  let stderrDrain: Promise<void> = Promise.resolve()
  let stopped = false
  let lastResponse = ""

  const createProject = async (name: string): Promise<string> => {
    const created = join(runtimeRoot, name)
    await mkdir(created, { recursive: true })
    return created
  }

  const stop = async (): Promise<void> => {
    if (stopped) return
    stopped = true
    try {
      if (child !== undefined) {
        await Promise.resolve(child.stdin.end()).catch(() => undefined)
        if (child.exitCode === null) {
          await Promise.race([child.exited.then(() => undefined), sleep(500)])
        }
        if (child.exitCode === null) {
          child.kill()
          await Promise.race([child.exited.then(() => undefined), sleep(500)])
        }
        if (child.exitCode === null) {
          child.kill(9)
          await Promise.race([child.exited.then(() => undefined), sleep(5000)])
        }
        await Promise.race([stderrDrain, sleep(5000)])
      }
    } finally {
      await rm(runtimeRoot, { recursive: true, force: true })
    }
  }

  let ready = false
  const result = (async (): Promise<IsolatedOpenCode> => {
    if (projectName !== undefined) await createProject(projectName)
    const configDirectory = join(runtimeRoot, "config")
    await mkdir(join(configDirectory, "agents"), { recursive: true })
    await Promise.all(
      fixtureNames.map((fixture) => copyFile(join(fixtures, fixture), join(configDirectory, "agents", fixture))),
    )
    await writeFile(join(configDirectory, "opencode.jsonc"), JSON.stringify(opencodeConfig()), "utf8")
    const home = join(runtimeRoot, "home")
    const environment = {
      ...process.env,
      OPENCODE_CONFIG: undefined,
      OPENCODE_CONFIG_CONTENT: undefined,
      HOME: home,
      OPENCODE_TEST_HOME: home,
      XDG_CONFIG_HOME: join(runtimeRoot, "config"),
      XDG_DATA_HOME: join(runtimeRoot, "data"),
      XDG_CACHE_HOME: join(runtimeRoot, "cache"),
      XDG_STATE_HOME: join(runtimeRoot, "state"),
      OPENCODE_CONFIG_DIR: configDirectory,
      OPENCODE_DB: join(runtimeRoot, "db", "opencode.db"),
      OPENCODE_DISABLE_MODELS_FETCH: "true",
      OPENCODE_DISABLE_FILEWATCHER: "true",
      OPENCODE_DISABLE_AUTOUPDATE: "true",
      OPENCODE_PASSWORD: password,
    }
    child = Bun.spawn(["opencode", "serve", "--stdio", "--port", "0"], {
      cwd: project,
      env: environment,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    })
    stderrDrain = new Response(child.stderr).text().then((text) => {
      stderr = text
    })

    const startupLine = await Promise.race([
      readFirstLine(child.stdout),
      sleep(30_000).then(() => {
        throw new Error("Timed out waiting for OpenCode server startup")
      }),
    ])
    const startup = Schema.decodeUnknownSync(Schema.fromJsonString(StartupResponse))(startupLine)
    const url = startup.url
    const request = async (method: "GET" | "POST" | "DELETE", path: string, body?: string): Promise<string> => {
      const headers = new Headers({ Authorization: `Basic ${btoa(`opencode:${password}`)}` })
      if (body !== undefined) headers.set("Content-Type", "application/json")
      const init: RequestInit = { method, headers }
      if (body !== undefined) init.body = body
      const response = await fetch(`${url}${path}`, init)
      const responseText = await response.text()
      lastResponse = responseText
      if (!response.ok) {
        throw new Error(`${method} ${path} failed (${response.status}): ${responseText}\nstderr:\n${stderr}`)
      }
      return responseText
    }

    const deadline = Date.now() + 30_000
    let plugin: typeof PluginResponse.Type["data"][number] | undefined
    while (plugin === undefined && Date.now() < deadline) {
      try {
        const decoded = Schema.decodeUnknownSync(Schema.fromJsonString(PluginResponse))(
          await request(
            "GET",
            `/api/plugin?location[directory]=${encodeURIComponent(project)}`,
          ),
        )
        plugin = decoded.data.find((entry) => entry.id === "shell-safety")
      } catch {
        await sleep(100)
      }
    }
    if (plugin === undefined) {
      throw new Error(`Timed out waiting for shell-safety plugin\nresponse:\n${lastResponse}\nstderr:\n${stderr}`)
    }
    if (plugin.source.type !== "local" || plugin.source.path === undefined) {
      throw new Error(`shell-safety plugin is not local\nresponse:\n${lastResponse}\nstderr:\n${stderr}`)
    }
    const [pluginPath, repositoryPath] = await Promise.all([
      realpath(plugin.source.path),
      realpath(join(repository, "src", "index.ts")),
    ])
    if (pluginPath !== repositoryPath) {
      throw new Error(
        `shell-safety plugin path mismatch: ${pluginPath} !== ${repositoryPath}\nresponse:\n${lastResponse}\nstderr:\n${stderr}`,
      )
    }
    ready = true
    return { project, homeDirectory: home, url, request, createProject, stop }
  })()

  return result.finally(async () => {
    if (!ready) await stop().catch(() => undefined)
  })
}
