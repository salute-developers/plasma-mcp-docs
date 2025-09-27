# Plasma MCP Docs Generator

[![Live Documentation](https://img.shields.io/badge/📚-Live%20Documentation-blue?style=flat-square)](https://salute-developers.github.io/plasma-mcp-docs/)

A TypeScript script that generates a static documentation site from JSON data containing component documentation.

## Features

- 📄 Generates static HTML documentation site
- 🔍 Parses markdown content to separate API documentation from examples
- 📊 Shows generation progress and statistics with array index debugging
- 🎨 Beautiful, responsive HTML output
- 📁 Organized file structure with separate components and pages folders
- ✅ Error handling and comprehensive warning system
- 🧩 Smart component detection (CamelCase vs other pages)

## Project Structure

```
plasma-mcp-docs/
├── input-data/
│   └── output.json          # Input JSON data
├── scripts/
│   └── generate-site.ts     # Main generator script
├── dist/                    # Generated output (clean, no build artifacts)
│   ├── index.html          # Main index page
│   ├── components/         # CamelCase components
│   │   ├── Accordion/
│   │   │   ├── Accordion-api.txt
│   │   │   └── Accordion-examples.txt
│   │   ├── Button/
│   │   │   └── Button-api.txt
│   │   └── ...
│   └── pages/              # Other documentation pages
│       ├── utils/
│       │   └── utils-api.txt
│       ├── colors/
│       │   └── colors-api.txt
│       └── ...
└── package.json
```

## Installation

1. Install dependencies:
```bash
npm install
```

## Usage

Generate the static site:
```bash
npm run generate
```

Clean the dist folder:
```bash
npm run clean
```

Serve the generated site locally:
```bash
npm run serve
```

## Available Scripts

- `npm run generate` - Generate the static site from JSON data using tsx
- `npm run clean` - Remove the dist folder
- `npm run serve` - Serve the generated site locally on http://localhost:8080
- `npm run preview` - Generate and serve the site locally (convenience command)
- `npm run build` - Compile TypeScript only

## Deployment

### Automatic Deployment (GitHub Pages)

The project is set up with GitHub Actions for automatic deployment to GitHub Pages:

1. **Automatic**: Pushes to the `main` branch automatically trigger deployment
2. **Manual**: Use the "Actions" tab in GitHub to manually trigger deployment
3. **Pull Requests**: PRs will build but not deploy (for testing)

The workflow:
- Installs dependencies
- Generates the documentation site
- Deploys to GitHub Pages


## How It Works

1. **Input Processing**: Reads `input-data/output.json` containing component documentation
2. **Smart Categorization**: Separates CamelCase components from other pages
3. **Content Parsing**: Uses markdown parsing to separate API docs from examples
4. **File Generation**: Creates organized folder structure in `components/` and `pages/`
5. **HTML Generation**: Creates a beautiful index page with separate sections
6. **Progress Tracking**: Shows real-time progress and comprehensive statistics

## Content Structure

The script expects JSON data with this structure:
```json
[
  {
    "pageContent": "# Component Name\n...API documentation...\n## Примеры\n...React examples...",
    "metadata": {
      "heading": {
        "text": "ComponentName"
      },
      "productId": "plasma-web",
      "source": {
        "url": "https://plasma.sberdevices.ru/web/components/component/"
      }
    }
  }
]
```

## Output Files

### Components (CamelCase names)
- `components/{ComponentName}/{ComponentName}-api.txt` - API documentation and props
- `components/{ComponentName}/{ComponentName}-examples.txt` - React code examples (if "Примеры" section exists)

### Other Pages (non-CamelCase names)
- `pages/{PageName}/{PageName}-api.txt` - Documentation content

## Smart Features

- **Component Detection**: Automatically identifies CamelCase components vs other pages
- **Smart Parsing**: Detects Russian "Примеры" (Examples) section
- **Progress Tracking**: Real-time progress updates with component/page type
- **Array Index Debugging**: All warnings include array index for easy tracing
- **Comprehensive Warnings**: Tracks issues like missing examples, invalid names, etc.
- **Clean Output**: dist folder contains only generated site content (no build artifacts)

## Dependencies

- TypeScript
- Node.js
- tsx (TypeScript execution engine)
- marked (markdown parser)
- @types/node
- @types/marked

## Generated Statistics

The script provides detailed statistics and issue tracking:
- Total pages generated
- Components vs Other pages breakdown
- Pages with examples vs API only
- **Warnings**: Non-critical issues that should be reviewed:
  - Components without examples (with array index for easy tracing)
  - Empty or invalid page names (with array index for easy tracing)
  - Very short API content (with array index for easy tracing)
  - Name modifications during processing (with array index for easy tracing)
- **Errors**: Critical issues that prevent processing

## Example Output

```
🚀 Starting site generation...
📖 Loaded 95 pages from input data
📄 Processing 1/95: Accordion (component)
  ✅ Generated API and examples files
📄 Processing 2/95: Attach (component)
  ✅ Generated API file (no examples found)
📄 Processing 83/95: colors (page)
  ✅ Generated API file (no examples found)
...
================================================================================
📊 GENERATION SUMMARY
================================================================================
✅ Total pages generated: 95
🧩 Components: 80
📄 Other pages: 15
📝 Pages with examples: 9
📄 Pages with API only: 86
⚠️  Warnings: 47
❌ Errors: 0

⚠️  Warnings:
   1. Component "Attach" has no examples [array index 2]
   2. Component "AudioPlayer" has no examples [array index 3]
   3. Empty or invalid name "/" -> generated "page-1234567890" [array index 93]
   ...

🎉 Site generation completed!
================================================================================
```
