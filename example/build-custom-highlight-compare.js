import fs from 'fs'
import path from 'path'
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import highlightjs from 'highlight.js'
import { createHighlighter } from 'shiki'

import mditRendererFence, { renderCustomHighlightPayloadScript } from '../index.js'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const isWindows = process.platform === 'win32'
const baseDir = isWindows ? __dirname.replace(/^\/+/, '').replace(/\//g, '\\') : __dirname

const toCode = (lines) => lines.join('\n') + '\n'

const samples = [
  {
    id: 'javascript',
    title: 'JavaScript',
    lang: 'javascript',
    code: toCode([
      'const list = [1, 2, 3]',
      'const total = list.reduce((acc, n) => acc + n, 0)',
      'class Greeter {',
      '  constructor(name) { this.name = name }',
      '  hello(user) { return `hello ${user}` }',
      '}',
      'const greeter = new Greeter("cat")',
      'for (const n of list) console.log(n)',
      'if (total > 3) console.log(greeter.hello("you"))',
      'export { total }',
    ]),
  },
  {
    id: 'typescript',
    title: 'TypeScript',
    lang: 'typescript',
    code: toCode([
      'type ID = string | number',
      'interface User { id: ID; name: string }',
      'const users: User[] = [{ id: 1, name: "cat" }]',
      'function findName(input: ID): string {',
      '  const found = users.find((u) => u.id === input)',
      '  return found?.name ?? "unknown"',
      '}',
      'const value: ID = 1',
      'console.log(findName(value))',
      'export type { User }',
    ]),
  },
  {
    id: 'python',
    title: 'Python',
    lang: 'python',
    code: toCode([
      'from dataclasses import dataclass',
      '',
      '@dataclass',
      'class User:',
      '    name: str',
      '    age: int',
      '',
      'user = User("cat", 3)',
      'if user.age > 2:',
      '    print(f"{user.name}:{user.age}")',
    ]),
  },
  {
    id: 'bash',
    title: 'Shell',
    lang: 'bash',
    code: toCode([
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'name="${1:-world}"',
      'items=("a" "b" "c")',
      'for it in "${items[@]}"; do',
      '  echo "$it-$name"',
      'done',
      'if [[ -n "$name" ]]; then',
      '  printf "done: %s\\n" "$name"',
      'fi',
    ]),
  },
  {
    id: 'json',
    title: 'JSON',
    lang: 'json',
    code: toCode([
      '{',
      '  "name": "cat",',
      '  "active": true,',
      '  "age": 3,',
      '  "tags": ["a", "b"],',
      '  "meta": {',
      '    "score": 42,',
      '    "flag": null',
      '  }',
      '}',
    ]),
  },
  {
    id: 'html',
    title: 'HTML',
    lang: 'html',
    code: toCode([
      '<!doctype html>',
      '<html lang="en">',
      '<head><meta charset="utf-8"><title>Demo</title></head>',
      '<body>',
      '  <main class="app" data-id="1">',
      '    <h1>Hello</h1>',
      '    <p><a href="/docs">Docs</a></p>',
      '  </main>',
      '</body>',
      '</html>',
    ]),
  },
  {
    id: 'css',
    title: 'CSS',
    lang: 'css',
    code: toCode([
      ':root { --brand: #3366ff; }',
      '.card {',
      '  display: grid;',
      '  gap: 8px;',
      '  color: var(--brand);',
      '  margin: 12px;',
      '}',
      '@media (min-width: 800px) {',
      '  .card { grid-template-columns: 1fr 1fr; }',
      '}',
    ]),
  },
  {
    id: 'yaml',
    title: 'YAML',
    lang: 'yaml',
    code: toCode([
      'name: app',
      'version: 1',
      'enabled: true',
      'ports:',
      '  - 3000',
      '  - 3001',
      'service:',
      '  host: localhost',
      '  secure: false',
      '  token: "abc"',
    ]),
  },
  {
    id: 'sql',
    title: 'SQL',
    lang: 'sql',
    code: toCode([
      'WITH active_users AS (',
      '  SELECT id, name, age',
      '  FROM users',
      '  WHERE active = true',
      ')',
      'SELECT id, name',
      'FROM active_users',
      'WHERE age >= 18',
      'ORDER BY id DESC',
      'LIMIT 10;',
    ]),
  },
  {
    id: 'go',
    title: 'Go',
    lang: 'go',
    code: toCode([
      'package main',
      'import "fmt"',
      'func add(a int, b int) int {',
      '  return a + b',
      '}',
      'func main() {',
      '  nums := []int{1, 2, 3}',
      '  fmt.Println(nums, add(1, 2))',
      '  if len(nums) > 0 { fmt.Println("ok") }',
      '}',
    ]),
  },
  {
    id: 'rust',
    title: 'Rust',
    lang: 'rust',
    code: toCode([
      'fn add(a: i32, b: i32) -> i32 {',
      '    a + b',
      '}',
      '',
      'fn main() {',
      '    let nums = vec![1, 2, 3];',
      '    for n in &nums { println!("{}", n); }',
      '    let total = add(1, 2);',
      '    if total > 2 { println!("ok"); }',
      '}',
    ]),
  },
  {
    id: 'java',
    title: 'Java',
    lang: 'java',
    code: toCode([
      'class App {',
      '  static int add(int a, int b) {',
      '    return a + b;',
      '  }',
      '  public static void main(String[] args) {',
      '    int[] nums = {1, 2, 3};',
      '    for (int n : nums) System.out.println(n);',
      '    if (add(1, 2) > 2) System.out.println("ok");',
      '  }',
      '}',
    ]),
  },
  {
    id: 'csharp',
    title: 'C#',
    lang: 'csharp',
    code: toCode([
      'using System;',
      'public class App {',
      '  public static int Add(int a, int b) { return a + b; }',
      '  public static void Main() {',
      '    var nums = new int[] { 1, 2, 3 };',
      '    foreach (var n in nums) Console.WriteLine(n);',
      '    if (Add(1, 2) > 2) Console.WriteLine("ok");',
      '  }',
      '}',
    ]),
  },
  {
    id: 'php',
    title: 'PHP',
    lang: 'php',
    code: toCode([
      '<?php',
      'class User {',
      '  public function __construct(private string $name) {}',
      '  public function hello(string $to): string {',
      '    return $this->name . ":" . $to;',
      '  }',
      '}',
      '$u = new User("cat");',
      'echo $u->hello("you");',
    ]),
  },
  {
    id: 'cpp',
    title: 'C++',
    lang: 'cpp',
    code: toCode([
      '#include <iostream>',
      '#include <vector>',
      'int add(int a, int b) { return a + b; }',
      'int main() {',
      '  std::vector<int> nums = {1, 2, 3};',
      '  for (int n : nums) std::cout << n << "\\n";',
      '  if (add(1, 2) > 2) std::cout << "ok\\n";',
      '  return 0;',
      '}',
    ]),
  },
  {
    id: 'c',
    title: 'C',
    lang: 'c',
    code: toCode([
      '#include <stdio.h>',
      'static int add(int a, int b) { return a + b; }',
      'int main(void) {',
      '  int nums[3] = {1, 2, 3};',
      '  for (int i = 0; i < 3; i++) printf("%d\\n", nums[i]);',
      '  if (add(1, 2) > 2) printf("ok\\n");',
      '  return 0;',
      '}',
    ]),
  },
  {
    id: 'hcl',
    title: 'HCL',
    lang: 'hcl',
    code: toCode([
      'terraform {',
      '  required_version = ">= 1.6.0"',
      '}',
      '',
      'variable "name" {',
      '  type    = string',
      '  default = "cat"',
      '}',
      '',
      'resource "null_resource" "demo" {',
      '  count = 2',
      '}',
    ]),
  },
  {
    id: 'ruby',
    title: 'Ruby',
    lang: 'ruby',
    code: toCode([
      'class User',
      '  def initialize(name, age)',
      '    @name = name',
      '    @age = age',
      '  end',
      '  def hello(to)',
      '    "#{@name}:#{to}:#{@age}"',
      '  end',
      'end',
      'puts User.new("cat", 3).hello("you")',
    ]),
  },
]

const complexCodeById = {
  javascript: toCode([
    'const cache = new Map([["a", 1], ["b", 2]])',
    'function formatUser(user = { name: "cat", tags: ["x", "y"] }) {',
    '  const tags = user.tags?.join(",") ?? "none"',
    '  return `${user.name}:${tags}`',
    '}',
    'async function run(input) {',
    '  try {',
    '    const value = cache.get(input) ?? 0',
    '    const next = await Promise.resolve(value + 1)',
    '    return { ok: true, next, text: formatUser() }',
    '  } catch (err) {',
    '    console.error(err?.message ?? "unknown")',
    '    return { ok: false, next: -1 }',
    '  }',
    '}',
    'run("a").then((r) => console.log(r.next, r.text))',
  ]),
  typescript: toCode([
    'type Ok<T> = { ok: true; value: T }',
    'type Err = { ok: false; error: string }',
    'type Result<T> = Ok<T> | Err',
    'interface User { id: number; name: string; roles: string[] }',
    'const users: Record<number, User> = { 1: { id: 1, name: "cat", roles: ["admin"] } }',
    'function findUser(id: number): Result<User> {',
    '  const user = users[id]',
    '  return user ? { ok: true, value: user } : { ok: false, error: "not-found" }',
    '}',
    'function roleCount<T extends { roles: string[] }>(item: T): number { return item.roles.length }',
    'const found = findUser(1)',
    'if (found.ok) console.log(found.value.name, roleCount(found.value))',
    'else console.error(found.error)',
  ]),
  python: toCode([
    'from dataclasses import dataclass',
    'from typing import Iterable',
    '',
    '@dataclass',
    'class User:',
    '    name: str',
    '    score: int',
    '',
    'def normalize(values: Iterable[int]) -> list[int]:',
    '    base = sum(values) or 1',
    '    return [round(v * 100 / base) for v in values]',
    '',
    'users = [User("cat", 30), User("dog", 70)]',
    'scores = normalize([u.score for u in users])',
    'for u, s in zip(users, scores):',
    '    print(f"{u.name}:{s}")',
  ]),
  bash: toCode([
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'name="${1:-world}"',
    'items=("a" "b" "c")',
    'join_by() { local IFS="$1"; shift; echo "$*"; }',
    'for it in "${items[@]}"; do',
    '  printf "%s:%s\\n" "$it" "$name"',
    'done',
    'if [[ -n "${name}" && "${#items[@]}" -gt 0 ]]; then',
    '  merged="$(join_by , "${items[@]}")"',
    '  echo "merged=${merged}"',
    'fi',
    'case "${name}" in',
    '  cat|dog) echo "pet:${name}" ;;',
    '  *) echo "other:${name}" ;;',
    'esac',
  ]),
  json: toCode([
    '{',
    '  "name": "matrix",',
    '  "enabled": true,',
    '  "version": 2,',
    '  "limits": { "min": 1, "max": 10 },',
    '  "items": [',
    '    { "id": 1, "tags": ["a", "b"], "meta": { "score": 0.7 } },',
    '    { "id": 2, "tags": ["c"], "meta": { "score": 0.9 } }',
    '  ],',
    '  "flags": { "dryRun": false, "verbose": null }',
    '}',
  ]),
  html: toCode([
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>Matrix</title>',
    '</head>',
    '<body>',
    '  <main id="app" data-mode="demo">',
    '    <section class="card"><h1>Hello</h1><p><a href="/docs">Docs</a></p></section>',
    '    <script type="module">const a = 1; console.log(a)</script>',
    '  </main>',
    '</body>',
    '</html>',
  ]),
  css: toCode([
    ':root { --brand: #3366ff; --gap: 12px; }',
    '.grid {',
    '  display: grid;',
    '  grid-template-columns: repeat(3, minmax(0, 1fr));',
    '  gap: var(--gap);',
    '}',
    '.card {',
    '  border: 1px solid color-mix(in oklab, var(--brand), white 70%);',
    '  padding: clamp(8px, 2vw, 16px);',
    '}',
    '@media (max-width: 900px) {',
    '  .grid { grid-template-columns: 1fr 1fr; }',
    '}',
    '@supports (container-type: inline-size) {',
    '  .card { container-type: inline-size; }',
    '}',
  ]),
  yaml: toCode([
    'name: matrix',
    'version: 3',
    'enabled: true',
    'defaults: &defaults',
    '  retries: 2',
    '  timeout: 30',
    'services:',
    '  api:',
    '    <<: *defaults',
    '    host: localhost',
    '    ports: [3000, 3001]',
    '  worker:',
    '    <<: *defaults',
    '    queue: jobs',
  ]),
  sql: toCode([
    'WITH ranked AS (',
    '  SELECT',
    '    u.id,',
    '    u.name,',
    '    u.age,',
    '    ROW_NUMBER() OVER (PARTITION BY u.group_id ORDER BY u.age DESC) AS rn',
    '  FROM users u',
    '  WHERE u.active = true',
    ')',
    'SELECT id, name, age',
    'FROM ranked',
    'WHERE rn <= 3 AND age >= 18',
    'ORDER BY age DESC, id ASC;',
  ]),
  go: toCode([
    'package main',
    '',
    'import (',
    '  "fmt"',
    '  "sort"',
    ')',
    '',
    'type User struct { Name string; Score int }',
    '',
    'func main() {',
    '  users := []User{{"cat", 30}, {"dog", 10}, {"fox", 20}}',
    '  sort.Slice(users, func(i, j int) bool { return users[i].Score > users[j].Score })',
    '  for _, u := range users { fmt.Println(u.Name, u.Score) }',
    '}',
  ]),
  rust: toCode([
    'use std::collections::HashMap;',
    '',
    'fn build_scores() -> HashMap<&\'static str, i32> {',
    '    let mut m = HashMap::new();',
    '    m.insert("cat", 10);',
    '    m.insert("dog", 20);',
    '    m',
    '}',
    '',
    'fn main() {',
    '    let scores = build_scores();',
    '    let total: i32 = scores.values().sum();',
    '    for (name, score) in scores.iter() { println!("{}:{}", name, score); }',
    '    if total > 20 { println!("ok"); }',
    '}',
  ]),
  java: toCode([
    'import java.util.*;',
    '',
    'class App {',
    '  record User(String name, int score) {}',
    '',
    '  public static void main(String[] args) {',
    '    List<User> users = List.of(new User("cat", 30), new User("dog", 20), new User("fox", 10));',
    '    int total = users.stream().mapToInt(User::score).sum();',
    '    users.stream()',
    '      .sorted(Comparator.comparingInt(User::score).reversed())',
    '      .forEach(u -> System.out.println(u.name() + ":" + u.score()));',
    '    if (total > 0) System.out.println("total=" + total);',
    '  }',
    '}',
  ]),
  csharp: toCode([
    'using System;',
    'using System.Linq;',
    'using System.Collections.Generic;',
    '',
    'public record User(string Name, int Score);',
    '',
    'public class App {',
    '  public static void Main() {',
    '    var users = new List<User> { new("cat", 30), new("dog", 10), new("fox", 20) };',
    '    var top = users.OrderByDescending(u => u.Score).Take(2).ToArray();',
    '    foreach (var u in top) Console.WriteLine($"{u.Name}:{u.Score}");',
    '    var sum = users.Sum(u => u.Score);',
    '    Console.WriteLine(sum > 0 ? "ok" : "ng");',
    '  }',
    '}',
  ]),
  php: toCode([
    '<?php',
    'declare(strict_types=1);',
    '',
    'final class User {',
    '    public function __construct(public string $name, public int $score) {}',
    '}',
    '',
    '$users = [new User("cat", 30), new User("dog", 20), new User("fox", 10)];',
    'usort($users, fn(User $a, User $b): int => $b->score <=> $a->score);',
    '$top = array_slice($users, 0, 2);',
    'foreach ($top as $u) {',
    '    echo $u->name . ":" . $u->score . PHP_EOL;',
    '}',
  ]),
  cpp: toCode([
    '#include <algorithm>',
    '#include <iostream>',
    '#include <string>',
    '#include <vector>',
    '',
    'struct User { std::string name; int score; };',
    '',
    'int main() {',
    '  std::vector<User> users{{"cat", 30}, {"dog", 10}, {"fox", 20}};',
    '  std::sort(users.begin(), users.end(), [](const User& a, const User& b) { return a.score > b.score; });',
    '  for (const auto& u : users) std::cout << u.name << ":" << u.score << "\\n";',
    '  return 0;',
    '}',
  ]),
  c: toCode([
    '#include <stdio.h>',
    '',
    'typedef struct {',
    '  const char *name;',
    '  int score;',
    '} User;',
    '',
    'int main(void) {',
    '  User users[] = {{"cat", 30}, {"dog", 10}, {"fox", 20}};',
    '  int n = (int)(sizeof(users) / sizeof(users[0]));',
    '  for (int i = 0; i < n; i++) {',
    '    printf("%s:%d\\n", users[i].name, users[i].score);',
    '  }',
    '  return 0;',
    '}',
  ]),
  hcl: toCode([
    'terraform {',
    '  required_version = ">= 1.6.0"',
    '}',
    '',
    'variable "region" {',
    '  type    = string',
    '  default = "ap-northeast-1"',
    '}',
    '',
    'locals {',
    '  tags = { env = "dev", owner = "cat" }',
    '}',
    '',
    'resource "null_resource" "example" {',
    '  count = 2',
    '  triggers = { region = var.region }',
    '}',
  ]),
  ruby: toCode([
    'class User',
    '  attr_reader :name, :score',
    '  def initialize(name, score)',
    '    @name = name',
    '    @score = score',
    '  end',
    'end',
    '',
    'users = [User.new("cat", 30), User.new("dog", 10), User.new("fox", 20)]',
    'users.sort_by { |u| -u.score }.each do |u|',
    '  puts "#{u.name}:#{u.score}"',
    'end',
  ]),
}

for (const sample of samples) {
  sample.complexCode = complexCodeById[sample.id] || sample.code
}

const langs = samples.map((item) => item.lang)
const shikiHighlighter = await createHighlighter({
  themes: ['github-light'],
  langs,
})

const hljsGithubCssPath = path.join(baseDir, '..', 'node_modules', 'highlight.js', 'styles', 'github.css')
const hljsGithubCss = fs.readFileSync(hljsGithubCssPath, 'utf-8')

const themePalette = {
  text: '#24292e',
  keyword: '#d73a49',
  title: '#6f42c1',
  constant: '#005cc5',
  string: '#032f62',
  builtIn: '#e36209',
  comment: '#6a737d',
  tag: '#22863a',
}

const normalizeColor = (value, fallback) => {
  const color = String(value || '').trim().toLowerCase()
  if (!color) return fallback
  return color
}

const highlightNameUnsafeReg = /[^A-Za-z0-9_-]+/g
const hyphenMultiReg = /-+/g
const hljsScopeSelectorReg = /\.([A-Za-z0-9_-]+)/g
const cssRuleReg = /([^{}]+)\{([^{}]*)\}/g
const cssDeclReg = /([A-Za-z-]+)\s*:\s*([^;{}]+)/g

const sanitizeHighlightName = (name, prefix = '') => {
  const prefixBase = String(prefix || '').replace(highlightNameUnsafeReg, '-').replace(hyphenMultiReg, '-').replace(/^-+|-+$/g, '')
  let safe = String(name || '').replace(highlightNameUnsafeReg, '-').replace(hyphenMultiReg, '-').replace(/^-+|-+$/g, '')
  if (!safe) safe = 'scope'
  if (/^[0-9]/.test(safe)) safe = 'x-' + safe
  return prefixBase ? `${prefixBase}-${safe}` : safe
}

const normalizeHljsScopePart = (part) => {
  let next = String(part || '')
  if (!next) return ''
  if (next.startsWith('hljs-')) next = next.slice(5)
  next = next.replace(/_+$/g, '')
  if (!next) return ''
  return next.replace(highlightNameUnsafeReg, '-').replace(hyphenMultiReg, '-').replace(/^-+|-+$/g, '')
}

const selectorToHljsScopeName = (selector) => {
  const tokens = String(selector || '').trim().split(/\s+/)
  if (!tokens.length) return null
  const leaf = tokens[tokens.length - 1].replace(/:{1,2}[A-Za-z-]+(?:\([^)]*\))?$/, '')
  const classes = []
  leaf.replace(hljsScopeSelectorReg, (_, cls) => {
    classes.push(cls)
    return ''
  })
  if (!classes.length || !classes.some((name) => name.startsWith('hljs-'))) return null
  const parts = classes.map(normalizeHljsScopePart).filter(Boolean)
  if (!parts.length) return null
  return 'hljs-' + parts.join('-')
}

