import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const pages = ["index.html", "search.html", "posting.html", "apply.html"];

function loadDocument(name: string): Document {
  const html = readFileSync(join(dir, name), "utf8");
  return parseHTML(html).document;
}

function testId(doc: Document, id: string): Element | null {
  return doc.querySelector(`[data-testid="${id}"]`);
}

describe("job-site fixture", () => {
  it.each(pages)("%s has no scripts or remote assets", (name) => {
    const doc = loadDocument(name);
    expect(doc.querySelectorAll("script")).toHaveLength(0);
    const urls = [...doc.querySelectorAll("[src], [href]")].map(
      (el) => el.getAttribute("src") ?? el.getAttribute("href") ?? "",
    );
    for (const url of urls) {
      expect(url).not.toMatch(/^(https?:)?\/\//);
    }
  });

  it("search page has filters and a posting link", () => {
    const doc = loadDocument("search.html");
    for (const name of ["keyword", "location", "job_type"]) {
      expect(doc.querySelector(`[name="${name}"]`), name).not.toBeNull();
    }
    expect(testId(doc, "search-submit")).not.toBeNull();
    expect(testId(doc, "posting-link-1")?.getAttribute("href")).toBe("posting.html");
  });

  it("posting page links to the application form", () => {
    const doc = loadDocument("posting.html");
    expect(testId(doc, "posting-title")?.textContent).toBe("Software Engineer");
    expect(testId(doc, "apply-link")?.getAttribute("href")).toBe("apply.html");
  });

  it("application form has expected fields and submit control", () => {
    const doc = loadDocument("apply.html");
    const expected = {
      "field-full-name": "full_name",
      "field-email": "email",
      "field-phone": "phone",
      "field-years-experience": "years_experience",
      "field-work-authorization": "work_authorization",
      "field-cover-letter": "cover_letter",
    };
    for (const [id, name] of Object.entries(expected)) {
      expect(testId(doc, id)?.getAttribute("name"), id).toBe(name);
    }
    const submit = testId(doc, "submit-application");
    expect(submit?.getAttribute("type")).toBe("submit");
    expect(testId(doc, "apply-form")?.getAttribute("action")).toBe("/fixtures/job/applications");
  });

  it("submission recorder starts empty", () => {
    const raw = readFileSync(join(dir, "submissions.json"), "utf8");
    expect(JSON.parse(raw)).toEqual([]);
  });
});
