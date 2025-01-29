# p7d-markdown-it-renderer-fence

In code blocks, the `<samp>` tag is used with the language keywords `samp`, `shell`, and `console`.

To add specific styles to code blocks and display line numbers in code blocks, enclose each line in a span element and set CSS.

## Use

It is assumed that you will use  highlight.js and markdown-it-attrs together. It will probably work without them though.

```js
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import highlightjs from 'highlihgtjs'
import mditRendererFence from '@peaceroad/markdown-it-renderer-fence'

const md = mdit({
             langPrefix: 'language-',
             highlight: (str, lang) => {
             if (lang && highlightjs.getLanguage(lang)) {
               try {
                  return highlightjs.highlight(str, { language: lang }).value
               } catch (__) {}
             }
             return str
           }).use(mditAttrs).use(mditRendererFence)


const htmlCont = md.render('...')
```

It is also intended to be used in conjunction with @peaceroad/markdown-it-figure-with-p-caption.

## Code block to samp block

~~~
[Markdown]
```samp
$ pwd
/home/User
```
[HTML]
<pre><samp>$ pwd
/home/User
</samp></pre>


[Markdown]
```shell
$ pwd
/home/User
```
[HTML]
<pre><samp class="language-shell"><span class="hljs-meta prompt_">$ </span><span class="language-bash"><span class="hljs-built_in">pwd</span></span>
/home/User
</samp></pre>


[Markdown]
```console
$ pwd
/home/User
```
[HTML]
<pre><samp class="language-console"><span class="hljs-meta prompt_">$ </span><span class="language-bash"><span class="hljs-built_in">pwd</span></span>
/home/User
</samp></pre>
~~~


## Add span elements to display line number.

Add `start` or `data-pre-start` attribute by adding attributes used markdown-it-attrs.

~~~md
```js {start="1"}
import mdit from 'markdonw-it'
const md = mdit()
md.render('Nyaan')
```
~~~

~~~html
<pre><code class="language-js" data-pre-start="1" style="counter-set:pre-line-number 1;"><span class="pre-line"><span class="hljs-keyword">import</span> mdit <span class="hljs-keyword">from</span> <span class="hljs-string">&#x27;markdonw-it&#x27;</span></span>
<span class="pre-line"><span class="hljs-keyword">const</span> md = <span class="hljs-title function_">mdit</span>()</span>
<span class="pre-line">md.<span class="hljs-title function_">render</span>(<span class="hljs-string">&#x27;Nyaan&#x27;</span>)</span>
</code></pre>
~~~

CSS example: <https://codepen.io/peaceroad/pen/qBGpYGK>

## Add span elements to add background color to the row ranges.

Add `em-lines` or `emphasize-lines` attribute by by adding attributes used markdown-it-attrs.

~~~md
```js {em-lines="1,3-5"}
``` {em-lines="2,4-5"}
1
2
3
4
5
6
```
~~~

~~~html
[HTML]
<pre><code>1
<span class="pre-lines-emphasis">2
</span>3
<span class="pre-lines-emphasis">4
5
</span>6
</code></pre>
~~~
