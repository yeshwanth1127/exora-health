import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { tsImport } from 'tsx/esm/api';
import { fileURLToPath } from 'node:url';
import { AppleInboxSchema } from '@hms/contracts';
const { SupportConversation, ConversationComposer } = await tsImport(
  './arc-next-fixtures.ts',
  {
    parentURL: import.meta.url,
    tsconfig: fileURLToPath(new URL('../tsconfig.app.json', import.meta.url)),
  },
);
test('Apple conversation retains the reference surface without WhatsApp branding or invented messages', () => {
  const html = render(
    h(SupportConversation, {
      title: 'Appointment enquiry',
      subtitle: 'Needs reception',
      channelName: 'Apple Messages',
      variant: 'reference',
      messages: [],
      resolved: false,
      notice: 'Local demo · no Apple delivery',
      composer: h(ConversationComposer, {
        value: '',
        onChange: () => {},
        onSend: () => assert.fail('render cannot send'),
        suggestions: [],
        placeholder: 'Reply as reception…',
        disabled: true,
      }),
    }),
  );
  assert.ok(
    html.includes('Apple Messages conversation with Appointment enquiry'),
  );
  assert.ok(!html.includes('WhatsApp conversation'));
  assert.ok(!html.includes('Ava'));
  assert.ok(html.includes('disabled'));
  assert.ok(html.includes('no Apple delivery'));
});
test('Apple inbox response cannot substitute an unsupported provider delivery state', () => {
  assert.throws(() =>
    AppleInboxSchema.parse({
      configured: true,
      localDemo: false,
      items: [{ id: 'invalid', status: 'delivered' }],
    }),
  );
});
