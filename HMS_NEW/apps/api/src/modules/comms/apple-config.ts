import { z } from 'zod';

const Binding = z.strictObject({
  tenantId: z.uuid(),
  facilityId: z.uuid(),
  instanceArn: z
    .string()
    .regex(/^arn:aws:connect:([a-z0-9-]+):\d{12}:instance\/[a-f0-9-]{36}$/),
  topicArn: z.string().regex(/^arn:aws:sns:[a-z0-9-]+:\d{12}:[a-zA-Z0-9_-]+$/),
  queueUrl: z.url(),
  sessionTable: z.string().regex(/^[a-zA-Z0-9_.-]{3,255}$/),
  localDemo: z.boolean().optional(),
});
export type AppleBinding = z.infer<typeof Binding>;
export type AppleSettings = { bindings: AppleBinding[] };
export function loadAppleSettings(
  env: NodeJS.ProcessEnv = process.env,
): AppleSettings {
  if (env.APPLE_CONNECT_ENABLED !== 'true') return { bindings: [] };
  try {
    const bindings = z
      .array(Binding)
      .min(1)
      .max(100)
      .parse(JSON.parse(env.APPLE_CONNECT_BINDINGS_JSON ?? '[]'));
    for (const b of bindings) {
      if (b.localDemo && env.NODE_ENV === 'production') throw Error();
      const [, , , region, account] = b.instanceArn.split(':');
      const queue = new URL(b.queueUrl);
      if (
        !b.topicArn.startsWith(`arn:aws:sns:${region}:${account}:`) ||
        queue.origin !== `https://sqs.${region}.amazonaws.com` ||
        !queue.pathname.startsWith(`/${account}/`) ||
        queue.search ||
        queue.hash ||
        queue.username ||
        queue.password
      )
        throw Error();
    }
    for (const key of ['instanceArn', 'topicArn', 'queueUrl'] as const)
      if (new Set(bindings.map((b) => b[key])).size !== bindings.length)
        throw Error();
    if (
      new Set(bindings.map((b) => `${b.tenantId}:${b.facilityId}`)).size !==
      bindings.length
    )
      throw Error();
    return { bindings };
  } catch {
    throw Error(
      'Apple Connect configuration is invalid; check company-owned clinic and AWS bindings',
    );
  }
}
