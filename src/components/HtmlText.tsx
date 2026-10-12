import { Linking, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { colors } from '../theme';

type Inline = {
  text: string;
  italic?: boolean;
  bold?: boolean;
  href?: string;
};

type Block = { items: Inline[] };

type Mark = { tag: string; href?: string };

const BLOCK_TAGS = new Set(['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4']);
const SKIP_TAGS = new Set(['script', 'style']);

export default function HtmlText({ html, style }: { html: string; style?: TextStyle }) {
  const blocks = parseHtml(html).filter((block) => block.items.some((item) => item.text.trim()));
  if (!blocks.length) return null;
  return (
    <View style={styles.wrap}>
      {blocks.map((block, index) => (
        <Text key={index} style={style}>
          {block.items.map((item, itemIndex) => (
            <Text
              key={itemIndex}
              style={[item.italic ? styles.italic : null, item.bold ? styles.bold : null, item.href ? styles.link : null]}
              onPress={item.href ? () => void Linking.openURL(item.href as string) : undefined}
            >
              {item.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

function parseHtml(source: string): Block[] {
  const html = source.includes('<') ? source : decodeEntities(source);
  const blocks: Block[] = [{ items: [] }];
  const marks: Mark[] = [];
  const pattern = /<\/?([a-zA-Z][\w:-]*)([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    if (match[3]) {
      appendText(blocks, decodeEntities(match[3]), styleFrom(marks));
      continue;
    }
    const tag = match[1].toLowerCase();
    const closing = match[0].startsWith('</');
    const attrs = match[2] ?? '';
    if (SKIP_TAGS.has(tag)) {
      if (!closing) skipUntilClose(html, tag, pattern);
      continue;
    }
    if (!closing && (tag === 'br' || tag === 'hr')) {
      blocks.push({ items: [] });
      continue;
    }
    if (closing) {
      if (BLOCK_TAGS.has(tag)) blocks.push({ items: [] });
      const index = findLastMark(marks, tag);
      if (index >= 0) marks.splice(index, 1);
      continue;
    }
    if (BLOCK_TAGS.has(tag) && blocks[blocks.length - 1].items.length) blocks.push({ items: [] });
    if (tag === 'li') blocks[blocks.length - 1].items.push({ text: '• ' });
    if (tag === 'i' || tag === 'em' || tag === 'b' || tag === 'strong' || tag === 'a') {
      marks.push({ tag, href: tag === 'a' ? readHref(attrs) : undefined });
    }
  }
  return blocks;
}

function skipUntilClose(html: string, tag: string, pattern: RegExp): void {
  const end = new RegExp(`</${tag}\\s*>`, 'i').exec(html.slice(pattern.lastIndex));
  if (end) pattern.lastIndex += end.index + end[0].length;
}

function appendText(blocks: Block[], text: string, style: Omit<Inline, 'text'>): void {
  const parts = text.split('\n');
  parts.forEach((part, index) => {
    if (index > 0) blocks.push({ items: [] });
    if (part) blocks[blocks.length - 1].items.push({ text: part, ...style });
  });
}

function findLastMark(marks: Mark[], tag: string): number {
  for (let index = marks.length - 1; index >= 0; index -= 1) {
    if (marks[index].tag === tag) return index;
  }
  return -1;
}

function styleFrom(marks: Mark[]): Omit<Inline, 'text'> {
  const link = [...marks].reverse().find((mark) => mark.href);
  return {
    italic: marks.some((mark) => mark.tag === 'i' || mark.tag === 'em'),
    bold: marks.some((mark) => mark.tag === 'b' || mark.tag === 'strong'),
    href: link?.href,
  };
}

function readHref(attrs: string): string | undefined {
  const href = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
  const value = href?.[1] ?? href?.[2] ?? href?.[3];
  if (!value || !/^https?:\/\//i.test(value)) return undefined;
  return value;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  italic: { fontStyle: 'italic' },
  bold: { fontWeight: '700' },
  link: { color: colors.accent },
});
