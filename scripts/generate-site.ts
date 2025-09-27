import * as fs from 'fs';
import * as path from 'path';
import { marked } from 'marked';

interface PageData {
  pageContent: string;
  metadata: {
    heading: {
      depth: number;
      text: string;
    };
    source: {
      url: string;
    };
    productId: string;
  };
}

interface GenerationStats {
  totalPages: number;
  pagesWithExamples: number;
  pagesWithoutExamples: number;
  components: number;
  otherPages: number;
  componentsWithExamples: number;
  componentsWithoutExamples: number;
  errors: string[];
  warnings: string[];
}

class SiteGenerator {
  private inputFile: string;
  private outputDir: string;
  private pagesDir: string;
  private componentsDir: string;
  private stats: GenerationStats;

  constructor(inputFile: string, outputDir: string) {
    this.inputFile = inputFile;
    this.outputDir = outputDir;
    this.pagesDir = path.join(outputDir, 'pages');
    this.componentsDir = path.join(outputDir, 'components');
    this.stats = {
      totalPages: 0,
      pagesWithExamples: 0,
      pagesWithoutExamples: 0,
      components: 0,
      otherPages: 0,
      componentsWithExamples: 0,
      componentsWithoutExamples: 0,
      errors: [],
      warnings: []
    };
  }

  async generate(): Promise<void> {
    console.log('🚀 Starting site generation...\n');

    try {
      // Read and parse input data
      const data = await this.readInputData();
      console.log(`📖 Loaded ${data.length} pages from input data\n`);

      // Create output directories
      await this.createDirectories();

      // Process each page
      await this.processPages(data);

      // Generate index.html
      await this.generateIndex(data);

      // Generate components.txt
      await this.generateComponentsList(data);

      // Generate components.json
      await this.generateComponentsJSON(data);

      // Show summary
      this.showSummary();

    } catch (error) {
      console.error('❌ Error during generation:', error);
      this.stats.errors.push(`Generation failed: ${error}`);
      process.exit(1);
    }
  }

