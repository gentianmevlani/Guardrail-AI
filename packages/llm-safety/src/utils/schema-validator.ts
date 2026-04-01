import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export function validateAgainstSchema(data: unknown, schema: object): { ok: boolean; errors?: string[] } {
  const validate = ajv.compile(schema);
  if (validate(data)) return { ok: true };
  return {
    ok: false,
    errors: (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`),
  };
}
