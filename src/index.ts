import { Agent, Plugin } from "@opencode/plugin/effect"
import { homedir } from "node:os"
import { Cache, Config, Effect, Exit, Redacted, Schedule, Schema, String as EffectString } from "effect"

export type PermissionEffect = "allow" | "ask" | "deny"

export type PermissionEvent = {
  readonly sessionID: string
  readonly agent?: string
  readonly action: string
  readonly resources: ReadonlyArray<string>
  effect: PermissionEffect
  message?: string
}

type FilesystemPermissionRule = {
  readonly resource: string
  readonly effect: PermissionEffect
}

type ResolvedAgentDefinition = {
  readonly encoded: string
  readonly externalDirectoryRules: ReadonlyArray<FilesystemPermissionRule>
}

export type AgentDefinitionResolver = (agent: string) => Effect.Effect<ResolvedAgentDefinition | undefined>

export type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

const Probability = Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 1 }))

const ThresholdsSchema = Schema.Struct({
  allowProbability: Probability,
  violationProbability: Probability,
})

const FallbackEffectSchema = Schema.Literals(["ask", "deny"])

const HttpPolicySchema = Schema.Struct({
  methods: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  credentials: Schema.Record(Schema.String, Schema.Array(Schema.String))
    .pipe(Schema.withDecodingDefaultKey(Effect.succeed({}))),
})

const AgentPolicySchema = Schema.Struct({
  enabled: Schema.Boolean,
  fallback: Schema.optionalKey(FallbackEffectSchema),
  thresholds: Schema.optionalKey(ThresholdsSchema),
  http: HttpPolicySchema.pipe(Schema.withDecodingDefaultKey(Effect.succeed({ methods: [], credentials: {} }))),
})

const CacheOptionsSchema = Schema.Struct({
  capacity: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 10_000 }))
    .pipe(Schema.withDecodingDefaultKey(Effect.succeed(256))),
  ttlMs: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 86_400_000 }))
    .pipe(Schema.withDecodingDefaultKey(Effect.succeed(300_000))),
})

export const OptionsSchema = Schema.Struct({
  endpoint: Schema.String,
  model: Schema.String,
  integration: Schema.optionalKey(Schema.String),
  apiKeyEnv: Schema.optionalKey(Schema.String),
  allowProbability: Probability.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0.45))),
  violationProbability: Probability.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0.4))),
  timeoutMs: Schema.Int.check(Schema.isBetween({ minimum: 100, maximum: 60_000 }))
    .pipe(Schema.withDecodingDefaultKey(Effect.succeed(15_000))),
  maxAttempts: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 5 }))
    .pipe(Schema.withDecodingDefaultKey(Effect.succeed(2))),
  retryDelayMs: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 10_000 }))
    .pipe(Schema.withDecodingDefaultKey(Effect.succeed(250))),
  cache: CacheOptionsSchema.pipe(Schema.withDecodingDefaultKey(Effect.succeed({}))),
  agents: Schema.Record(Schema.String, AgentPolicySchema),
}).check(Schema.makeFilter((options) =>
  options.integration || options.apiKeyEnv
    ? undefined
    : { path: ["apiKeyEnv"], issue: "integration or apiKeyEnv is required" }
))

export type Options = typeof OptionsSchema.Type
export type AgentPolicy = typeof AgentPolicySchema.Type
export type FallbackEffect = typeof FallbackEffectSchema.Type
export type Thresholds = typeof ThresholdsSchema.Type

const NoulAnswerSchema = Schema.Struct({
  type: Schema.Literal("noul"),
  noul: Probability,
})

const JevResponseSchema = Schema.Struct({
  answers: Schema.Struct({
    withinPolicy: NoulAnswerSchema,
    filesystemViolation: NoulAnswerSchema,
    remoteMutation: NoulAnswerSchema,
    credentialViolation: NoulAnswerSchema,
  }),
})
const JevResponseJsonSchema = Schema.fromJsonString(JevResponseSchema)

export type SafetyAssessment = typeof JevResponseSchema.Type["answers"]

class JevNetworkError extends Schema.TaggedError<JevNetworkError>()("JevNetworkError", {
  message: Schema.String,
}) {}

class JevHttpError extends Schema.TaggedError<JevHttpError>()("JevHttpError", {
  status: Schema.Number,
}) {}

class JevTimeoutError extends Schema.TaggedError<JevTimeoutError>()("JevTimeoutError", {
  timeoutMs: Schema.Number,
}) {}

class JevDecodeError extends Schema.TaggedError<JevDecodeError>()("JevDecodeError", {
  message: Schema.String,
}) {}