const parseHighlightCssStyle = (declText) => {
  const style = {}
  cssDeclReg.lastIndex = 0
  let match
  while ((match = cssDeclReg.exec(declText)) !== null) {
    const prop = match[1].trim().toLowerCase()
    const value = match[2].trim()
    if (!value) continue
    if (prop === 'color' || prop === 'background-color' || prop === 'text-decoration' || prop === 'text-shadow') {
      style[prop] = value
    }
  }
  return Object.keys(style).length ? style : null
}

const highlightStyleToCss = (style) => {
  if (!style) return ''
  const order = ['color', 'background-color', 'text-decoration', 'text-shadow']
  const parts = []
  for (const key of order) {
    if (style[key]) parts.push(`${key}: ${style[key]};`)
  }
  return parts.join(' ')
}

const buildHljsProviderData = (themeCss, scopePrefix = 'hl') => {
  const styleByScope = new Map()
  cssRuleReg.lastIndex = 0
  let match
  while ((match = cssRuleReg.exec(themeCss)) !== null) {
    const selectors = String(match[1] || '').split(',').map((item) => item.trim()).filter(Boolean)
    const style = parseHighlightCssStyle(match[2] || '')
    if (!style) continue
    for (const selector of selectors) {
      const scopeName = selectorToHljsScopeName(selector)
      if (!scopeName) continue
      const prev = styleByScope.get(scopeName) || {}
      styleByScope.set(scopeName, Object.assign({}, prev, style))
    }
  }
  // Emitter-derived scopes occasionally use names not present in theme selectors.
  // Add only color-bearing aliases that should match github.css semantics.
  if (!styleByScope.has('hljs-variable-constant') && styleByScope.has('hljs-variable')) {
    styleByScope.set('hljs-variable-constant', Object.assign({}, styleByScope.get('hljs-variable')))
  }
  const scopeColorMap = new Map()
  const cssText = Array.from(styleByScope.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([scopeName, style]) => {
      const runtimeName = sanitizeHighlightName(scopeName, scopePrefix)
      const css = highlightStyleToCss(style)
      scopeColorMap.set(runtimeName, normalizeColor(style && style.color, themePalette.text))
      return css ? `::highlight(${runtimeName}) { ${css} }` : ''
    })
    .filter(Boolean)
    .join('\n    ')
  return { cssText, scopeColorMap, styleByScope }
}

