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
      console.log(`  ✅ Generated API and examples files`);
    } else {
      this.stats.pagesWithoutExamples++;
      console.log(`  ✅ Generated API file (no examples found)`);
    }
  }

  private parsePageContent(content: string): { apiContent: string; examplesContent: string; hasExamples: boolean } {
    // Convert markdown to HTML first to better parse structure
    const htmlContent = marked(content);
    
    // Look for "Примеры" section (Russian for "Examples")
    const examplesRegex = /##\s*Примеры\s*([\s\S]*?)(?=##|$)/i;
    const examplesMatch = content.match(examplesRegex);
    
    let apiContent = content;
    let examplesContent = '';
    let hasExamples = false;

    if (examplesMatch) {
      hasExamples = true;
      examplesContent = examplesMatch[1].trim();
      
      // Remove examples section from API content
      apiContent = content.replace(examplesRegex, '').trim();
    }

    // Clean up the content
    apiContent = this.cleanContent(apiContent);
    examplesContent = this.cleanContent(examplesContent);

    return { apiContent, examplesContent, hasExamples };
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
        }
        .file-link:hover {
            background: #007acc;
            color: white;
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
                    <div class="stat-number">${this.stats.totalPages}</div>
                    <div class="stat-label">Total Components</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${this.stats.pagesWithExamples}</div>
                    <div class="stat-label">With Examples</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${this.stats.pagesWithoutExamples}</div>
                    <div class="stat-label">API Only</div>
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
                <a href="components/${componentName}/" class="component-card">
                    <div class="component-name">${componentName}</div>
                    <div class="component-files">
                        <span class="file-link" href="components/${componentName}/${componentName}-api.txt">API Documentation</span>
                        <span class="file-link" href="components/${componentName}/${componentName}-examples.txt">Examples</span>
                    </div>
                </a>
            `).join('')}
        </div>

        <h2>📄 Other Pages</h2>
        <div class="components-grid">
            ${pages.map(pageName => `
                <a href="pages/${pageName}/" class="component-card">
                    <div class="component-name">${pageName}</div>
                    <div class="component-files">
                        <span class="file-link" href="pages/${pageName}/${pageName}-api.txt">Documentation</span>
                    </div>
                </a>
            `).join('')}
        </div>
    </div>
</body>
</html>`;

    const indexPath = path.join(this.outputDir, 'index.html');
    fs.writeFileSync(indexPath, html, 'utf-8');
    console.log('✅ Generated index.html');
  }

  private showSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 GENERATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Total pages generated: ${this.stats.totalPages}`);
    console.log(`🧩 Components: ${this.stats.components}`);
    console.log(`📄 Other pages: ${this.stats.otherPages}`);
    console.log(`📝 Pages with examples: ${this.stats.pagesWithExamples}`);
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