type JevRequestError = JevNetworkError | JevHttpError | JevTimeoutError | JevDecodeError

type ClassificationResult =
  | { readonly ok: true; readonly assessment: SafetyAssessment }
  | { readonly ok: false; readonly error: JevRequestError }

type NoulQuestion = {
  readonly type: "noul"
  readonly instructions: string
  readonly criteria: {
    readonly true: string
    readonly false: string
  }
}

type SystemOneRequest = {
  readonly model: string
  readonly state: {
    readonly agent: string
    readonly action: string
    readonly projectDirectory: string
    readonly shellCommand: ReadonlyArray<string>
    readonly agentDefinition: string
    readonly filesystemAccess: {
      readonly projectDirectory: string
      readonly homeDirectory: string
      readonly externalDirectoryRules: ReadonlyArray<FilesystemPermissionRule>
    }
    readonly policy: AgentPolicy
  }
  readonly questions: {
    readonly withinPolicy: NoulQuestion
    readonly filesystemViolation: NoulQuestion
    readonly remoteMutation: NoulQuestion
    readonly credentialViolation: NoulQuestion
  }
}

const OptionsJsonSchema = Schema.fromJsonString(OptionsSchema)
const AgentJsonSchema = Schema.fromJsonString(Agent.Info)

export const decodeOptions = (input: string) => Schema.decodeUnknownEffect(OptionsJsonSchema)(input)

export const encodeAgentDefinition = (agent: Agent.Info): string => Schema.encodeSync(AgentJsonSchema)(agent)

export const resolveAgentDefinition = (agent: Agent.Info): ResolvedAgentDefinition => ({
  encoded: encodeAgentDefinition(agent),
  externalDirectoryRules: agent.permissions
    .filter((rule) => rule.action === "external_directory")
    .map((rule) => ({ resource: rule.resource, effect: rule.effect })),
})

export type ClassificationVerdict = "allow" | "deny"

export const permissionFromAssessment = (
  assessment: SafetyAssessment,
  thresholds: Thresholds,
): ClassificationVerdict => {
  const hasViolation =
    assessment.filesystemViolation.noul >= thresholds.violationProbability ||
    assessment.remoteMutation.noul >= thresholds.violationProbability ||
    assessment.credentialViolation.noul >= thresholds.violationProbability
  return assessment.withinPolicy.noul >= thresholds.allowProbability && !hasViolation ? "allow" : "deny"
}

export const fallbackEffect = (fallback: FallbackEffect | undefined): PermissionEffect => fallback ?? "deny"

const noulQuestion = (instructions: string, yes: string, no: string): NoulQuestion => ({
  type: "noul",
  instructions: [
    questionPrompt(`
      |Read "state.agentDefinition" as JSON. Its "system" field is the agent's full system prompt; its other fields are the complete resolved agent configuration.
      |
      |"state.policy.http" contains the agent's configured HTTP permissions.
      |Evaluate "state.shellCommand" against the supplied agent's role, instructions, and permissions.
      |Apply ordered permission rules with the last matching rule winning. "ask" requests this classification.
      |"state.filesystemAccess" provides the project directory, home directory, and external-directory permissions for resolving paths and working-directory changes.
    `),
    instructions,
  ].join("\n\n"),
  criteria: { true: yes, false: no },
})

const questionPrompt = (value: string): string => EffectString.stripMargin(value).trim()

const responseBody = (response: Response): Effect.Effect<string, JevNetworkError | JevHttpError> => {
  if (!response.ok) return Effect.fail(new JevHttpError({ status: response.status }))
  return Effect.tryPromise({
    try: () => response.text(),
    catch: () => new JevNetworkError({ message: "response body read failed" }),
  })
}

export const buildRequest = (
  event: PermissionEvent & { readonly agent: string },
  model: string,
  policy: AgentPolicy,
  agentDefinition: ResolvedAgentDefinition,
  projectDirectory: string,
  homeDirectory: string,
): SystemOneRequest => ({
  model,
  state: {
    agent: event.agent,
    action: event.action,
    projectDirectory,
    shellCommand: event.resources,
    agentDefinition: agentDefinition.encoded,
    filesystemAccess: {
      projectDirectory,
      homeDirectory,
      externalDirectoryRules: agentDefinition.externalDirectoryRules,
    },
    policy,
  },
  questions: {
    withinPolicy: noulQuestion(
      "Does the command comply with the supplied agent's role, instructions, and permissions?",
      "The command complies with the supplied agent's role, instructions, and permissions.",
      "The command violates the supplied agent's role, instructions, or permissions.",
    ),
    filesystemViolation: noulQuestion(
      "Do the command's filesystem effects violate the supplied agent's instructions or permissions?",
      "The command's filesystem effects violate the supplied agent's instructions or permissions.",
      "The command's filesystem effects comply with the supplied agent's instructions and permissions.",
    ),
    remoteMutation: noulQuestion(
      "Do the command's remote effects violate the supplied agent's instructions or permissions?",
      "The command's remote effects violate the supplied agent's instructions or permissions.",
      "The command's remote effects comply with the supplied agent's instructions and permissions.",
    ),
    credentialViolation: noulQuestion(
      "Does the command's credential handling violate the supplied agent's instructions or permissions?",
      "The command's credential handling violates the supplied agent's instructions or permissions.",
      "The command's credential handling complies with the supplied agent's instructions and permissions.",
    ),
  },
})