const shikiKeywordFallbackColors = {
  keyword: themePalette.keyword,
  'type-primitive': themePalette.keyword,
  number: themePalette.constant,
  string: themePalette.string,
  'string-unquoted': themePalette.string,
  variable: themePalette.builtIn,
  'variable-this': themePalette.constant,
  'variable-const': themePalette.constant,
  'variable-member': themePalette.text,
  'variable-plain': themePalette.text,
  'variable-property': themePalette.builtIn,
  'variable-parameter': themePalette.builtIn,
  'title-function': themePalette.title,
  'title-function-builtin': themePalette.constant,
  'title-class': themePalette.title,
  namespace: themePalette.title,
  literal: themePalette.constant,
  comment: themePalette.comment,
  'meta-shebang': themePalette.comment,
  punctuation: themePalette.text,
  meta: themePalette.text,
  type: themePalette.constant,
  'type-name': themePalette.title,
  tag: themePalette.tag,
  'tag-delimiter': themePalette.text,
  attribute: themePalette.title,
  text: themePalette.text,
}

const shikiKeywordBucketOrder = [
  'comment',
  'meta-shebang',
  'tag-delimiter',
  'attribute',
  'tag',
  'variable-this',
  'variable-const',
  'variable-parameter',
  'variable-member',
  'variable-property',
  'variable-plain',
  'variable',
  'string-unquoted',
  'string',
  'number',
  'literal',
  'type-primitive',
  'keyword',
  'type-name',
  'type',
  'namespace',
  'title-function-builtin',
  'title-function',
  'title-class',
  'punctuation',
  'meta',
  'text',
]

