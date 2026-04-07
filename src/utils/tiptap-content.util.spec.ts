/// <reference types="jest" />

jest.mock('lowlight', () => ({
  common: {},
  createLowlight: () => ({
    registerAlias: () => undefined,
    register: () => undefined,
    registered: () => true,
    listLanguages: () => [
      'plaintext',
      'javascript',
      'typescript',
      'python',
      'java',
      'cpp',
      'csharp',
      'json',
      'html',
      'css',
      'bash',
      'sql',
    ],
    highlight: () => ({
      type: 'root',
      children: [{ type: 'text', value: 'mock' }],
      data: { language: 'plaintext', relevance: 1 },
    }),
    highlightAuto: () => ({
      type: 'root',
      children: [{ type: 'text', value: 'mock' }],
      data: { language: 'plaintext', relevance: 1 },
    }),
  }),
}));

jest.mock('@tiptap/html/server', () => ({
  generateHTML: (content: unknown) => JSON.stringify(content),
}));

import { tiptapJsonToHtml } from './tiptap-content.util';

describe('tiptapJsonToHtml', () => {
  it('accepts supported open-source nodes and marks', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Robotics Club' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Highlighted',
              marks: [{ type: 'highlight' }],
            },
            {
              type: 'text',
              text: ' and underlined',
              marks: [{ type: 'underline' }],
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [{ type: 'text', text: 'Aligned center text' }],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [
            {
              type: 'text',
              text: 'const greet = (name: string) => `Hello ${name}`;',
            },
          ],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Task item' }],
                },
              ],
            },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Col 1' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Col 2' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'image',
          attrs: {
            src: 'https://example.com/demo.png',
            alt: 'Demo image',
          },
        },
        {
          type: 'youtube',
          attrs: {
            src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          },
        },
      ],
    };

    const html = tiptapJsonToHtml(content);

    expect(html).toContain('Robotics Club');
    expect(html).toContain('highlight');
    expect(html).toContain('underline');
    expect(html).toContain('typescript');
    expect(html).toContain('table');
    expect(html).toContain('taskList');
    expect(html).toContain('https://example.com/demo.png');
    expect(html).toContain('youtube');
  });

  it('supports configured code block languages', () => {
    const languages = [
      'plaintext',
      'javascript',
      'typescript',
      'python',
      'java',
      'cpp',
      'csharp',
      'json',
      'html',
      'css',
      'bash',
      'sql',
    ];

    for (const language of languages) {
      const html = tiptapJsonToHtml({
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language },
            content: [{ type: 'text', text: `// ${language}` }],
          },
        ],
      });

      expect(html).toContain(language);
    }
  });

  it('rejects raw video node', () => {
    expect(() =>
      tiptapJsonToHtml({
        type: 'doc',
        content: [
          { type: 'video', attrs: { src: 'https://example.com/video.mp4' } },
        ],
      }),
    ).toThrow('Raw video/audio/file nodes are not allowed');
  });

  it('rejects raw audio node', () => {
    expect(() =>
      tiptapJsonToHtml({
        type: 'doc',
        content: [
          { type: 'audio', attrs: { src: 'https://example.com/audio.mp3' } },
        ],
      }),
    ).toThrow('Raw video/audio/file nodes are not allowed');
  });

  it('rejects raw file node', () => {
    expect(() =>
      tiptapJsonToHtml({
        type: 'doc',
        content: [
          { type: 'file', attrs: { src: 'https://example.com/file.pdf' } },
        ],
      }),
    ).toThrow('Raw video/audio/file nodes are not allowed');
  });

  it('rejects base64 image sources', () => {
    expect(() =>
      tiptapJsonToHtml({
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: {
              src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA',
            },
          },
        ],
      }),
    ).toThrow('Base64 images are not allowed');
  });

  it('rejects invalid non-doc payloads', () => {
    expect(() => tiptapJsonToHtml({ type: 'paragraph', content: [] })).toThrow(
      'Tiptap content must be a JSON object with type "doc" and a content array.',
    );
  });
});
