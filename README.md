# QMD Renderer for GitHub

A Chrome extension that renders `.qmd` (Quarto Markdown) files directly on GitHub with syntax highlighting and proper formatting.

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/androidilicious/GitQmd.git
   ```

2. Open Chrome and go to `chrome://extensions/`

3. Enable "Developer mode" (toggle in top right)

4. Click "Load unpacked" and select the extension directory

## Usage

Navigate to any `.qmd` file on GitHub and click the "Render QMD" button in the file header to toggle between raw and rendered views.

## Features

- YAML frontmatter parsing (title, author, date)
- Syntax highlighting for code blocks
- Markdown rendering (tables, lists, blockquotes, images)
- Text wrapping in code blocks
- LaTeX command cleanup (`\newpage`, etc.)
- Dark mode support

## Technical Details

**Built with:**
- Manifest V3
- Marked.js (markdown parsing)
- Highlight.js (syntax highlighting)
- Vanilla JavaScript

**Files:**
- `manifest.json` - Extension configuration
- `content.js` - Main functionality
- `styles.css` - Slate/cyan theme styling
- `lib/` - Bundled libraries (CSP compliant)

## Known Limitations

- Does not execute code chunks
- Complex Quarto features (cross-references, citations) shown as plain text
- Works only on GitHub

## License

MIT License - See LICENSE file

## Author

**Diwas Puri**  
Duke University  
diwas.puri@duke.edu

## Contributing

Issues and pull requests are welcome.