const shikiKeywordScopeColorMap = new Map()
const shikiKeywordBuckets = Array.from(new Set(shikiKeywordBucketOrder))
const shikiKeywordCss = shikiKeywordBuckets.map((bucket) => {
  const color = normalizeColor(shikiKeywordFallbackColors[bucket], themePalette.text)
  shikiKeywordScopeColorMap.set(`hl-shiki-${bucket}`, normalizeColor(color, themePalette.text))
  return `::highlight(hl-shiki-${bucket}) { color: ${color}; }`
}).join('\n    ')

const hljsProviderData = buildHljsProviderData(hljsGithubCss, 'hl')
const hljsProviderCss = hljsProviderData.cssText
const hljsApiScopeColorMap = hljsProviderData.scopeColorMap
const hljsMarkupScopeColorMap = new Map()
for (const [scopeName, style] of hljsProviderData.styleByScope.entries()) {
  hljsMarkupScopeColorMap.set(scopeName, normalizeColor(style && style.color, themePalette.text))
}

const createMd = (customHighlightOptions) => mdit({ html: true, langPrefix: 'language-' })
  .use(mditAttrs)
  .use(mditRendererFence, {
    highlightRenderer: 'api',
    customHighlight: customHighlightOptions,
  })

const createMarkupMdShikiInside = () => mdit({
  html: true,
  langPrefix: 'language-',
  highlight: (code, lang) => {
    const target = lang || 'text'
    const html = shikiHighlighter.codeToHtml(code, {
      lang: target,
      theme: 'github-light',
      structure: 'inline',
    })
    return html.replace(/<br\s*\/?>/g, '\n')
  },
})
  .use(mditRendererFence)
  .use(mditAttrs)

