import type { AstroIntegration } from 'astro';
import { fetchRepoData, parseRepoIdentifier, type RepoData } from './github';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

interface GenerateOptions {
  githubToken?: string;
  outputDir?: string;
  overwrite?: boolean;
}

interface GitHubContentOptions {
  repositories?: string[];
  githubToken?: string;
  outputDir?: string;
  refreshOnBuild?: boolean;
}

// Content generation functions
export async function generateCodeContent(
  repoIdentifier: string, 
  options: GenerateOptions = {}
): Promise<string> {
  const { githubToken, outputDir = 'src/content/code', overwrite = false } = options;
  
  try {
    // Parse repository identifier
    const { owner, repo } = parseRepoIdentifier(repoIdentifier);
    
    // Fetch repository data
    const repoData = await fetchRepoData(repoIdentifier, githubToken);
    
    // Generate slug
    const slug = `${owner}-${repo}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Generate frontmatter
    const frontmatter = generateFrontmatter(repoData);
    
    // Generate content body
    const body = generateContentBody(repoData);
    
    // Combine frontmatter and body
    const content = `---\n${frontmatter}\n---\n\n${body}`;
    
    // Write to file
    const filename = `${slug}.md`;
    const filepath = join(process.cwd(), outputDir, filename);
    
    // Ensure directory exists
    await mkdir(join(process.cwd(), outputDir), { recursive: true });
    
    // Check if file exists
    try {
      await import('fs').then(fs => fs.promises.access(filepath));
      if (!overwrite) {
        throw new Error(`File ${filename} already exists. Use overwrite: true to replace it.`);
      }
    } catch (error) {
      // File doesn't exist, which is fine
    }
    
    await writeFile(filepath, content, 'utf-8');
    
    return filename;
    
  } catch (error) {
    console.error(`Failed to generate content for ${repoIdentifier}:`, error);
    throw error;
  }
}

function generateFrontmatter(repoData: RepoData): string {
  const frontmatter: Record<string, any> = {
    title: repoData.title,
    description: repoData.description,
    status: 'published',
    layout: 'code',
    repoUrl: repoData.repoUrl,
    repoOwner: repoData.repoOwner,
    repoName: repoData.repoName,
    date: repoData.lastUpdated.toISOString(),
    lastUpdated: repoData.lastUpdated.toISOString(),
  };

  // Add optional fields
  if (repoData.language) frontmatter.language = repoData.language;
  if (repoData.stars > 0) frontmatter.stars = repoData.stars;
  if (repoData.forks > 0) frontmatter.forks = repoData.forks;
  if (repoData.license) frontmatter.license = repoData.license;
  if (repoData.homepage) frontmatter.homepage = repoData.homepage;
  
  if (repoData.tags.length > 0) frontmatter.tags = repoData.tags;
  if (repoData.topics.length > 0) frontmatter.topics = repoData.topics;
  if (repoData.dependencies.length > 0) frontmatter.dependencies = repoData.dependencies;
  if (repoData.devDependencies.length > 0) frontmatter.devDependencies = repoData.devDependencies;

  // Cache API data
  frontmatter.apiData = {
    fetchedAt: new Date().toISOString(),
    readme: repoData.readme ? 'cached' : null,
    fileTree: repoData.fileTree,
    languages: repoData.languages
  };

  return Object.entries(frontmatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}:\n${value.map(v => `  - ${JSON.stringify(v)}`).join('\n')}`;
      } else if (typeof value === 'object' && value !== null) {
        return `${key}:\n${Object.entries(value).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join('\n')}`;
      } else {
        return `${key}: ${JSON.stringify(value)}`;
      }
    })
    .join('\n');
}

function generateContentBody(repoData: RepoData): string {
  let body = '';

  // Repository header with metadata
  body += generateRepoHeader(repoData);
  
  // Tech stack section
  if (repoData.dependencies.length > 0 || repoData.devDependencies.length > 0) {
    body += generateTechStackSection(repoData);
  }

  // File structure
  if (repoData.fileTree.length > 0) {
    body += generateFileStructureSection(repoData);
  }

  // Languages breakdown
  if (Object.keys(repoData.languages).length > 0) {
    body += generateLanguagesSection(repoData);
  }

  // README content
  if (repoData.readme) {
    body += generateReadmeSection(repoData.readme);
  }

  return body;
}

