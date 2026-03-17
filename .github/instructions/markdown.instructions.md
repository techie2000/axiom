---
description: 'Documentation and content creation standards'
applyTo: '**/*.md'
---

## Markdown Content Rules

The following markdown content rules are enforced by markdownlint and MUST be followed:

### Markdownlint Rule Quick Reference

Use this as a fast lookup for the MD rules configured in this repo:

| Rule | What it checks | Repo setting |
| ---- | -------------- | ------------ |
| MD003 | Heading style format | `atx` (`#`, `##`, `###`) |
| MD004 | Unordered list marker style | `dash` (`-`) |
| MD007 | Nested list indentation | `2` spaces |
| MD013 | Line length | max `120`; ignore code blocks and tables |
| MD022 | Blank lines around headings | enabled |
| MD024 | Duplicate heading names | allowed only for non-sibling headings |
| MD025 | Multiple top-level headings (H1) | disabled |
| MD031 | Blank lines around fenced code blocks | enabled |
| MD032 | Blank lines around lists | enabled |
| MD033 | Inline HTML usage | restricted allowlist (`details`, `summary`, `img`, `br`, `sub`, `sup`) |
| MD034 | Bare URLs without markdown links | disabled |
| MD040 | Language info on fenced code blocks | enabled |
| MD041 | First line must be top-level heading | disabled |
| MD046 | Code block style | `fenced` only |

1. **Headings**: Use appropriate heading levels (H2, H3, etc.) to structure your content. Do not use an H1 heading,
   as this will be generated based on the title.
2. **Lists**: Use bullet points or numbered lists for lists. Ensure proper indentation and spacing.
3. **Code Blocks**: **ALWAYS specify language for fenced code blocks.** Use triple backticks with language identifier
  (for example: triple-backtick-go, triple-backtick-json, triple-backtick-bash, triple-backtick-text).
4. **Links**: Use proper markdown syntax for links. Ensure that links are valid and accessible.
5. **Images**: Use proper markdown syntax for images. Include alt text for accessibility.
6. **Tables**: Use markdown tables for tabular data. Ensure proper formatting and alignment.
7. **Line Length**: **CRITICAL** - Limit line length to **120 characters** maximum. Break long lines into multiple lines.
8. **Whitespace**: Use appropriate whitespace to separate sections and improve readability.
9. **Front Matter**: Include YAML front matter at the beginning of the file with required metadata fields.
10. **File and Document References**: **ALWAYS hyperlink references to files, documents, and ADRs.** Never reference
    a file or document by name without providing a clickable link to it.
11. **No Emphasis as Headings**: **NEVER use bold/italic text as headings.** Use proper heading syntax (`####`)
    instead of `**Bold Text**` for section headers.

## Formatting and Structure

Follow these guidelines for formatting and structuring your markdown content:

- **Headings**: Use `##` for H2, `###` for H3, `####` for H4. **Never use bold text (`**Text**`) as a heading
  substitute.** Always use proper heading syntax.
  - ✅ **GOOD**: `#### Section Title`
  - ❌ **BAD**: `**Section Title**` (emphasis used as heading)
  - Heading levels must increase by only one level at a time (MD001-compliant).
    Example: `##` → `###` is valid, but `##` → `####` is not.
- **Lists**: Use `-` for bullet points and `1.` for numbered lists. Indent nested lists with two spaces.
- **Code Blocks**: **ALWAYS specify language.** Use triple backticks with language identifier immediately after
  opening backticks.
  - ✅ **GOOD**: triple-backtick-go, triple-backtick-json, triple-backtick-bash, triple-backtick-text,
    triple-backtick-yaml
  - ❌ **BAD**: triple backticks without any language tag
  - Common languages: `go`, `json`, `yaml`, `bash`, `text`, `markdown`, `dockerfile`, `sql`
- **Line Length**: **Maximum 120 characters per line.** Break long lines by:
  - Splitting sentences at natural break points
  - Breaking after commas or conjunctions
  - Using soft line breaks (newlines without blank lines)
  - ✅ **GOOD**: Wrap long prose at natural sentence boundaries.
  - ❌ **BAD**: Keep long prose as one unbroken line beyond 120 characters.
- **Links**: Use markdown link syntax with descriptive text and valid targets.
  For docs references in instruction files, prefer plain text paths (for example `docs/architecture.md`) to avoid
  false prompts-diagnostics missing-file warnings.
- **No Placeholder Targets**: Do not use placeholder link/image targets in markdown examples
  (for example `path/to/file`, `IMAGE_URL`, `your-file.md`). Use real repository paths or plain text.
- **File References**: **CRITICAL** - Always hyperlink file and document references. Use relative paths appropriate
  to file location.
  - ✅ **GOOD** (from `.github/instructions/`):
    See docs/architecture.md for system design details
  - ✅ **GOOD** (from `.github/instructions/`): Configuration in backend/config.yaml
  - ✅ **GOOD** (from `.github/instructions/`): Refer to README.md for setup instructions
  - ❌ **BAD**: `See architecture.md for details` (not hyperlinked)
  - ❌ **BAD**: `Configuration in config.yaml` (not hyperlinked)
  - This applies to: ADRs, configuration files, documentation files, source code files, test files, and any other
    project artifacts
- **Images**: Use markdown image syntax with descriptive alt text and a valid repository-relative path.
  Avoid placeholder image targets in examples.