const createMarkupMdHljs = () => mdit({
  html: true,
  langPrefix: 'language-',
  highlight: (code, lang) => {
    const target = (lang && highlightjs.getLanguage(lang)) ? lang : 'plaintext'
    const result = highlightjs.highlight(code, { language: target })
    return `<span class="hljs">${result.value}</span>`
  },
})
  .use(mditRendererFence)
  .use(mditAttrs)

const apiVariants = [
  {
    id: 'shiki-color',
    label: 'API / Shiki / color',
    note: 'Color-derived scope names + payload scopeStyles.',
    parity: 'Parity: closest to markup shiki-inside (theme-driven).',
    group: 'api',
    makeOption: (sample, blockKey = 'sample') => ({
      provider: 'shiki',
      highlighter: shikiHighlighter,
      theme: 'github-light',
      includeScopeStyles: true,
      shikiScopeMode: 'color',
      idPrefix: `ex-${sample.id}-${blockKey}-shiki-color-`,
    }),
  },
  {
    id: 'shiki-semantic',
    label: 'API / Shiki / semantic',
    note: 'Semantic scope names + payload scopeStyles.',
    parity: 'Parity: near (semantic scope grouping differs from span nesting).',
    group: 'api',
    makeOption: (sample, blockKey = 'sample') => ({
      provider: 'shiki',
      highlighter: shikiHighlighter,
      theme: 'github-light',
      includeScopeStyles: true,
      shikiScopeMode: 'semantic',
      idPrefix: `ex-${sample.id}-${blockKey}-shiki-semantic-`,
    }),
  },
  {
    id: 'shiki-keyword',
    label: 'API / Shiki / keyword',
    note: 'Language-independent bucket names managed by CSS.',
    parity: 'Parity: normalized with rule engine buckets.',
    group: 'api',
    makeOption: (sample, blockKey = 'sample') => ({
      provider: 'shiki',
      highlighter: shikiHighlighter,
      theme: 'github-light',
      includeScopeStyles: false,
      shikiScopeMode: 'keyword',
      idPrefix: `ex-${sample.id}-${blockKey}-shiki-keyword-`,
    }),
  },
  {
    id: 'hljs',
    label: 'API / highlight.js provider',
    note: 'highlight.js scope names managed by CSS.',
    parity: 'Parity: near (scope flattening + API property limits).',
    group: 'api',
    makeOption: (sample, blockKey = 'sample') => ({
      provider: 'hljs',
      includeScopeStyles: false,
      idPrefix: `ex-${sample.id}-${blockKey}-hljs-`,
      hljsHighlight: (code, lang) => {
        const target = (lang && highlightjs.getLanguage(lang)) ? lang : 'plaintext'
        return highlightjs.highlight(code, { language: target })
      },
    }),
  },
]

const markupVariants = [
  {
    id: 'markup-shiki-inside',
    label: 'Markup / shiki-inside',
    note: 'Span-based markup using Shiki inline rendering.',
    parity: 'Reference: span-based theme output.',
    group: 'markup',
    md: createMarkupMdShikiInside(),
  },
  {
    id: 'markup-hljs',
    label: 'Markup / highlight.js',
    note: 'Span-based markup using highlight.js classes.',
    parity: 'Reference: span-based theme output.',
    group: 'markup',
    md: createMarkupMdHljs(),
  },
]

const renderOneApiBlock = (sample, variant, codeText, blockKey = 'sample') => {
  const md = createMd(variant.makeOption(sample, blockKey))
  const env = {}
  const markdown = `\`\`\`${sample.lang}\n${codeText}\`\`\`\n`
  const html = md.render(markdown, env).trim()
  const payloadMap = env.rendererFenceCustomHighlights || {}
  const ids = Object.keys(payloadMap)
  return {
    html,
    payloadMap,
    payload: ids.length ? payloadMap[ids[0]] : null,
  }
}

const renderOneMarkupBlock = (sample, variant, codeText) => {
  const markdown = `\`\`\`${sample.lang}\n${codeText}\`\`\`\n`
  return variant.md.render(markdown).trim()
}

const baseTextColor = normalizeColor(themePalette.text, '#24292e')
const preCodeInnerReg = /^\s*<pre\b(?:[^>"']|"[^"]*"|'[^']*')*>\s*<code\b(?:[^>"']|"[^"]*"|'[^']*')*>([\s\S]*?)<\/code>\s*<\/pre>\s*$/i

const average = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

const formatRatio = (ratio) => `${(ratio * 100).toFixed(1)}%`
const formatRatioMaybe = (ratio) => Number.isFinite(ratio) ? formatRatio(ratio) : '-'
const formatRatioPairMaybe = (metric) => {
  if (!metric || typeof metric !== 'object') return '-'
  return `${formatRatioMaybe(metric.all)} / ${formatRatioMaybe(metric.nonWhitespace)}`
}

const decodeHtmlEntity = (entity) => {
  if (entity === '&lt;') return '<'
  if (entity === '&gt;') return '>'
  if (entity === '&amp;') return '&'
  if (entity === '&quot;') return '"'
  if (entity === '&#39;' || entity === '&apos;') return '\''
  if (entity.startsWith('&#x') || entity.startsWith('&#X')) {
    const n = Number.parseInt(entity.slice(3, -1), 16)
    if (Number.isFinite(n)) {
      try { return String.fromCodePoint(n) } catch (e) {}
    }
    return entity
  }
  if (entity.startsWith('&#')) {
    const n = Number.parseInt(entity.slice(2, -1), 10)
    if (Number.isFinite(n)) {
      try { return String.fromCodePoint(n) } catch (e) {}
    }
    return entity
  }
  return entity
}