  private async readInputData(): Promise<PageData[]> {
    try {
      const fileContent = fs.readFileSync(this.inputFile, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Failed to read input file: ${error}`);
    }
  }

  private async createDirectories(): Promise<void> {
    // Create dist directory
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Create pages directory
    if (!fs.existsSync(this.pagesDir)) {
      fs.mkdirSync(this.pagesDir, { recursive: true });
    }

    // Create components directory
    if (!fs.existsSync(this.componentsDir)) {
      fs.mkdirSync(this.componentsDir, { recursive: true });
    }
  }

  private async processPages(data: PageData[]): Promise<void> {
    for (let i = 0; i < data.length; i++) {
      const page = data[i];
      const pageName = this.extractPageName(page, i);
      const isComponent = this.isComponent(pageName);
      const type = isComponent ? 'component' : 'page';
      
      console.log(`📄 Processing ${i + 1}/${data.length}: ${pageName} (${type})`);

      try {
        await this.processPage(page, pageName, i);
        this.stats.totalPages++;
        
        // Track components and other pages separately
        if (isComponent) {
          this.stats.components++;
        } else {
          this.stats.otherPages++;
        }
      } catch (error) {
        const errorMsg = `Failed to process ${type} ${pageName} [array index ${i}]: ${error}`;
        console.error(`❌ ${errorMsg}`);
        this.stats.errors.push(errorMsg);
      }
    }
  }

  private extractPageName(page: PageData, arrayIndex: number): string {
    let name = page.metadata.heading.text;
    const originalName = name;
    
    // Clean up the name - remove special characters and ensure it's valid
    name = name.replace(/[^a-zA-Z0-9\-_]/g, '');
    
    // Handle empty or invalid names
    if (!name || name === '' || name === '-') {
      const generatedName = `page-${Date.now()}`;
      this.stats.warnings.push(`Empty or invalid name "${originalName}" -> generated "${generatedName}" [array index ${arrayIndex}]`);
      return generatedName;
    }
    
    // Check if name was significantly modified
    if (name !== originalName) {
      this.stats.warnings.push(`Name modified: "${originalName}" -> "${name}" [array index ${arrayIndex}]`);
    }
    
    return name;
  }

  private isComponent(pageName: string): boolean {
    // Check if the page name is a CamelCase component
    // Components start with uppercase letter and follow CamelCase pattern
    const camelCasePattern = /^[A-Z][a-zA-Z0-9]*$/;
    
    // List of known non-component pages
    const nonComponents = [
      'utils', 'colors', 'hocs', 'hooks', 'mixins', 'next', 
      'spacing', 'typography', 'typography-legacy', 'Components',
      'NativeForm', 'ReactHookForm', 'component-'
    ];
    
    // Check if it's in the non-components list
    if (nonComponents.some(nc => pageName.startsWith(nc))) {
      return false;
    }
    
    // Check if it matches CamelCase pattern
    return camelCasePattern.test(pageName);
  }

  private async processPage(page: PageData, pageName: string, arrayIndex: number): Promise<void> {
    const isComponent = this.isComponent(pageName);
    const targetDir = isComponent ? this.componentsDir : this.pagesDir;
    const pageDir = path.join(targetDir, pageName);
    
    // Create page directory
    if (!fs.existsSync(pageDir)) {
      fs.mkdirSync(pageDir, { recursive: true });
    }

    // Parse content to separate API and examples
    const { apiContent, examplesContent, hasExamples } = this.parsePageContent(page.pageContent);

    // Check for potential issues
    if (!apiContent || apiContent.trim().length < 10) {
      this.stats.warnings.push(`Very short or empty API content for "${pageName}" [array index ${arrayIndex}]`);
    }

    if (isComponent && !hasExamples) {
      this.stats.warnings.push(`Component "${pageName}" has no examples [array index ${arrayIndex}]`);
    }

    // Generate API file
    const apiFilePath = path.join(pageDir, `${pageName}-api.txt`);
    fs.writeFileSync(apiFilePath, apiContent, 'utf-8');

    // Generate examples file if examples exist
    if (hasExamples && examplesContent.trim()) {
      const examplesFilePath = path.join(pageDir, `${pageName}-examples.txt`);
      fs.writeFileSync(examplesFilePath, examplesContent, 'utf-8');
      this.stats.pagesWithExamples++;
      if (isComponent) {
        this.stats.componentsWithExamples++;
      }
      console.log(`  ✅ Generated API and examples files`);
    } else {
      this.stats.pagesWithoutExamples++;
      if (isComponent) {
        this.stats.componentsWithoutExamples++;
      }
      console.log(`  ✅ Generated API file (no examples found)`);
    }
  }

  private parsePageContent(content: string): { apiContent: string; examplesContent: string; hasExamples: boolean } {
    // First, check if there's a "## Примеры" section
    const examplesSectionRegex = /##\s*Примеры\s*([\s\S]*?)$/i;
    const examplesSectionMatch = content.match(examplesSectionRegex);
    
    let apiContent = content;
    let examplesContent = '';
    let hasExamples = false;

    if (examplesSectionMatch) {
      // Extract examples from the "## Примеры" section
      const examplesSection = examplesSectionMatch[1].trim();
      
      // Extract all code blocks with their context from the examples section
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      const examples: string[] = [];
      let match;
      
      while ((match = codeBlockRegex.exec(examplesSection)) !== null) {
        const language = match[1] || '';
        const code = match[2].trim();
        const codeBlockStart = match.index;
        
        // Only include code blocks that look like React/TypeScript examples
        if (this.isReactCodeBlock(language, code)) {
          // Find the nearest heading before this code block within the examples section
          const contextBeforeCode = examplesSection.substring(0, codeBlockStart);
          const headingMatch = this.findNearestHeading(contextBeforeCode);
          
          // Extract descriptive text between the heading and code block
          const descriptiveText = this.extractDescriptiveText(examplesSection, headingMatch, codeBlockStart);
          
          // Build the example with context
          let exampleWithContext = '';
          if (headingMatch) {
            exampleWithContext += headingMatch + '\n';
          }
          if (descriptiveText.trim()) {
            exampleWithContext += descriptiveText + '\n\n';
          }
          exampleWithContext += `\`\`\`${language}\n${code}\n\`\`\``;
          
          examples.push(exampleWithContext);
        }
      }
      
      if (examples.length > 0) {
        hasExamples = true;
        examplesContent = examples.join('\n\n');
        
        // Remove the "## Примеры" section from API content
        apiContent = content.replace(examplesSectionRegex, '').trim();
      }
    } else {
      // Fallback: extract all code blocks from the entire content
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      const examples: string[] = [];
      let match;
      
      while ((match = codeBlockRegex.exec(content)) !== null) {
        const language = match[1] || '';
        const code = match[2].trim();
        const codeBlockStart = match.index;
        
        // Only include code blocks that look like React/TypeScript examples
        if (this.isReactCodeBlock(language, code)) {
          // Find the nearest heading before this code block
          const contextBeforeCode = content.substring(0, codeBlockStart);
          const headingMatch = this.findNearestHeading(contextBeforeCode);
          
          // Extract descriptive text between the heading and code block
          const descriptiveText = this.extractDescriptiveText(content, headingMatch, codeBlockStart);
          
          // Build the example with context
          let exampleWithContext = '';
          if (headingMatch) {
            exampleWithContext += headingMatch + '\n';
          }
          if (descriptiveText.trim()) {
            exampleWithContext += descriptiveText + '\n\n';
          }
          exampleWithContext += `\`\`\`${language}\n${code}\n\`\`\``;
          
          examples.push(exampleWithContext);
        }
      }
      
      if (examples.length > 0) {
        hasExamples = true;
        examplesContent = examples.join('\n\n');
        
        // Remove all code blocks from API content
        apiContent = content.replace(codeBlockRegex, '').trim();
      }
    }

