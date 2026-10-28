import { html } from './html';
import { button, detailsCard } from './blocks';
import { fillHtml, fillText, htmlToPlainText, sanitizeEmailHtml, templateVariables } from './template';

describe('mail templates', () => {
  it('fills variables, escaping text and inserting blocks as-is', () => {
    const { html: out, unknown } = fillHtml('<p>Hi {{name}}</p>{{card}}<p>{{missing}}</p>', {
      name: '<img src=x onerror=alert(1)>Ravi',
      card: detailsCard([['Date', 'Monday'], ['Empty', null]]),
    });
    expect(out).toContain('Hi &lt;img src=x onerror=alert(1)&gt;Ravi');
    expect(out).toContain('Monday');
    expect(out).not.toContain('Empty');
    expect(unknown).toEqual(['missing']);
  });

  it('cleans dangerous markup from templates and from filled results', () => {
    const dirty = '<p onclick="x()">ok</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a><iframe src="https://x"></iframe><a href="https://ok.com">good</a>';
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).toBe('<p>ok</p><a target="_blank" rel="noopener noreferrer">bad</a><a href="https://ok.com" target="_blank" rel="noopener noreferrer">good</a>');
    // A URL variable can't smuggle a javascript: link through an href in the template.
    expect(fillHtml('<a href="{{u}}">x</a>', { u: 'javascript:alert(1)' }).html).not.toContain('javascript:');
  });

  it('lifts a block placeholder out of its own paragraph but leaves text placeholders alone', () => {
    const vars = { card: detailsCard([['Date', 'Monday']]), name: 'Ravi' };
    const { html: out } = fillHtml('<p>{{card}}</p><p>{{name}}</p>', vars);
    expect(out.startsWith('<table')).toBe(true);
    expect(out).toContain('<p>Ravi</p>');
    // Two blocks the editor merged into one paragraph are both lifted out; mixed text stays a paragraph.
    expect(fillHtml('<p> {{card}} {{card}}</p>', vars).html).not.toContain('<p>');
    expect(fillHtml('<p>{{name}} {{card}}</p>', vars).html.startsWith('<p>Ravi')).toBe(true);
  });

  it('keeps button and card styling through cleaning', () => {
    const { html: out } = fillHtml('{{b}}', { b: button('Join', 'https://meet.google.com/x') });
    expect(out).toContain('href="https://meet.google.com/x"');
    expect(out).toContain('background:#27427f');
    expect(button('Bad', 'javascript:alert(1)').value).toBe('');
  });

  it('makes single-line subjects and lists the variables a template uses', () => {
    expect(fillText('Hi {{a}}\n{{b}}', { a: 'X', b: html`<b>Y</b>` }).text).toBe('Hi X Y');
    expect(templateVariables('{{ a.b }} {{c}} {{a.b}}')).toEqual(['a.b', 'c']);
  });

  it('produces a readable plain-text version', () => {
    expect(htmlToPlainText('<p>Hello</p><p><a href="https://x.com/a">Open</a></p>')).toBe('Hello\n\nOpen [https://x.com/a]');
  });
});