- **Tables**: Use `|` to create tables. Ensure that columns are properly aligned and headers are included.
  - Separator/header rows must use spaced pipe style (MD060-compliant), for example:
    - ✅ `| Column | Type | Description |`
    - ✅ `| ------ | ---- | ----------- |`
    - ❌ `|------|----|-----------|`
- **Whitespace**: Use blank lines to separate sections and improve readability. Avoid excessive whitespace.
  - Lists must be surrounded by blank lines (MD032-compliant).
  - If a paragraph is immediately followed by a list, insert one blank line first.
  - Headings must be surrounded by blank lines, including one blank line below each heading (MD022-compliant).
  - Fenced code blocks must have one blank line above and below (MD031-compliant).

### Common MD031/MD032 Failure Patterns

- ✅ **GOOD list spacing**

  ~~~markdown
  Paragraph introducing a list.

  - First item
  - Second item
  ~~~

- ✅ **GOOD fenced-code spacing**

  ~~~markdown
  Paragraph introducing code.

  ```sql
  SELECT 1;
  ```
  ~~~

- ❌ **BAD list spacing**

  ~~~markdown
  Paragraph introducing a list.
  - First item
  ~~~

- ❌ **BAD fenced-code spacing**

  ~~~markdown
  Paragraph introducing code.
  ```sql
  SELECT 1;
  ```
  ~~~

### Additional High-Frequency Lint Failures (PR160)

- `MD009` trailing spaces

  - ✅ **GOOD**

    ~~~markdown
    - Item one
    - Item two
    ~~~

  - ❌ **BAD**

    ~~~markdown
    - Item one 
    - Item two 
    ~~~

- `MD049` emphasis style (use asterisks, not underscores)

  - ✅ **GOOD**

    ~~~markdown
    This is *emphasized text* in this repository style.
    ~~~

  - ❌ **BAD**

    ~~~markdown
    This is _emphasized text_ and triggers MD049.
    ~~~

- `MD060` table column style (spaces around pipes)

  - ✅ **GOOD**

    ~~~markdown
    | Option | Status | Notes |
    | ------ | ------ | ----- |
    | A      | Done   | Safe  |
    ~~~

  - ❌ **BAD**

    ~~~markdown
    |Option|Status|Notes|
    |------|------|-----|
    |A|Done|Safe|
    ~~~

- `MD022` headings need blank lines above and below

  - ✅ **GOOD**

    ~~~markdown
    Intro paragraph.

    ### Section Title

    Section body text.
    ~~~

  - ❌ **BAD**

    ~~~markdown
    Intro paragraph.
    ### Section Title
    Section body text.
    ~~~

- `MD032` lists need blank lines around them

  - ✅ **GOOD**

    ~~~markdown
    Intro paragraph.

    - First item
    - Second item

    Closing paragraph.
    ~~~

  - ❌ **BAD**

    ~~~markdown
    Intro paragraph.
    - First item
    - Second item
    Closing paragraph.
    ~~~

### Nested Markdown Example Safety (MD022/MD031)

When documenting markdown templates that contain headings and fenced blocks, use `~~~markdown` for the outer
example and keep blank lines around inner headings and fences.

- ✅ **GOOD nested markdown example**

  ~~~~markdown
  ~~~markdown
  ## Template Title

  ### Usage

  ```bash
  make docs-user-build
  ```
  ~~~
  ~~~~

- ❌ **BAD nested markdown example**

  ~~~~markdown
  ```text
  ### Usage
  ```bash
  make docs-user-build
  ```
  ```
  ~~~~

Use the GOOD pattern to avoid accidental MD022 (blank lines around headings) and MD031
(blank lines around fences) violations in instruction files.

### Mandatory Pre-Submission Checks (for any edited `.md` file)

- Treat MD013 as a hard gate for non-code-block markdown lines: do not finish
  a task while any edited non-code-block markdown line is over 120 chars.
- In fenced code blocks, preserve executable integrity for command examples;
  do not split commands solely to satisfy line-length limits.
- Run markdown diagnostics before finishing markdown edits.
- Fix **all MD001 heading-increment violations** in edited sections.
- Fix **all MD013 line-length violations** introduced in edited  non-code-block sections (max 120 chars per line).
- Fix **all MD022 heading-spacing violations** in edited sections.
- Fix **all MD031 fenced-code-spacing violations** in edited sections.
- Fix **all MD032 list-spacing violations** in edited sections.
- Fix **all MD040 fenced-code-language violations** in edited sections.
- Fix **all MD060 table-column-style violations** in edited tables.
- Do not leave newly introduced markdownlint warnings in the edited regions.

## Validation Requirements

Ensure compliance with the following validation requirements:

- **Front Matter**: Include the following fields in the YAML front matter:

  - `post_title`: The title of the post.
  - `author1`: The primary author of the post.
  - `post_slug`: The URL slug for the post.
  - `microsoft_alias`: The Microsoft alias of the author.
  - `featured_image`: The URL of the featured image.
  - `categories`: The categories for the post. These categories must be from the list in
    /.github/metadata/categories.txt.
  - `tags`: The tags for the post.
  - `ai_note`: Indicate if AI was used in the creation of the post.
  - `summary`: A brief summary of the post. Recommend a summary based on the content when possible.
  - `post_date`: The publication date of the post.

- **Content Rules**: Ensure that the content follows the markdown content rules specified above.
- **Formatting**: Ensure that the content is properly formatted and structured according to the guidelines.
- **Validation**: Run the validation tools to check for compliance with the rules and guidelines.
