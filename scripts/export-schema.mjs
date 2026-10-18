import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { payloadSchema } from '../src/protocol.ts';

const schema = z.toJSONSchema(payloadSchema);
schema.$id = 'urn:dsui:protocol:v1';
schema.description = 'DSUI v1. Runtime additionally checks unique block IDs, unique column keys and row/column agreement.';
await writeFile('dist/dsui.schema.json', JSON.stringify(schema, null, 2) + '\n');