const requestAssessment = (
  fetch: Fetch,
  options: Options,
  requestBody: string,
  apiKey: string,
): Effect.Effect<SafetyAssessment, JevRequestError> => {
  const attempt = Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: (signal) =>
        fetch(options.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          redirect: "error",
          body: requestBody,
          signal,
        }),
      catch: () => new JevNetworkError({ message: "network request failed" }),
    })
    const responseText = yield* responseBody(response)
    const decoded = yield* Schema.decodeUnknownEffect(JevResponseJsonSchema)(responseText).pipe(
      Effect.mapError((cause) => new JevDecodeError({ message: cause.message })),
    )
    return decoded.answers
  }).pipe(
    Effect.timeoutOrElse({
      duration: `${options.timeoutMs} millis`,
      orElse: () => Effect.fail(new JevTimeoutError({ timeoutMs: options.timeoutMs })),
    }),
  )

  return attempt.pipe(
    Effect.retry({
      while: isRetryable,
      times: options.maxAttempts - 1,
      schedule: Schedule.spaced(`${options.retryDelayMs} millis`),
    }),
  )
}

const isRetryable = (error: JevRequestError): boolean => {
  switch (error._tag) {
    case "JevNetworkError":
    case "JevTimeoutError":
      return true
    case "JevHttpError":
      return error.status === 429 || error.status >= 500
    case "JevDecodeError":
      return false
  }
}

const environmentApiKey = (name: string) => Effect.gen(function* () {
  const apiKey = yield* Config.redacted(name)
  return Redacted.value(apiKey)
}).pipe(Effect.catch(() => Effect.succeed(undefined)))

const credentialApiKey = (ctx: Plugin.Context, integration: string) =>
  Effect.gen(function* () {
    const connection = yield* ctx.integration.connection.active(integration)
    if (!connection) return undefined
    const credential = yield* ctx.integration.connection.resolve(connection)
    if (credential?.type === "key") return credential.key
    if (credential?.type === "oauth") return credential.access
    return undefined
  }).pipe(Effect.catch(() => Effect.succeed(undefined)))

export const resolveApiKey = (
  options: Pick<Options, "integration" | "apiKeyEnv">,
  integrationKey: (integration: string) => Effect.Effect<string | undefined>,
  environmentKey: (name: string) => Effect.Effect<string | undefined>,
): Effect.Effect<string | undefined> =>
  Effect.gen(function* () {
    if (options.integration) {
      const key = yield* integrationKey(options.integration)
      if (key) return key
    }
    return options.apiKeyEnv ? yield* environmentKey(options.apiKeyEnv) : undefined
  })

const agentDefinitionResolver = (ctx: Plugin.Context): AgentDefinitionResolver =>
  (agent) =>
    Effect.gen(function* () {
      const result = yield* ctx.agent.get({ agentID: Agent.ID.make(agent) })
      return resolveAgentDefinition(result.data)
    }).pipe(Effect.catch(() => Effect.succeed(undefined)))

const findPolicy = (options: Options, agent: string): AgentPolicy | undefined => {
  const target = agent.toLowerCase()
  return Object.entries(options.agents).find(([name]) => name.toLowerCase() === target)?.[1]
}

