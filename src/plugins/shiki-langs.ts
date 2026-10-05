/**
 * Small TextMate grammars for languages Shiki does not bundle. Their scopes follow Shiki's own `proto`
 * grammar (keyword.other for declarations, storage.modifier for field qualifiers, storage.type for
 * built-in types, entity.name.class for the declared name), so a Thrift or Avro IDL block highlights
 * the same way as the Protocol Buffers block next to it (see the token roles in shiki-trace.ts).
 * They cover the declaration syntax the posts quote, not the whole languages.
 */
import type { LanguageRegistration } from 'shiki';

const comments = [
  { name: 'comment.line.double-slash', match: '//.*$' },
  { name: 'comment.block', begin: '/\\*', end: '\\*/' },
];

const strings = [
  { name: 'string.quoted.double', begin: '"', end: '"', patterns: [{ name: 'constant.character.escape', match: '\\\\.' }] },
];

const numbers = { name: 'constant.numeric', match: '\\b-?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?\\b' };

/** Apache Thrift IDL: struct Person { 1: required string userName, ... } */
export const thrift: LanguageRegistration = {
  name: 'thrift',
  scopeName: 'source.thrift',
  repository: {},
  patterns: [
    ...comments,
    { name: 'comment.line.number-sign', match: '#.*$' },
    ...strings,
    { name: 'string.quoted.single', begin: "'", end: "'" },
    {
      match: '\\b(struct|union|exception|service|enum|senum)\\s+([A-Za-z_][\\w.]*)',
      captures: { 1: { name: 'keyword.other' }, 2: { name: 'entity.name.class' } },
    },
    { name: 'keyword.other', match: '\\b(?:namespace|include|cpp_include|typedef|const|extends|throws|oneway)\\b' },
    { name: 'storage.modifier', match: '\\b(?:required|optional)\\b' },
    { name: 'storage.type', match: '\\b(?:bool|byte|i8|i16|i32|i64|double|string|binary|uuid|list|set|map|void)\\b' },
    // field id: `1:`
    {
      match: '\\b(\\d+)\\s*(:)',
      captures: { 1: { name: 'constant.numeric' }, 2: { name: 'punctuation.separator' } },
    },
    numbers,
    { name: 'punctuation', match: '[{}()<>\\[\\],;:=]' },
  ],
};

/** Apache Avro IDL: record Person { union { null, long } favoriteNumber = null; ... } */
export const avdl: LanguageRegistration = {
  name: 'avdl',
  scopeName: 'source.avdl',
  repository: {},
  patterns: [
    ...comments,
    ...strings,
    // a default value: `= null`, `= true`, `= false`
    {
      match: '(=)\\s*(null|true|false)\\b',
      captures: { 1: { name: 'punctuation' }, 2: { name: 'constant.language' } },
    },
    {
      match: '\\b(protocol|record|error|enum|fixed)\\s+([A-Za-z_][\\w.]*)',
      captures: { 1: { name: 'keyword.other' }, 2: { name: 'entity.name.class' } },
    },
    { name: 'keyword.other', match: '\\b(?:import|idl|schema|throws|oneway)\\b' },
    {
      name: 'storage.type',
      match:
        '\\b(?:null|boolean|int|long|float|double|bytes|string|array|map|union|void|date|time_ms|timestamp_ms|local_timestamp_ms|decimal|uuid)\\b',
    },
    { name: 'meta.decorator', match: '@[A-Za-z_][\\w.-]*' },
    numbers,
    { name: 'punctuation', match: '[{}()<>\\[\\],;:=]' },
  ],
};
