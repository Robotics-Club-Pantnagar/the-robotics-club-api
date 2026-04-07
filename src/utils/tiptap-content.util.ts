import { JSONContent, type Extensions } from '@tiptap/core';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import Youtube from '@tiptap/extension-youtube';
import { generateHTML } from '@tiptap/html/server';
import StarterKit from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

lowlight.registerAlias({
  javascript: ['js'],
  typescript: ['ts'],
  csharp: ['cs', 'c#'],
  xml: ['html'],
  shell: ['bash', 'sh'],
});

const disallowedNodeTypes = new Set(['video', 'audio', 'file']);

const tiptapHtmlExtensions: Extensions = [
  StarterKit.configure({
    codeBlock: false,
    heading: {
      levels: [1, 2, 3, 4],
    },
  }),
  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: 'plaintext',
  }),
  TextStyle,
  Color,
  Highlight.configure({
    multicolor: true,
  }),
  Underline,
  Subscript,
  Superscript,
  Link.configure({
    autolink: true,
    openOnClick: false,
  }),
  Image.configure({
    allowBase64: false,
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
  Youtube.configure({
    nocookie: true,
    controls: true,
    modestBranding: true,
  }),
];

function isTiptapDocument(content: unknown): content is JSONContent {
  if (
    typeof content !== 'object' ||
    content === null ||
    Array.isArray(content)
  ) {
    return false;
  }

  const maybeDoc = content as Record<string, unknown>;
  return maybeDoc.type === 'doc' && Array.isArray(maybeDoc.content);
}

function assertAllowedMediaUsage(node: unknown): void {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return;
  }

  const nodeRecord = node as Record<string, unknown>;
  const nodeType = nodeRecord.type;

  if (typeof nodeType === 'string' && disallowedNodeTypes.has(nodeType)) {
    throw new Error(
      'Raw video/audio/file nodes are not allowed. Use embedded video nodes and uploaded image URLs.',
    );
  }

  if (nodeType === 'image') {
    const attrs = nodeRecord.attrs;
    if (typeof attrs === 'object' && attrs !== null && !Array.isArray(attrs)) {
      const src = (attrs as Record<string, unknown>).src;
      if (typeof src === 'string' && src.startsWith('data:')) {
        throw new Error(
          'Base64 images are not allowed. Upload images as files and use the returned Cloudinary URL.',
        );
      }
    }
  }

  const children = nodeRecord.content;
  if (Array.isArray(children)) {
    children.forEach((child) => assertAllowedMediaUsage(child));
  }
}

export function tiptapJsonToHtml(content: unknown): string {
  if (!isTiptapDocument(content)) {
    throw new Error(
      'Tiptap content must be a JSON object with type "doc" and a content array.',
    );
  }

  assertAllowedMediaUsage(content);

  return generateHTML(content, tiptapHtmlExtensions);
}