const hasShellControlSyntax = (resources: ReadonlyArray<string>): boolean =>
  resources.some((resource) => /[;&|<>`$]/.test(resource))

const summary = (assessment: SafetyAssessment, verdict: ClassificationVerdict, effect: PermissionEffect): string => {
  const classification =
    `Jev shell classification: ${verdict} (` +
    `withinPolicy=${assessment.withinPolicy.noul.toFixed(3)}, ` +
    `filesystemViolation=${assessment.filesystemViolation.noul.toFixed(3)}, ` +
    `remoteMutation=${assessment.remoteMutation.noul.toFixed(3)}, ` +
    `credentialViolation=${assessment.credentialViolation.noul.toFixed(3)})`
  if (verdict === "allow") return classification
  return effect === "deny"
    ? `${classification}. Rewrite the command to comply with your system prompt and permissions, or report the limitation if no compliant form exists.`
    : `${classification}. Jev rejected this command.`
}

const classificationSucceeded = (assessment: SafetyAssessment): ClassificationResult => ({ ok: true, assessment })

const classificationFailed = (error: JevRequestError): ClassificationResult => ({ ok: false, error })

const requestFailure = (error: JevRequestError, options: Options): string => {
  const attempts = isRetryable(error) ? options.maxAttempts : 1
  const suffix = ` after ${attempts} ${attempts === 1 ? "attempt" : "attempts"}`
  switch (error._tag) {
    case "JevNetworkError":
      return `${error.message}${suffix}`
    case "JevHttpError":
      return `HTTP ${error.status}${suffix}`
    case "JevTimeoutError":
      return `timeout after ${error.timeoutMs} ms${suffix}`
    case "JevDecodeError":
      return `malformed response${suffix}: ${error.message}`
  }
}

export const createPermissionEvaluator = (
  fetch: Fetch,
  options: Options,
  resolveKey: Effect.Effect<string | undefined>,
  resolveAgentDefinition: AgentDefinitionResolver,
  homeDirectory: string = homedir(),
) =>
  Effect.gen(function* () {
    const apiKey = yield* resolveKey
    const assessmentCache = apiKey
      ? yield* Cache.makeWith(
          (requestBody: string) => requestAssessment(fetch, options, requestBody, apiKey),
          {
            capacity: options.cache.capacity,
            timeToLive: (exit) => (Exit.isSuccess(exit) ? `${options.cache.ttlMs} millis` : 0),
          },
        )
      : undefined

    return (event: PermissionEvent, projectDirectory?: string): Effect.Effect<void> => {
      const agent = event.agent
      if (event.action !== "shell" || !agent || event.effect === "deny") return Effect.void
      if (event.effect === "allow" && !hasShellControlSyntax(event.resources)) return Effect.void
      const policy = findPolicy(options, agent)
      if (!policy?.enabled) return Effect.void
      const classifiedEvent = { ...event, agent }
      const fallback = fallbackEffect(policy.fallback)

      return Effect.gen(function* () {
        if (!projectDirectory) {
          event.effect = fallback
          event.message = "Jev could not classify this command because the session directory is unavailable."
          return
        }
        if (!assessmentCache) {
          event.effect = fallback
          event.message = "Jev could not classify this command because no OpenCode Zen credential is available."
          return
        }
        const agentDefinition = yield* resolveAgentDefinition(agent)
        if (!agentDefinition) {
          event.effect = fallback
          event.message = `Jev could not classify this command because the resolved ${agent} definition is unavailable.`
          return
        }
        const requestBody = JSON.stringify(
          buildRequest(classifiedEvent, options.model, policy, agentDefinition, projectDirectory, homeDirectory),
        )

        const result = yield* Cache.get(assessmentCache, requestBody).pipe(
          Effect.map(classificationSucceeded),
          Effect.catch((error) => Effect.succeed(classificationFailed(error))),
        )
        if (!result.ok) {
          event.effect = fallback
          event.message = `Jev could not classify this command (${requestFailure(result.error, options)}).`
          return
        }

        const verdict = permissionFromAssessment(result.assessment, policy.thresholds ?? options)
        event.effect = verdict === "allow" ? "allow" : fallback
        event.message = summary(result.assessment, verdict, event.effect)
      })
    }
  })

export const createPlugin = (fetch: Fetch = globalThis.fetch) =>
  Plugin.define({
    id: "shell-safety",
    effect: (ctx) =>
      Effect.gen(function* () {
        const options = yield* decodeOptions(JSON.stringify(ctx.options)).pipe(Effect.orDie)
        const evaluate = yield* createPermissionEvaluator(
          fetch,
          options,
          resolveApiKey(options, (integration) => credentialApiKey(ctx, integration), environmentApiKey),
          agentDefinitionResolver(ctx),
        )
        yield* ctx.permission.hook("evaluate", (event) =>
          Effect.gen(function* () {
            const session = yield* ctx.session
              .get({ sessionID: event.sessionID })
              .pipe(Effect.catch(() => Effect.succeed(undefined)))
            yield* evaluate(event, session?.location.directory)
          }),
        )
      }),
  })

export default createPlugin()
