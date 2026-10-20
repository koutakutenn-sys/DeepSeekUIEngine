import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { payloadSchema } from '../src/protocol.ts';

const schema = z.toJSONSchema(payloadSchema);
schema.$id = 'urn:dsui:protocol:v1';
schema.description = 'DSUI v1. Runtime additionally checks globally unique block IDs, at most 12 total blocks and 3 function plots, unique column/series keys, exact row/column or row/series agreement, unique panel item IDs and valid initial selections, quadratic a/b/c or unique declared expression parameters, bounded whitelisted mathematical ASTs, slider value/range relationships and bounded viewport spans. Containers accept leaf blocks only.';
await writeFile('dist/dsui.schema.json', JSON.stringify(schema, null, 2) + '\n');