const decodeHtmlEntities = (text) => {
  if (!text || text.indexOf('&') === -1) return text
  return text.replace(/&(?:#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]+);/g, decodeHtmlEntity)
}

const parsePreCodeInner = (html) => {
  const m = String(html || '').match(preCodeInnerReg)
  return m ? m[1] : ''
}

const getAttrValueFromTagBody = (body, name) => {
  const reg = new RegExp(`\\b${name}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>` + '`' + `]+))`, 'i')
  const m = reg.exec(body)
  if (!m) return ''
  return m[1] ?? m[2] ?? m[3] ?? ''
}

const resolveShikiInlineSpanColor = (tagBody, fallbackColor) => {
  const styleValue = getAttrValueFromTagBody(tagBody, 'style')
  if (!styleValue) return fallbackColor
  const m = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(styleValue)
  if (!m) return fallbackColor
  return normalizeColor(m[1], fallbackColor)
}

const getHljsScopeNameFromClassText = (classText) => {
  if (!classText) return ''
  const tokens = String(classText).trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return ''
  const parts = []
  for (const token of tokens) {
    if (token === 'hljs') continue
    const normalized = normalizeHljsScopePart(token)
    if (!normalized || normalized === 'hljs') continue
    parts.push(normalized)
  }
  if (!parts.length) return ''
  return 'hljs-' + parts.join('-')
}

const resolveHljsMarkupSpanColor = (tagBody, fallbackColor) => {
  const classText = getAttrValueFromTagBody(tagBody, 'class')
  const scopeName = getHljsScopeNameFromClassText(classText)
  if (!scopeName) return fallbackColor
  return hljsMarkupScopeColorMap.get(scopeName) || fallbackColor
}

const collectColorMapFromCodeHtml = (codeHtml, resolveSpanColor, fallbackColor = baseTextColor) => {
  const source = String(codeHtml || '')
  const out = []
  const colorStack = [fallbackColor]
  let i = 0
  while (i < source.length) {
    const lt = source.indexOf('<', i)
    const textEnd = lt === -1 ? source.length : lt
    if (textEnd > i) {
      const text = decodeHtmlEntities(source.slice(i, textEnd))
      const color = colorStack[colorStack.length - 1] || fallbackColor
      for (let n = 0; n < text.length; n++) out.push(color)
    }
    if (lt === -1) break
    const gt = source.indexOf('>', lt + 1)
    if (gt === -1) break
    const body = source.slice(lt + 1, gt).trim()
    if (body.startsWith('/')) {
      const closeName = body.slice(1).trim().split(/\s+/)[0].toLowerCase()
      if (closeName === 'span' && colorStack.length > 1) colorStack.pop()
    } else {
      const openName = body.split(/\s+/)[0].replace(/\/$/, '').toLowerCase()
      if (openName === 'span') {
        const parentColor = colorStack[colorStack.length - 1] || fallbackColor
        const nextColor = resolveSpanColor(body, parentColor) || parentColor
        colorStack.push(nextColor)
      } else if (openName === 'br') {
        out.push(colorStack[colorStack.length - 1] || fallbackColor)
      }
    }
    i = gt + 1
  }
  return out
}

const toLengthColorMap = (map, length, fallbackColor = baseTextColor) => {
  const out = Array.isArray(map) ? map.slice(0, length) : []
  while (out.length < length) out.push(fallbackColor)
  return out
}

const buildColorMapFromPayload = (payload, fallbackScopeColorMap, fallbackColor = baseTextColor) => {
  if (!payload || !Array.isArray(payload.scopes) || !Array.isArray(payload.ranges)) return []
  const textLength = Number.isSafeInteger(payload.textLength) ? payload.textLength : 0
  const out = new Array(textLength).fill(fallbackColor)
  for (const tuple of payload.ranges) {
    if (!Array.isArray(tuple) || tuple.length < 3) continue
    const scopeIdx = tuple[0]
    const start = tuple[1]
    const end = tuple[2]
    if (!Number.isSafeInteger(scopeIdx) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) continue
    if (scopeIdx < 0 || scopeIdx >= payload.scopes.length) continue
    if (start < 0 || end <= start || start >= textLength) continue
    const scopeName = payload.scopes[scopeIdx]
    let color = fallbackColor
    if (Array.isArray(payload.scopeStyles) && payload.scopeStyles[scopeIdx] && payload.scopeStyles[scopeIdx].color) {
      color = normalizeColor(payload.scopeStyles[scopeIdx].color, fallbackColor)
    } else if (fallbackScopeColorMap && fallbackScopeColorMap.get(scopeName)) {
      color = fallbackScopeColorMap.get(scopeName)
    }
    const safeEnd = Math.min(end, textLength)
    for (let i = start; i < safeEnd; i++) out[i] = color
  }
  return out
}

const compareColorMapsDetailed = (lhs, rhs, sourceText = '', fallbackColor = baseTextColor) => {
  const text = String(sourceText || '')
  const len = Math.max(lhs.length, rhs.length, text.length)
  if (!len) {
    return {
      all: 1,
      nonWhitespace: 1,
      allMatched: 0,
      allTotal: 0,
      nonWhitespaceMatched: 0,
      nonWhitespaceTotal: 0,
    }
  }
  const left = toLengthColorMap(lhs, len, fallbackColor)
  const right = toLengthColorMap(rhs, len, fallbackColor)
  let same = 0
  let sameNoWs = 0
  let countNoWs = 0
  for (let i = 0; i < len; i++) {
    if ((left[i] || fallbackColor) === (right[i] || fallbackColor)) same++
    const ch = text[i] || ''
    if (!/\s/.test(ch)) {
      countNoWs++
      if ((left[i] || fallbackColor) === (right[i] || fallbackColor)) sameNoWs++
    }
  }
  return {
    all: same / len,
    nonWhitespace: countNoWs ? (sameNoWs / countNoWs) : 1,
    allMatched: same,
    allTotal: len,
    nonWhitespaceMatched: sameNoWs,
    nonWhitespaceTotal: countNoWs,
  }
}

const aggregateMetrics = (metrics) => {
  if (!Array.isArray(metrics) || metrics.length === 0) return null
  let allMatched = 0
  let allTotal = 0
  let nonWhitespaceMatched = 0
  let nonWhitespaceTotal = 0
  for (const metric of metrics) {
    if (!metric) continue
    allMatched += Number.isFinite(metric.allMatched) ? metric.allMatched : 0
    allTotal += Number.isFinite(metric.allTotal) ? metric.allTotal : 0
    nonWhitespaceMatched += Number.isFinite(metric.nonWhitespaceMatched) ? metric.nonWhitespaceMatched : 0
    nonWhitespaceTotal += Number.isFinite(metric.nonWhitespaceTotal) ? metric.nonWhitespaceTotal : 0
  }
  return {
    all: allTotal ? (allMatched / allTotal) : 1,
    nonWhitespace: nonWhitespaceTotal ? (nonWhitespaceMatched / nonWhitespaceTotal) : 1,
    allMatched,
    allTotal,
    nonWhitespaceMatched,
    nonWhitespaceTotal,
  }
}

const parityMetricOrder = ['shiki-color', 'shiki-semantic', 'shiki-keyword', 'hljs']
const parityMetricLabel = new Map([
  ['shiki-color', 'Shiki/color'],
  ['shiki-semantic', 'Shiki/semantic'],
  ['shiki-keyword', 'Shiki/keyword'],
  ['hljs', 'highlight.js/api'],
])

const payloadMap = {}
const parityRows = []
const parityByVariantAll = new Map(parityMetricOrder.map((id) => [id, []]))
const parityByVariantNoWs = new Map(parityMetricOrder.map((id) => [id, []]))
const sectionHtml = samples.map((sample) => {
  const codeBlocks = [
    { key: 'sample', label: 'Sample', code: sample.complexCode || sample.code },
  ]
  const renderedByVariantId = new Map()

  for (const variant of apiVariants) {
    const blocks = []
    for (const codeBlock of codeBlocks) {
      const rendered = renderOneApiBlock(sample, variant, codeBlock.code, codeBlock.key)
      Object.assign(payloadMap, rendered.payloadMap)
      blocks.push({
        key: codeBlock.key,
        label: codeBlock.label,
        code: codeBlock.code,
        html: rendered.html,
        payload: rendered.payload,
      })
    }
    renderedByVariantId.set(variant.id, { variant, blocks })
  }

  for (const variant of markupVariants) {
    const blocks = []
    for (const codeBlock of codeBlocks) {
      const html = renderOneMarkupBlock(sample, variant, codeBlock.code)
      blocks.push({
        key: codeBlock.key,
        label: codeBlock.label,
        code: codeBlock.code,
        html,
        payload: null,
      })
    }
    renderedByVariantId.set(variant.id, { variant, blocks })
  }

  const shikiMarkupByBlock = new Map()
  const hljsMarkupByBlock = new Map()
  for (const codeBlock of codeBlocks) {
    const shikiMarkupBlock = renderedByVariantId.get('markup-shiki-inside')?.blocks.find((item) => item.key === codeBlock.key)
    const hljsMarkupBlock = renderedByVariantId.get('markup-hljs')?.blocks.find((item) => item.key === codeBlock.key)
    const shikiMarkupInner = parsePreCodeInner(shikiMarkupBlock ? shikiMarkupBlock.html : '')
    const hljsMarkupInner = parsePreCodeInner(hljsMarkupBlock ? hljsMarkupBlock.html : '')
    const shikiMarkupColorMap = toLengthColorMap(
      collectColorMapFromCodeHtml(shikiMarkupInner, resolveShikiInlineSpanColor, baseTextColor),
      codeBlock.code.length,
      baseTextColor,
    )
    const hljsMarkupColorMap = toLengthColorMap(
      collectColorMapFromCodeHtml(hljsMarkupInner, resolveHljsMarkupSpanColor, baseTextColor),
      codeBlock.code.length,
      baseTextColor,
    )
    shikiMarkupByBlock.set(codeBlock.key, shikiMarkupColorMap)
    hljsMarkupByBlock.set(codeBlock.key, hljsMarkupColorMap)
  }

  const metricByVariantId = new Map()
  const metricByVariantBlockId = new Map()
  const ratioTargetList = [
    { id: 'shiki-color', referenceGroup: 'shiki', fallbackScopeColorMap: null },
    { id: 'shiki-semantic', referenceGroup: 'shiki', fallbackScopeColorMap: null },
    { id: 'shiki-keyword', referenceGroup: 'shiki', fallbackScopeColorMap: shikiKeywordScopeColorMap },
    { id: 'hljs', referenceGroup: 'hljs', fallbackScopeColorMap: hljsApiScopeColorMap },
  ]
  for (const target of ratioTargetList) {
    const rendered = renderedByVariantId.get(target.id)
    if (!rendered || !Array.isArray(rendered.blocks)) continue
    const blockMetrics = []
    for (const codeBlock of codeBlocks) {
      const apiBlock = rendered.blocks.find((item) => item.key === codeBlock.key)
      if (!apiBlock || !apiBlock.payload) continue
      const referenceColorMap = target.referenceGroup === 'hljs'
        ? hljsMarkupByBlock.get(codeBlock.key)
        : shikiMarkupByBlock.get(codeBlock.key)
      if (!Array.isArray(referenceColorMap)) continue
      const apiColorMap = toLengthColorMap(
        buildColorMapFromPayload(apiBlock.payload, target.fallbackScopeColorMap, baseTextColor),
        codeBlock.code.length,
        baseTextColor,
      )
      const metric = compareColorMapsDetailed(apiColorMap, referenceColorMap, codeBlock.code, baseTextColor)
      blockMetrics.push({ key: codeBlock.key, metric })
    }
    if (!blockMetrics.length) continue
    const metric = aggregateMetrics(blockMetrics.map((item) => item.metric))
    metricByVariantId.set(target.id, metric)
    metricByVariantBlockId.set(target.id, blockMetrics)
    const listAll = parityByVariantAll.get(target.id)
    if (listAll) listAll.push(metric.all)
    const listNoWs = parityByVariantNoWs.get(target.id)
    if (listNoWs) listNoWs.push(metric.nonWhitespace)
  }
  const languageOverallAll = average(Array.from(metricByVariantId.values()).map((metric) => metric.all))
  const languageOverallNoWs = average(Array.from(metricByVariantId.values()).map((metric) => metric.nonWhitespace))
  parityRows.push({
    id: sample.id,
    title: sample.title,
    lang: sample.lang,
    overallAll: languageOverallAll,
    overallNoWs: languageOverallNoWs,
    metrics: Object.fromEntries(metricByVariantId),
  })

  const sectionRatioText = parityMetricOrder
    .map((id) => `${parityMetricLabel.get(id)} ${formatRatioPairMaybe(metricByVariantId.get(id))}`)
    .join(' | ')

  // Keep close pairs for visual comparison:
  // - Markup / shiki-inside next to API / Shiki / color
  // - Markup / highlight.js next to API / highlight.js provider
  const variantOrder = [
    'markup-shiki-inside',
    'shiki-color',
    'shiki-semantic',
    'shiki-keyword',
    'markup-hljs',
    'hljs',
  ]
  const cards = variantOrder
    .map((id) => {
      const rendered = renderedByVariantId.get(id)
      if (!rendered) return ''
      const metric = metricByVariantId.get(id)
      const blockMetrics = metricByVariantBlockId.get(id) || []
      const blockMetricText = blockMetrics.length
        ? ` [${blockMetrics.map((entry) => `${entry.key} ${formatRatioPairMaybe(entry.metric)}`).join(' | ')}]`
        : ''
      const measured = metric ? ` Measured parity (all/non-ws): ${formatRatioMaybe(metric.all)} / ${formatRatioMaybe(metric.nonWhitespace)}${blockMetricText}.` : ''
      const blocksHtml = Array.isArray(rendered.blocks)
        ? rendered.blocks.map((block) => `<p class="sample-label">${block.label}</p>\n  ${block.html}`).join('\n')
        : ''
      return `<article class="variant-card variant-card--${rendered.variant.group}">
  <h3>${rendered.variant.label}</h3>
  <p>${rendered.variant.note}</p>
  <p class="parity-note">${rendered.variant.parity}${measured}</p>
  ${blocksHtml}
</article>`
    })
    .filter(Boolean)
    .join('\n')

  return `<section class="lang-section" id="${sample.id}">
  <h2>${sample.title} <small>${sample.lang}</small></h2>
  <p class="ratio-language">Measured parity (this language, all/non-ws): overall ${formatRatio(languageOverallAll)} / ${formatRatio(languageOverallNoWs)} | ${sectionRatioText}</p>
  <div class="variant-grid">
${cards}
  </div>
</section>`
}).join('\n\n')

const globalParitySummaryTextAll = parityMetricOrder
  .map((id) => `${parityMetricLabel.get(id)} ${formatRatio(average(parityByVariantAll.get(id) || []))}`)
  .join(' | ')
const globalParitySummaryTextNoWs = parityMetricOrder
  .map((id) => `${parityMetricLabel.get(id)} ${formatRatio(average(parityByVariantNoWs.get(id) || []))}`)
  .join(' | ')
const globalParityOverallAll = formatRatio(average(parityRows.map((row) => row.overallAll)))
const globalParityOverallNoWs = formatRatio(average(parityRows.map((row) => row.overallNoWs)))
const globalParityHtml = `<p class="summary summary--parity">Measured parity (all chars): overall ${globalParityOverallAll} | ${globalParitySummaryTextAll}</p>
  <p class="summary summary--parity">Measured parity (non-whitespace chars): overall ${globalParityOverallNoWs} | ${globalParitySummaryTextNoWs}</p>`
const parityTableHeader = parityMetricOrder
  .map((id) => `<th>${parityMetricLabel.get(id)}</th>`)
  .join('')
const parityTableRowsHtml = parityRows
  .map((row) => {
    const cols = parityMetricOrder.map((id) => `<td>${formatRatioPairMaybe(row.metrics[id])}</td>`).join('')
    return `<tr><th><a href="#${row.id}">${row.title}</a> <small>${row.lang}</small></th>${cols}<td>${formatRatio(row.overallAll)} / ${formatRatio(row.overallNoWs)}</td></tr>`
  })
  .join('\n')
const parityTableHtml = `<div class="parity-table-wrap">
  <table class="parity-table">
    <thead>
      <tr><th>Language</th>${parityTableHeader}<th>Overall</th></tr>
    </thead>
    <tbody>
      ${parityTableRowsHtml}
    </tbody>
  </table>
</div>`

const payloadScript = renderCustomHighlightPayloadScript({ rendererFenceCustomHighlights: payloadMap }, 'pre-highlight-data')

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Custom Highlight API Provider Matrix</title>
  <style>
    body { margin: 24px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; line-height: 1.45; }
    h1 { margin: 0 0 8px; }
    h2 { margin: 24px 0 10px; font-size: 20px; }
    h2 small { color: #6a737d; font-size: 14px; }
    h3 { margin: 0 0 6px; font-size: 15px; }
    p { margin: 0 0 10px; color: #57606a; font-size: 13px; }
    .parity-note { margin: 0 0 10px; color: #24292e; font-size: 12px; font-weight: 700; }
    .sample-label { margin: 10px 0 6px; color: #57606a; font-size: 12px; font-weight: 700; }
    .sample-label:first-of-type { margin-top: 0; }
    #runtime-status { margin: 0 0 18px; font-size: 14px; }
    .summary { margin: 0 0 16px; color: #57606a; font-size: 14px; }
    .summary--parity { color: #24292e; font-weight: 700; }
    .lang-section { margin: 0 0 26px; }
    .ratio-language { color: #24292e; font-weight: 700; }
    .parity-table-wrap { margin: 0 0 20px; overflow: auto; border: 1px solid #d0d7de; border-radius: 8px; }
    .parity-table { width: 100%; border-collapse: collapse; min-width: 920px; background: #fff; font-size: 12px; }
    .parity-table th, .parity-table td { border-bottom: 1px solid #d8dee4; padding: 6px 8px; text-align: right; white-space: nowrap; }
    .parity-table th:first-child, .parity-table td:first-child { text-align: left; }
    .parity-table thead th { background: #f6f8fa; color: #24292e; font-weight: 700; }
    .parity-table tbody tr:last-child th, .parity-table tbody tr:last-child td { border-bottom: none; }
    .parity-table a { color: #0969da; text-decoration: none; }
    .parity-table a:hover { text-decoration: underline; }
    .parity-table small { color: #57606a; font-size: 11px; }
    .variant-grid { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    @media (max-width: 1280px) { .variant-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 860px) { .variant-grid { grid-template-columns: minmax(0, 1fr); } }
    .variant-card { border: 1px solid #d0d7de; border-radius: 8px; padding: 12px; background: #fff; }
    .variant-card--api { border-color: #c8e1ff; background: #f8fbff; }
    .variant-card--markup { border-color: #d1fadf; background: #f8fffb; }
    pre { margin: 0; padding: 12px; border-radius: 6px; background: #f6f8fa; color: ${themePalette.text}; overflow: auto; }

    /* Shiki keyword buckets (CSS-managed) */
    ${shikiKeywordCss}

    /* highlight.js provider buckets (CSS-managed) */
    ${hljsProviderCss}

    /* highlight.js markup theme (span-based) */
${hljsGithubCss}
  </style>
</head>
<body>
  <h1>Custom Highlight API Provider Matrix</h1>
  <p class="summary">One page, same code samples, compared across API mode and markup mode. Each card includes a parity note to show expected closeness to span-based output.</p>
  <p class="summary">Parity cells are shown as <strong>all / non-whitespace</strong> to separate visible-token quality from indentation-space differences.</p>
  ${globalParityHtml}
  ${parityTableHtml}
  <p id="runtime-status"></p>
${sectionHtml}
${payloadScript}
  <script src="./pre-highlight.js"></script>
  <script>
    window.applyPreHighlights({ useScopeStyles: true, dataScriptId: 'pre-highlight-data', statusId: 'runtime-status' })
  </script>
</body>
</html>
`

const htmlPath = path.join(baseDir, 'custom-highlight-provider-matrix.html')
fs.writeFileSync(htmlPath, html)

const runtimeSrc = path.join(baseDir, '..', 'test', 'custom-highlight', 'pre-highlight.js')
const runtimeDest = path.join(baseDir, 'pre-highlight.js')
fs.copyFileSync(runtimeSrc, runtimeDest)

console.log('Generated custom-highlight-provider-matrix.html')
console.log('Copied pre-highlight.js')