    // Clean up the content
    apiContent = this.cleanContent(apiContent);
    examplesContent = this.cleanContent(examplesContent);

    return { apiContent, examplesContent, hasExamples };
  }

  private findNearestHeading(content: string): string | null {
    // Look for headings (##, ###, ####) in reverse order
    const headingRegex = /^(#{2,4})\s+(.+)$/gm;
    const headings: Array<{ match: string; index: number }> = [];
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      headings.push({
        match: match[0],
        index: match.index
      });
    }
    
    // Return the last (most recent) heading found
    return headings.length > 0 ? headings[headings.length - 1].match : null;
  }

  private extractDescriptiveText(content: string, headingMatch: string | null, codeBlockStart: number): string {
    if (!headingMatch) {
      // If no heading found, get text from the beginning of content
      return content.substring(0, codeBlockStart).trim();
    }
    
    // Find the position of the heading
    const headingIndex = content.lastIndexOf(headingMatch, codeBlockStart);
    if (headingIndex === -1) {
      return content.substring(0, codeBlockStart).trim();
    }
    
    // Extract text between heading and code block
    const textStart = headingIndex + headingMatch.length;
    const textBetween = content.substring(textStart, codeBlockStart).trim();
    
    // Clean up the text - remove excessive whitespace and empty lines
    return textBetween
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove multiple empty lines
      .replace(/^\s+|\s+$/g, '') // Trim start and end
      .trim();
  }

  private isReactCodeBlock(language: string, code: string): boolean {
    // Check if it's a React/TypeScript/JavaScript code block
    const reactLanguages = ['tsx', 'ts', 'jsx', 'js', 'javascript', 'typescript'];
    if (reactLanguages.includes(language.toLowerCase())) {
      return true;
    }
    
    // If no language specified or unknown language, check for React patterns
    const reactPatterns = [
      /import.*from.*['"]react['"]/i,
      /import.*from.*['"]@salutejs/,
      /<[A-Z][a-zA-Z0-9]*/,
      /export\s+(function|const)\s+\w+/,
      /useState|useEffect|useCallback|useMemo/,
      /className=|onClick=|onChange=/,
      /<div|<span|<button|<input|<form/,
      /return\s*\(/,
      /props\s*[:=]/,
      /React\./,
      /\.tsx?['"]/,
      /\.jsx?['"]/
    ];
    
    return reactPatterns.some(pattern => pattern.test(code));
  }

  private cleanContent(content: string): string {
    // Remove excessive whitespace and clean up formatting
    return content
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove multiple empty lines
      .replace(/^\s+|\s+$/g, '') // Trim start and end
      .replace(/\n\s+/g, '\n') // Remove leading spaces from lines
      .trim();
  }

  private async generateIndex(data: PageData[]): Promise<void> {
    console.log('\n📝 Generating index.html...');

    const allPages = data.map((page, index) => ({
      name: this.extractPageName(page, index),
      isComponent: this.isComponent(this.extractPageName(page, index))
    }));

    const components = allPages.filter(p => p.isComponent).map(p => p.name).sort();
    const pages = allPages.filter(p => !p.isComponent).map(p => p.name).sort();
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plasma Components Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #007acc;
            padding-bottom: 20px;
        }
        .stats {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 30px;
            border-left: 4px solid #007acc;
        }
        .stats h2 {
            margin-top: 0;
            color: #333;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .stat-item {
            background: white;
            padding: 15px;
            border-radius: 4px;
            text-align: center;
        }
        .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #007acc;
        }
        .stat-label {
            color: #666;
            font-size: 14px;
        }
        .components-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }
        .component-card {
            background: white;
            border: 1px solid #e1e5e9;
            border-radius: 6px;
            padding: 20px;
            transition: all 0.2s ease;
            text-decoration: none;
            color: inherit;
        }
        .component-card:hover {
            border-color: #007acc;
            box-shadow: 0 4px 12px rgba(0,122,204,0.15);
            transform: translateY(-2px);
        }
        .component-name {
            font-size: 18px;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
        }
        .component-files {
            font-size: 14px;
            color: #666;
        }
        .file-link {
            display: inline-block;
            background: #f0f0f0;
            padding: 4px 8px;
            border-radius: 4px;
            margin: 2px;
            text-decoration: none;
            color: #333;
            font-size: 12px;
            transition: all 0.2s ease;
        }
        .file-link:hover {
            background: #007acc;
            color: white;
            transform: translateY(-1px);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Plasma Components Documentation</h1>
        
        <div class="stats">
            <h2>📊 Generation Summary</h2>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-number">${this.stats.components}</div>
                    <div class="stat-label">Components</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${this.stats.otherPages}</div>
                    <div class="stat-label">Other Pages</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${this.stats.componentsWithExamples}</div>
                    <div class="stat-label">Components with Examples</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${this.stats.componentsWithoutExamples}</div>
                    <div class="stat-label">Components API Only</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${this.stats.totalPages}</div>
                    <div class="stat-label">Total Pages</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${this.stats.errors.length}</div>
                    <div class="stat-label">Errors</div>
                </div>
            </div>
        </div>

        <h2>🧩 Components</h2>
        <div class="components-grid">
            ${components.map(componentName => `
                <div class="component-card">
                    <div class="component-name">${componentName}</div>
                    <div class="component-files">
                        <a href="components/${componentName}/${componentName}-api.txt" class="file-link">API Documentation</a>
                        <a href="components/${componentName}/${componentName}-examples.txt" class="file-link">Examples</a>
                    </div>
                </div>
            `).join('')}
        </div>

        <h2>📄 Other Pages</h2>
        <div class="components-grid">
            ${pages.map(pageName => `
                <div class="component-card">
                    <div class="component-name">${pageName}</div>
                    <div class="component-files">
                        <a href="pages/${pageName}/${pageName}-api.txt" class="file-link">Documentation</a>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;

    const indexPath = path.join(this.outputDir, 'index.html');
    fs.writeFileSync(indexPath, html, 'utf-8');
    console.log('✅ Generated index.html');
  }

  private async generateComponentsList(data: PageData[]): Promise<void> {
    console.log('\n📝 Generating components.txt...');

    const allPages = data.map((page, index) => ({
      name: this.extractPageName(page, index),
      isComponent: this.isComponent(this.extractPageName(page, index))
    }));

    const components = allPages.filter(p => p.isComponent).map(p => p.name).sort();
    const pages = allPages.filter(p => !p.isComponent).map(p => p.name).sort();

    const componentsList = `# Plasma Components Documentation

Generated on: ${new Date().toISOString()}
Total Components: ${components.length}
Total Pages: ${pages.length}

## Components (${components.length})

${components.map((component, index) => `${index + 1}. ${component}`).join('\n')}

## Other Pages (${pages.length})

${pages.map((page, index) => `${index + 1}. ${page}`).join('\n')}

## File Structure

Each component has the following files:
- \`components/{ComponentName}/{ComponentName}-api.txt\` - API documentation and props
- \`components/{ComponentName}/{ComponentName}-examples.txt\` - React code examples (if available)

Each page has the following files:
- \`pages/{PageName}/{PageName}-api.txt\` - Documentation content

## Usage

This file provides a quick reference to all available components and pages in the Plasma documentation.
You can use this list to:
- Browse all available components
- Check if a specific component exists
- Get an overview of the documentation structure
- Generate scripts or tools that work with the documentation

## Statistics

- Components with examples: ${this.stats.componentsWithExamples}
- Components with API only: ${this.stats.componentsWithoutExamples}
- Total warnings: ${this.stats.warnings.length}
- Total errors: ${this.stats.errors.length}
`;

    const componentsListPath = path.join(this.outputDir, 'components.txt');
    fs.writeFileSync(componentsListPath, componentsList, 'utf-8');
    console.log('✅ Generated components.txt');
  }

  private async generateComponentsJSON(data: PageData[]): Promise<void> {
    console.log('\n📝 Generating components.json...');

    const allPages = data.map((page, index) => ({
      name: this.extractPageName(page, index),
      isComponent: this.isComponent(this.extractPageName(page, index))
    }));

    const components = allPages.filter(p => p.isComponent).map(p => p.name).sort();

    const componentsData = {
      generatedAt: new Date().toISOString(),
      totalComponents: components.length,
      components: components,
      statistics: {
        componentsWithExamples: this.stats.componentsWithExamples,
        componentsWithAPIOnly: this.stats.componentsWithoutExamples,
      }
    };

    const componentsJSONPath = path.join(this.outputDir, 'components.json');
    fs.writeFileSync(componentsJSONPath, JSON.stringify(componentsData, null, 2), 'utf-8');
    console.log('✅ Generated components.json');
  }

  private showSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 GENERATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Total pages generated: ${this.stats.totalPages}`);
    console.log(`🧩 Components: ${this.stats.components}`);
    console.log(`📄 Other pages: ${this.stats.otherPages}`);
    console.log(`📝 Components with examples: ${this.stats.componentsWithExamples}`);
    console.log(`📄 Pages with API only: ${this.stats.pagesWithoutExamples}`);
    console.log(`⚠️  Warnings: ${this.stats.warnings.length}`);
    console.log(`❌ Errors: ${this.stats.errors.length}`);
    
    if (this.stats.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.stats.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }
    
    if (this.stats.errors.length > 0) {
      console.log('\n🚨 Errors:');
      this.stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    if (this.stats.warnings.length === 0 && this.stats.errors.length === 0) {
      console.log('\n✅ No warnings or errors!');
    }
    
    console.log(`\n📁 Output directory: ${this.outputDir}`);
    console.log('🎉 Site generation completed!');
    console.log('='.repeat(80));
  }
}

// Main execution
async function main() {
  const inputFile = path.join(__dirname, '..', 'input-data', 'output.json');
  const outputDir = path.join(__dirname, '..', 'dist');
  
  const generator = new SiteGenerator(inputFile, outputDir);
  await generator.generate();
}

// Run the generator
if (require.main === module) {
  main().catch(console.error);
}

export { SiteGenerator };
