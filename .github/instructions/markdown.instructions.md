---
description: 'Documentation and content creation standards'
applyTo: '**/*.md'
---

## Markdown Content Rules

The following markdown content rules are enforced by markdownlint and MUST be followed:

1. **Headings**: Use appropriate heading levels (H2, H3, etc.) to structure your content. Do not use an H1 heading,
   as this will be generated based on the title.
2. **Lists**: Use bullet points or numbered lists for lists. Ensure proper indentation and spacing.
3. **Code Blocks**: **ALWAYS specify language for fenced code blocks.** Use triple backticks with language identifier
   (e.g., ```go, ```json, ```bash, ```text).
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
- **Lists**: Use `-` for bullet points and `1.` for numbered lists. Indent nested lists with two spaces.
- **Code Blocks**: **ALWAYS specify language.** Use triple backticks with language identifier immediately after
  opening backticks.
  - ✅ **GOOD**: ` ```go`, ` ```json`, ` ```bash`, ` ```text`, ` ```yaml`
  - ❌ **BAD**: ` ``` ` (no language specified)
  - Common languages: `go`, `json`, `yaml`, `bash`, `text`, `markdown`, `dockerfile`, `sql`
- **Line Length**: **Maximum 120 characters per line.** Break long lines by:
  - Splitting sentences at natural break points
  - Breaking after commas or conjunctions
  - Using soft line breaks (newlines without blank lines)
  - Example:
    ```text
    ✅ GOOD:
    A high-performance service that monitors directories for
    CSV files and converts them to JSON format.

    ❌ BAD:
    A high-performance service that monitors directories for CSV files and converts them to JSON format with routing capabilities.
    ```
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
  - Headings must be surrounded by blank lines, including one blank line below each heading (MD022-compliant).

### Mandatory Pre-Submission Checks (for any edited `.md` file)

- Run markdown diagnostics before finishing markdown edits.
- Fix **all MD013 line-length violations** introduced in edited sections (max 120 chars per line).
- Fix **all MD060 table-column-style violations** in edited tables.
- Fix **all MD032 list-spacing violations** in edited sections.
- Fix **all MD022 heading-spacing violations** in edited sections.
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