function generateRepoHeader(repoData: RepoData): string {
  let header = `## Repository Overview\n\n`;
  
  // Badges and stats
  const badges = [];
  if (repoData.stars > 0) badges.push(`⭐ ${repoData.stars} stars`);
  if (repoData.forks > 0) badges.push(`🍴 ${repoData.forks} forks`);
  if (repoData.language) badges.push(`📝 ${repoData.language}`);
  if (repoData.license) badges.push(`📄 ${repoData.license}`);
  
  if (badges.length > 0) {
    header += `${badges.join(' • ')}\n\n`;
  }

  // Links
  header += `**Repository:** [${repoData.repoOwner}/${repoData.repoName}](${repoData.repoUrl})\n`;
  if (repoData.homepage) {
    header += `**Homepage:** [${repoData.homepage}](${repoData.homepage})\n`;
  }
  header += `**Last Updated:** ${repoData.lastUpdated.toLocaleDateString()}\n\n`;

  return header;
}

function generateTechStackSection(repoData: RepoData): string {
  let section = `## Tech Stack\n\n`;
  
  if (repoData.dependencies.length > 0) {
    section += `### Dependencies\n`;
    section += repoData.dependencies.map(dep => `- ${dep}`).join('\n') + '\n\n';
  }
  
  if (repoData.devDependencies.length > 0) {
    section += `### Development Dependencies\n`;
    section += repoData.devDependencies.map(dep => `- ${dep}`).join('\n') + '\n\n';
  }
  
  return section;
}

function generateFileStructureSection(repoData: RepoData): string {
  let section = `## Project Structure\n\n`;
  section += '```\n';
  section += repoData.fileTree.map(dir => `📁 ${dir}/`).join('\n');
  section += '\n```\n\n';
  return section;
}

function generateLanguagesSection(repoData: RepoData): string {
  const total = Object.values(repoData.languages).reduce((sum, bytes) => sum + bytes, 0);
  
  let section = `## Languages\n\n`;
  
  Object.entries(repoData.languages)
    .sort(([,a], [,b]) => b - a)
    .forEach(([lang, bytes]) => {
      const percentage = ((bytes / total) * 100).toFixed(1);
      section += `- **${lang}**: ${percentage}%\n`;
    });
  
  section += '\n';
  return section;
}

function generateReadmeSection(readme: string): string {
  // Process README content
  let processedReadme = readme;
  
  // Fix relative image paths (basic implementation)
  processedReadme = processedReadme.replace(
    /!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
    (match) => {
      // Convert relative paths to GitHub raw URLs
      // This is a simplified approach - you might want to make this more robust
      return match; // For now, keep as-is
    }
  );
  
  return `## README\n\n${processedReadme}\n`;
}

// CLI-style function for manual content generation
export async function generateFromCLI(repoIdentifier: string, token?: string): Promise<void> {
  try {
    await generateCodeContent(repoIdentifier, {
      githubToken: token,
      overwrite: true
    });
  } catch (error) {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  }
}

// Astro integration
export function githubContent(options: GitHubContentOptions = {}): AstroIntegration {
  const {
    repositories = [],
    githubToken = process.env.GITHUB_TOKEN,
    outputDir = 'src/content/code',
    refreshOnBuild = false
  } = options;

  return {
    name: 'github-content',
    hooks: {
      'astro:build:start': async () => {
        if (repositories.length === 0) {
          return;
        }

        for (const repo of repositories) {
          try {
            await generateCodeContent(repo, {
              githubToken,
              outputDir,
              overwrite: refreshOnBuild
            });
          } catch (error) {
            console.error(`❌ Failed to generate content for ${repo}:`, error);
          }
        }
      }
    }
  };
}

// Export a helper function for manual content generation
export async function addRepository(repoIdentifier: string, options: Omit<GitHubContentOptions, 'repositories'> = {}) {
  const {
    githubToken = process.env.GITHUB_TOKEN,
    outputDir = 'src/content/code'
  } = options;

  try {
    const filename = await generateCodeContent(repoIdentifier, {
      githubToken,
      outputDir,
      overwrite: true
    });
    
    return filename;
  } catch (error) {
    console.error(`❌ Failed to add repository ${repoIdentifier}:`, error);
    throw error;
  }
}
